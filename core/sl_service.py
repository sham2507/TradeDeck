import redis
import time
import json
import socketio
import threading
import os
import jwt
from dotenv import load_dotenv

import aiohttp
import asyncio
from utils.make_get_request import make_get_request
from utils.make_put_request import make_put_request
from utils.make_post_request import make_post_request
from utils.service_checker import is_service_3000_healthy, is_service_3001_healthy

load_dotenv()

# ---- Global Variables ----
live_price = []  # option data combined premium
active_trades = []  # List of trades from Redis to be monitored continuously
option_details = []  # option exchange id from redis cache
interactive_token = ""
data_lock = threading.Lock()  # ✅ Lock to prevent race conditions on shared data

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
        with data_lock:  # ✅ Lock when updating shared data
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
                        r.set("sl_service_last_redis", int(time.time()))  # ✅ Redis latest entry timestamp

                        trades_list = json.loads(message.get('trades', '[]'))
                        with data_lock:
                            active_trades = trades_list
        time.sleep(0.5)

# ---- Entry Checker ----
async def continuously_check_entries():
    global live_price, active_trades, last_check_time

    async with aiohttp.ClientSession() as session:
        while True:
            with data_lock:
                if not live_price or not active_trades:
                    await asyncio.sleep(0.5)
                    continue

                version_before = json.dumps(active_trades)
                trades_snapshot = list(active_trades)
                price_snapshot = list(live_price)

            for i in range(len(trades_snapshot)):
                # Check for updates from Redis mid-loop
                async with asyncio.Lock():
                    if json.dumps(active_trades) != version_before:
                        print("🔄 Active trades updated — restarting loop")
                        break
                    trade = trades_snapshot[i]

                current_time_check = int(time.time())

                if current_time_check - last_check_time >= 10:
                    r.set("sl_service_last_check", int(time.time()))
                    last_check_time = current_time_check

                if (trade.get("entryTriggered") is not True or trade.get("tpTriggered") or
                    trade.get("slTriggered") or trade.get('entrySide') == "UNDEFINED") or trade.get("isDummy") == True:
                    await asyncio.sleep(0.5)
                    continue

                matching_price_entry = next((entry for entry in price_snapshot if entry['id'] == trade['id']), None)

                if not matching_price_entry:
                    print(f"[{current_time()}] No matching live price found for trade ID: {trade['id']}")
                    await asyncio.sleep(0.5)
                    continue

                combined_premiums = matching_price_entry.get('combinedPremiumArray', [])

                if not combined_premiums:
                    print(f"[{current_time()}] No combined premiums found for trade {trade['id']}")
                    await asyncio.sleep(0.5)
                    continue

                lowest = min(combined_premiums, key=lambda x: x['combinedPremium'])
                lowest_value = lowest['combinedPremium']

                if sl_criteria_met(trade, lowest_value):
                    try:
                        position_list = await get_position_details(session, trade['id'])  # async
                        if len(position_list) <= 0:
                            print(f"[{current_time()}] No position found for trade ID: {trade['id']}")
                            return
                        await handleOrder(session, trade, position_list)  # async
                        await get_entry_price(session,position_list)  # kept sync as per original
                        await retry_update_position_details(session, position_list)  # async
                        await retry_update_trade_details(session, trade['id'], {
                            "currentQty": 0,
                            "slTriggered": True,
                            "alive": False,
                            "reason": "SL Triggered"
                        })
                        with data_lock:
                            trade['slTriggered'] = True
                            trade['alive'] = False
                    except Exception as e:
                        print(f"[{current_time()}] Error handling order for {trade['id']}: {e}")

                await asyncio.sleep(0.5)


# ---- Entry Criteria Logic ----
def sl_criteria_met(trade, lowest_value):
    if trade['entrySide'] == "SELL" and lowest_value >= trade['stopLossPremium']:
        return True
    if trade['entrySide'] == "BUY" and lowest_value <= trade['stopLossPremium']:
        return True
    return False

# ---- Reliable Update Functions with Retry ----
async def retry_update_position_details(session,position_list,retries=3):
    
    position_bulk_update = []
    for position in position_list:
        position_bulk_update.append({
            "id": position['id'],
            "data": {
                "currentQty": "0",
                "closePrice": position['closePrice'],
                "closed": True,
                "exitAppOrderId": position['exitAppOrderId']
            }
        })

    for _ in range(retries):
        try:
            data = {"currentQty": "0","closePrice": 0 ,"closed": True}
            await make_put_request(
                session,
                url="http://localhost:3000/user/bulk/position",
                payload={"positions": position_bulk_update},
                headers={"Authorization": f"Bearer {AUTH_TOKEN}"},
                timeout=15
            )
            return
        except Exception as e:
            print(f"[{current_time()}] Retrying update_position_details: {e}")
            time.sleep(1)


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
            print(f"[{current_time()}] Retrying update_trade_details: {e}")
            time.sleep(1)


