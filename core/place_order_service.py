import redis
import time
import json
import socketio
import threading
import os
import jwt
import aiohttp
import asyncio
from dotenv import load_dotenv
from utils.common_functions import generate_option_names, get_price_using_id, get_instrument_id_by_option_name, get_index_price
from utils.make_post_request import make_post_request
from utils.make_put_request import make_put_request
from utils.make_get_request import make_get_request
from utils.service_checker import is_service_3000_healthy, is_service_3001_healthy


load_dotenv()

option_data = []  #combined premium data

index_price = []  # index price
option_price = []  # option price
active_trades = []  # trade details

option_details = []  # get option ids

interactive_token = ""

data_lock = threading.Lock()

last_check_time = 0
socket_last_check_time = 0


semaphore = asyncio.Semaphore(10)


# redis client
r = redis.Redis(host='localhost', port=6379, decode_responses=True)


# ---- Redis Stream Fetcher ----
def placeOrderMain():
    global active_trades, option_details, interactive_token

    stream_key = 'tradeStream'

    interactive_token = r.get('interactiveSession')

    get_from_cache_option_data = r.get('optionsData')
    option_details = json.loads(get_from_cache_option_data)

    latest_entry = r.xrevrange(stream_key, count=1)
    last_id = latest_entry[0][0] if latest_entry else '0-0'

    if latest_entry and latest_entry[0][1].get('trades'):
        trades_json = latest_entry[0][1]['trades']
        with data_lock:
            active_trades = json.loads(trades_json)

    print("🔁 Listening for Redis stream updates...")

    while True:
        messages = r.xread({stream_key: last_id}, block=1000, count=1)

        if messages:
            for stream, entries in messages:
                for message_id, message in entries:
                    if message_id != last_id:
                        last_id = message_id
                        print(f"🆕 New Redis stream update")
                        r.set("place_order_service_last_redis", int(time.time()))

                        trades_list = json.loads(message.get('trades', '[]'))
                        with data_lock:
                            active_trades = trades_list
        time.sleep(0.5)

# ---- Entry Checker ----
async def continuously_check_entries():
    global option_data, active_trades, last_check_time

    async with aiohttp.ClientSession() as session:
        while True:
            with data_lock:
                if not option_data or not active_trades:
                    await asyncio.sleep(0.5)
                    continue

                version_before = json.dumps(active_trades)  # snapshot for instant Redis update detection
                trades_snapshot = list(active_trades)
                price_snapshot = list(option_data)

            for i, trade in enumerate(trades_snapshot):
                # Check if Redis updated active_trades instantly
                if json.dumps(active_trades) != version_before:
                    print("🔄 Active trades updated — restarting loop")
                    break

                current_time = int(time.time())

                if current_time - last_check_time >= 10:
                    r.set("place_order_service_last_check", int(time.time()))
                    last_check_time = current_time

                if (
                    trade.get("entryType") == "UNDEFINED"
                    or trade.get("entryTriggered")
                    or trade.get("entrySide") == "UNDEFINED"
                    or trade.get("isDummy") is True
                ):
                    await asyncio.sleep(0.5)
                    continue

                lowest_value = 0
                closest_to_zero_spreads = []

                matching_price_entry = next((entry for entry in price_snapshot if entry['id'] == trade['id']), None)

                if not matching_price_entry:
                    print(f"No matching live price found for trade ID: {trade['id']}")
                    await asyncio.sleep(0.5)
                    continue

                combined_premiums = matching_price_entry.get('combinedPremiumArray', [])
                spread_premiums = matching_price_entry.get('spreadPremiumArray', [])

                if not combined_premiums:
                    print("No combined premiums found for this trade.")
                    await asyncio.sleep(0.5)
                    continue

                lowest = min(combined_premiums, key=lambda x: x['combinedPremium'])
                lowest_value = lowest['combinedPremium']

                if not spread_premiums:
                    print("No spread premiums found for this trade.")
                    await asyncio.sleep(0.5)
                    continue

                leg_count = trade.get("legCount", 1)
                sorted_spreads = sorted(spread_premiums, key=lambda x: abs(x['spreadPremium']))
                closest_to_zero_spreads = sorted_spreads[:leg_count]

                if entry_criteria_met(trade, lowest_value):
                    try:
                        orderOptionDetails = place_order_strike_details(closest_to_zero_spreads, trade)
                        index_price_at_order = get_index_price(trade['indexName'], index_price)

                        await handleOrder(session,trade, orderOptionDetails)  

                        await get_entry_price(session, orderOptionDetails) 
                        await add_order_position(session, orderOptionDetails) 

                        if trade["entryType"] == "MARKET":
                            if trade['entrySide'] == "SELL":
                                sl_value = int(lowest_value + trade['stopLossPoints'])
                                tp_value = int(lowest_value - trade["takeProfitPoints"])
                            else:
                                sl_value = int(lowest_value - trade['stopLossPoints'])
                                tp_value = int(lowest_value + trade["takeProfitPoints"])

                            await retry_update_trade_details(session, trade['id'], {
                                "entryPrice": lowest_value,
                                "takeProfitPremium": tp_value,
                                "stopLossPremium": sl_value
                            })

                        upper_limit = 0
                        lower_limit = 0

                        if trade['pointOfAdjustment'] != 0:
                            upper_limit = int(trade['pointOfAdjustment'] + index_price_at_order)
                            lower_limit = int(abs(trade['pointOfAdjustment'] - index_price_at_order))

                        await retry_update_trade_details(session, trade['id'], {
                            "entrySpotPrice": index_price_at_order,
                            "entryTriggered": True,
                            "pointOfAdjustmentUpperLimit": upper_limit,
                            "pointOfAdjustmentLowerLimit": lower_limit
                        })

                        with data_lock:
                            trade['entryTriggered'] = True

                    except Exception as e:
                        print(f"Error: {e}")

                await asyncio.sleep(0.5)

