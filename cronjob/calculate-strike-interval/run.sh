#!/bin/bash

export NVM_DIR="/root/.nvm"
source "$NVM_DIR/nvm.sh"

cd /root/trade-deck/cronjob/calculate-strike-interval
export $(grep -v '^#' .env | xargs)

node src/index.js
