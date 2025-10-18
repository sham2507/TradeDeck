import redis
import psycopg2
import json
import time
from datetime import datetime
import pytz
import os
from dotenv import load_dotenv

# Load DB credentials from .env
load_dotenv()

def serialize_row(row, columns):
    result = {}
    for col, val in zip(columns, row):
        if isinstance(val, datetime):
            result[col] = val.isoformat()
        else:
            result[col] = val
    return result

def sync_trades():
    r = redis.Redis(host='localhost', port=6379, decode_responses=True)
    stream_key = 'tradeStream'

    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432")
    )

    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT * FROM "TradeDetails"
                WHERE alive = TRUE AND "isDeleted" = FALSE
            """)
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            trades = [serialize_row(row, columns) for row in rows]

            # Remove previous stream entry if exists
            stream_entries = r.xrevrange(stream_key, count=1)
            if stream_entries:
                last_entry_id = stream_entries[0][0]
                r.xdel(stream_key, last_entry_id)
                print(f"Removed previous stream entry: {last_entry_id}")

            # Add new entry to stream
            message_id = r.xadd(stream_key, {"trades": json.dumps(trades)})
            print(f"[{datetime.now().strftime('%H:%M:%S')}] Synced trades to stream with ID {message_id}")
    finally:
        conn.close()

def is_within_time_window():
    ist = pytz.timezone('Asia/Kolkata')
    now = datetime.now(ist)

    start_time = now.replace(hour=8, minute=55, second=0, microsecond=0)
    end_time = now.replace(hour=15, minute=35, second=0, microsecond=0)

    if end_time <= start_time:
        return now >= start_time or now <= end_time
    else:
        return start_time <= now <= end_time

if __name__ == "__main__":
    print("Starting Trade Sync Service (Active 08:55 AM - 3:35 PM IST)...")
    while True:
        if is_within_time_window():
            sync_trades()
        else:
            print("Outside time window.")
        time.sleep(10)