# ---- Place Order Strike Details ----
def place_order_strike_details(closest_to_zero_spreads, trade):
    orderOptionDetails = []
    for premiums in closest_to_zero_spreads:
        optionNames = generate_option_names(premiums['name'])
        getCeId = get_instrument_id_by_option_name(optionNames[0], option_details)
        getPeId = get_instrument_id_by_option_name(optionNames[1], option_details)
        cePrice = get_price_using_id(getCeId, option_price)
        pePrice = get_price_using_id(getPeId, option_price)

        orderOptionDetails.append({
            "optionName": optionNames[0],
            "initialQty": str(trade['qty']),
            "currentQty": str(trade['currentQty']),
            "entryPrice": float(cePrice),
            "exchangeId": getCeId,
            "tradeDetailsId": trade["id"]
        })
        orderOptionDetails.append({
            "optionName": optionNames[1],
            "initialQty": str(trade['qty']),
            "currentQty": str(trade['currentQty']),
            "entryPrice": float(pePrice),
            "exchangeId": getPeId,
            "tradeDetailsId": trade["id"]
        })
    return orderOptionDetails

# ---- API Functions with Retry ----
async def retry_update_trade_details(session,trade_id, update_data, retries=3):
    for _ in range(retries):
        try:
            await make_put_request(
                session,
                url=f"http://localhost:3000/user/tradeInfo?id={trade_id}",
                payload=update_data,
                headers={"Authorization": f"Bearer {AUTH_TOKEN}"},
                timeout=15
            )
            return
        except Exception as e:
            print(f"Retrying update_trade_details: {e}")
            time.sleep(1)

async def add_order_position(session,orderOptionDetails, retries=3):
    for _ in range(retries):
        try:
            result = await make_post_request(
            session,
            url="http://localhost:3000/user/position",
            payload={"positions": orderOptionDetails},
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"},
            timeout=15
        )
            print("Add order API Response:", result)
            return
        except Exception as e:
            print(f"Retrying add_order_position: {e}")
            time.sleep(1)

def get_exchange_segment(indexName):
    if indexName == "NIFTY" or indexName == "BANKNIFTY" or indexName == "FINNIFTY" or indexName == "MIDCPNIFTY":
        return "NSEFO"
    elif indexName == "BANKEX" or  indexName == "SENSEX" :
        return "BSEFO"
    else:
        raise ValueError(f"Unknown index name: {indexName}")

async def get_qty(session,trade):
    try:
        qty = await make_get_request(
            session,
            url="http://localhost:3000/user/lotSize",
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"},
        )
        check = qty['data']

        for lot in check:
            if lot['optionName'] == trade['indexName'].lower()+trade['expiry'].upper():
                return lot['lotSize'] * int(trade['currentQty'])
    except Exception as e:
        print(f"Error fetching quantity: {e}")


async def get_entry_price(session,orderOptionDetails):
    try:
        for option in orderOptionDetails:
            res = await make_get_request(
                session,
                url=f"https://trading.bigul.co/interactive/orders?appOrderID={option['entryAppOrderId']}",
                headers={"Authorization": f"{interactive_token}"},
                timeout=15
            )
            last_status = res['result'][-1]
            if(last_status['OrderAverageTradedPrice'] == 0 or last_status['OrderAverageTradedPrice'] == ""):
                raise ValueError("Order not executed yet")
            option['entryPrice'] = float(last_status['OrderAverageTradedPrice']) if last_status['OrderAverageTradedPrice'] else 0
    except Exception as e:
        print(f"Error fetching entry price: {e}")




