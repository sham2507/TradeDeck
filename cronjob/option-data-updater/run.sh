#!/bin/bash

export NVM_DIR="/root/.nvm"
source "$NVM_DIR/nvm.sh"

cd /root/trade-deck/cronjob/option-data-updater
export $(grep -v '^#' .env | xargs)

node src/index.js
