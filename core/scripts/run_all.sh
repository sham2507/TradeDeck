#!/bin/bash

# Activate virtual environment if needed
source myenv/bin/activate

# Run all Python scripts in parallel
echo "Starting all Python scripts..."

python3 latest_info_updater.py & 
python3 place_order_service.py &
python3 point_of_adjustment_service.py &
python3 sl_service.py &
python3 tp_service.py &
python3 trade_sync.py &

echo "All Python scripts launched."

# Optional: wait for all background processes to finish (remove if you don't want to wait)