async def place_order(session, trade, option):

    try:
        payload = {
            "exchangeSegment": get_exchange_segment(trade['indexName']),
            "exchangeInstrumentID": option['exchangeId'],
            "productType": "NRML",
            "orderType": "Market",
            "orderSide": trade['entrySide'],
            "timeInForce": "DAY",
            "disclosedQuantity": 0,
            "orderQuantity": await get_qty(session,trade),
            "limitPrice": option['entryPrice'],
            "stopPrice": 0,
            "orderUniqueIdentifier": trade['id'],
        }

        res = await make_post_request(
            session,
            url="https://trading.bigul.co/interactive/orders",
            payload=payload,
            headers={"Authorization": f"{interactive_token}"},
            timeout=15,semaphore=semaphore
        )
        return res['result']['AppOrderID']
    except Exception as e:
        print(f"Error placing order: {e}")
        raise


# ---- Entry Criteria ----
def entry_criteria_met(trade, lowest_value):
    if trade["entryType"] == "MARKET":
        return True
    if trade["entryType"] == "LIMIT" and lowest_value >= trade['entryPrice']:
        return True
    return False



async def handleOrder(session,trade, orderOptionDetails):

    tasks = []
    for option in orderOptionDetails:
        tasks.append(place_order(session, trade, option))

    # Gather results with rate limiting via semaphore
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for option, order_id in zip(orderOptionDetails, results):
        if isinstance(order_id, Exception):
            option['entryAppOrderId'] = None
        else:
            option['entryAppOrderId'] = order_id
        option['exitAppOrderId'] = 0

    print(f"✅ Placing order Done for {trade['indexName']} {trade['entrySide']} ({trade['id']})")


# ---- Socket.IO ----
sio = socketio.Client()

@sio.on('connect')
def on_connect():
    print("✅ Connected to Socket.IO server")

@sio.on('optionPremium')
def on_option_premium(data):
    global option_data,socket_last_check_time
    try:
        with data_lock:
            option_data = data["data"]
        
        current_time_now = int(time.time())
        if current_time_now - socket_last_check_time  >= 10:
            r.set("place_order_service_last_socket", int(time.time()))
            socket_last_check_time = current_time_now

        
    except Exception as e:
        print(f"Error parsing optionPremium: {e}")

@sio.on('indexPriceUpdate')
def on_index_price(data):
    global index_price,socket_last_check_time
    try:
        with data_lock:
            for item in index_price:
                if item['name'] == data["name"]:
                    item['price'] = data['price']
                    return
            index_price.append(data)
        
        current_time_now = int(time.time())
        if current_time_now - socket_last_check_time  >= 10:
            r.set("place_order_service_last_socket", int(time.time()))
            socket_last_check_time = current_time_now
    except Exception as e:
        print(f"Error parsing indexPriceUpdate: {e}")

@sio.on('optionPriceUpdate')
def on_option_price(data):
    global option_price,socket_last_check_time
    try:
        with data_lock:
            for item in option_price:
                if item['optionName'] == data["optionName"]:
                    item['price'] = data['price']
                    return
            option_price.append(data)
        
        current_time_now = int(time.time())
        if current_time_now - socket_last_check_time  >= 10:
            r.set("place_order_service_last_socket", int(time.time()))
            socket_last_check_time = current_time_now
    except Exception as e:
        print(f"Error parsing optionPriceUpdate: {e}")

@sio.on('lastPrice')
def on_price(data):
    global option_data, index_price, option_price,socket_last_check_time
    try:
        with data_lock:
            option_data = data["optionsData"]
            index_price = data["IndexPrice"]
            option_price = data["optionPrice"]
        
        current_time_now = int(time.time())
        if current_time_now - socket_last_check_time  >= 10:
            r.set("place_order_service_last_socket", int(time.time()))
            socket_last_check_time = current_time_now
    except Exception as e:
        print(f"Error parsing lastPrice: {e}")

@sio.on('disconnect')
def on_disconnect():
    print("❌ Disconnected from server")

def start_socket_io():
    sio.connect("http://localhost:3001", headers={"Authorization": f"Bearer {AUTH_TOKEN}"})
    sio.wait()


def wait_for_services(delay=10):
    print("Waiting for dependent services to be healthy...")
    while True:
        service_3000_ok = is_service_3000_healthy()
        service_3001_ok = is_service_3001_healthy()

        if service_3000_ok and service_3001_ok:
            print("All dependent services are healthy. Proceeding...")
            break
        else:
            print(f"Service check failed. Retrying in {delay} seconds...")
            time.sleep(delay)


# ---- Main ----
if __name__ == "__main__":
    wait_for_services()
    JWT_SECRET = os.getenv("JWT_SECRET")
    payload = {"id": "SERVER"}
    AUTH_TOKEN = jwt.encode(payload, JWT_SECRET)

    threading.Thread(target=start_socket_io, daemon=True).start()
    threading.Thread(target=placeOrderMain, daemon=True).start()
    asyncio.run(continuously_check_entries())
