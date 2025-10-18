#!/bin/bash

cd /root/trade-deck/cronjob/backup-cron

# Load .env variables
export $(grep -v '^#' .env | xargs)

# Run Node.js script (use full Node path!)
/root/.nvm/versions/node/v22.16.0/bin/node main.js
