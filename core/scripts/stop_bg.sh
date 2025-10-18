#!/bin/bash

pkill -f latest_info_updater.py
pkill -f place_order_service.py
pkill -f point_of_adjustment_service.py
pkill -f sl_service.py
pkill -f tp_service.py
pkill -f trade_sync.py

echo "All background Python scripts stopped."