async def get_entry_price(session,orderOptionDetails):
    try:
        for option in orderOptionDetails:
            res = await make_get_request(
                session,
                url=f"https://trading.bigul.co/interactive/orders?appOrderID={option['exitAppOrderId']}",
                headers={"Authorization": f"{interactive_token}"},
                timeout=15
            )
            last_status = res['result'][-1]
            if(last_status['OrderAverageTradedPrice'] == 0 or last_status['OrderAverageTradedPrice'] == ""):
                raise ValueError("Order not executed yet")
            option['closePrice'] = float(last_status['OrderAverageTradedPrice']) if last_status['OrderAverageTradedPrice'] else 0
    except Exception as e:
        print(f"Error fetching entry price: {e}")

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

def get_entry_side (side) :
    if side == "BUY":
        return "SELL"
    elif side == "SELL":
        return "BUY"
    else:
        raise ValueError(f"Unknown entry side: {side}")

async def place_order(session, trade, option, semaphore=None):
    try:
        res = await make_post_request(
            session=session,
            url="https://trading.bigul.co/interactive/orders",
            payload={
                "exchangeSegment": get_exchange_segment(trade['indexName']),
                "exchangeInstrumentID": option['exchangeId'],
                "productType": "NRML",
                "orderType": "Market",
                "orderSide": get_entry_side(trade['entrySide']),
                "timeInForce": "DAY",
                "disclosedQuantity": 0,
                "orderQuantity": await get_qty(session, trade),
                "limitPrice": option['entryPrice'],
                "stopPrice": 0,
                "orderUniqueIdentifier": trade['id'],
            },
            headers={"Authorization": f"{interactive_token}"},
            timeout=15,
            semaphore=semaphore
        )
        return res['result']['AppOrderID']
    except Exception as e:
        print(f"Error placing order: {e}")
        return None


async def get_position_details(session, trade_id):
    try:
        response = await make_get_request(
            session,
            url="http://localhost:3000/user/position",
            headers={"Authorization": f"Bearer {AUTH_TOKEN}"},
            timeout=15
        )

        position_list = response.get('positions', [])
        filtered_positions = [
            position for position in position_list
            if position['tradeDetailsId'] == trade_id and position['closed'] is False
        ]
        return filtered_positions

    except Exception as e:
        print(f"[{current_time()}] Error fetching position details: {e}")
        return []


async def handleOrder(session, trade, position_list):
    # Create tasks for all place_order calls
    tasks = [
        place_order(session, trade, position, semaphore=semaphore)
        for position in position_list
    ]

    # Run all HTTP requests concurrently
    results = await asyncio.gather(*tasks)

    # Assign results back to positions
    for position, order_id in zip(position_list, results):
        position['exitAppOrderId'] = order_id

    print(f"✅ Orders placed for {trade['indexName']} ({trade['id']}) - SL")

# ---- Socket.IO ----
sio = socketio.Client()

@sio.on('connect')
def on_connect():
    print("✅ Connected to Socket.IO server")

@sio.on('optionPremium')
def on_option_premium(data):
    global live_price,socket_last_check_time
    try:
        with data_lock:
            live_price = data["data"]

        current_time_now = int(time.time())
        if current_time_now - socket_last_check_time  >= 10:
            r.set("sl_service_last_socket", int(time.time()))  # ✅ Redis latest Socket.IO update timestamp
            socket_last_check_time = current_time_now


    except Exception as e:
        print(f"[{current_time()}] Error parsing optionPremium: {e}")

@sio.on('lastPrice')
def on_price(data):
    global live_price,socket_last_check_time
    try:
        with data_lock:
            live_price = data["optionsData"]

        current_time_now = int(time.time())
        if current_time_now - socket_last_check_time  >= 10:
            r.set("sl_service_last_socket", int(time.time()))  # ✅ Redis latest Socket.IO update timestamp
            socket_last_check_time = current_time_now
    except Exception as e:
        print(f"[{current_time()}] Error parsing lastPrice: {e}")

@sio.on('disconnect')
def on_disconnect():
    print("❌ Disconnected from server")

def start_socket_io():
    sio.connect("http://localhost:3001", headers={"Authorization": f"Bearer {AUTH_TOKEN}"})
    sio.wait()

# ---- Utility ----
def current_time():
    return time.strftime('%Y-%m-%d %H:%M:%S')

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
