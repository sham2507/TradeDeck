import redis
import psycopg2
import json
import os
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

def serialize_row(row, columns):
    result = {}
    for col, val in zip(columns, row):
        if isinstance(val, datetime):
            result[col] = val.isoformat()
        else:
            result[col] = val
    return result

def main():
    # Redis connection
    r = redis.Redis(host='localhost', port=6379, decode_responses=True)

    # Subscribe to Redis channel
    pubsub = r.pubsub()
    pubsub.subscribe('tradeInfo')
    print("Subscribed to 'tradeInfo' channel...")

    trade_stream_key = 'tradeStream'
    portfolio_stream_key = 'portfolioStream'

    for message in pubsub.listen():
        if message['type'] == 'message':
            data = message['data']
            print(f"Received message: {data}")

            # PostgreSQL connection
            conn = psycopg2.connect(
                dbname=os.getenv("DB_NAME"),
                user=os.getenv("DB_USER"),
                password=os.getenv("DB_PASSWORD"),
                host=os.getenv("DB_HOST", "localhost"),
                port=os.getenv("DB_PORT", "5432")
            )

            try:
                with conn.cursor() as cursor:
                    # Fetch TradeDetails
                    cursor.execute("""
                        SELECT 
                            td.*, 
                            i."indexName", 
                            i."expiry",
                            i."ltpRange",
                            i.id as "instanceId"
                        FROM "TradeDetails" td
                        JOIN "Instance" i ON td."instanceId" = i."id"
                        WHERE td.alive = TRUE AND td."isDeleted" = FALSE
                    """)
                    trade_columns = [desc[0] for desc in cursor.description]
                    trade_rows = cursor.fetchall()
                    trades = [serialize_row(row, trade_columns) for row in trade_rows]

                    # print(trades)

                    # Update tradeStream
                    trade_entries = r.xrevrange(trade_stream_key, count=1)
                    if trade_entries:
                        last_trade_id = trade_entries[0][0]
                        r.xdel(trade_stream_key, last_trade_id)
                        print(f"Removed previous trade stream entry: {last_trade_id}")
                    trade_msg_id = r.xadd(trade_stream_key, {"trades": json.dumps(trades)})
                    print(f"Added to trade stream with ID {trade_msg_id}")

                    # Fetch PortfolioSettings
                    cursor.execute("""
                        SELECT * FROM "PortfolioSettings"
                    """)
                    portfolio_columns = [desc[0] for desc in cursor.description]
                    portfolio_rows = cursor.fetchall()
                    portfolios = [serialize_row(row, portfolio_columns) for row in portfolio_rows]

                    # Update portfolioStream
                    portfolio_entries = r.xrevrange(portfolio_stream_key, count=1)
                    if portfolio_entries:
                        last_portfolio_id = portfolio_entries[0][0]
                        r.xdel(portfolio_stream_key, last_portfolio_id)
                        print(f"Removed previous portfolio stream entry: {last_portfolio_id}")
                    portfolio_msg_id = r.xadd(portfolio_stream_key, {"portfolios": json.dumps(portfolios)})
                    print(f"Added to portfolio stream with ID {portfolio_msg_id}")

            finally:
                conn.close()

if __name__ == "__main__":
    main()

