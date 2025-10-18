# TradeDeck Deployment Guide

## 1. GitHub Access Setup

### Generate SSH Key
```bash
ssh-keygen -t ed25519 -C "deploy-key-for-my-repo"
```

Add the generated key to GitHub deploy keys in repository settings, then clone the repository.

## 2. System Dependencies Installation

### Node.js Installation
```bash
# Download and install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# Reload shell environment
\. "$HOME/.nvm/nvm.sh"

# Install Node.js version 22
nvm install 22

# Verify installations
node -v # Should print "v22.19.0"
npm -v  # Should print "10.9.3"
```

### Redis Installation
```bash
sudo apt update
sudo apt install redis-server -y

# Enable and start Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Check status and test
sudo systemctl status redis-server
redis-cli ping
```

### UFW Firewall Setup
```bash
# Install UFW
sudo apt install ufw -y

# Configure allowed ports
sudo ufw allow ssh
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Nginx Installation
```bash
# Install Nginx
sudo apt install nginx -y

# Enable and start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Check status
sudo systemctl status nginx

# Configure UFW for Nginx
sudo ufw allow 'Nginx Full'
```

## 3. PostgreSQL Installation

### Install PostgreSQL
```bash
sudo apt install postgresql postgresql-contrib -y

# Check status
sudo systemctl status postgresql

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Database Setup
```bash
# Switch to postgres user
sudo -i -u postgres
psql

# Create user and database
CREATE USER admin WITH PASSWORD '!TRADEDECK!@2025%*&';
CREATE DATABASE yourdb OWNER admin;
GRANT ALL PRIVILEGES ON DATABASE yourdb TO admin;
ALTER USER admin CREATEDB;

# Exit PostgreSQL
\q
exit

# Restart PostgreSQL
sudo systemctl restart postgresql

# Test connection
psql -U admin -d yourdb -h localhost
```

## 4. Install Dependencies

Run `npm i` in all project folders.

## 5. Core Service Initialization

### System Update and Python Environment
```bash
sudo apt update

# Install Python dependencies
sudo apt install python3 python3-venv python3-pip

# Create virtual environment
python3 -m venv myenv

# Activate virtual environment
source myenv/bin/activate

# Install Python packages
pip install -r requirements.txt

# To deactivate virtual environment
deactivate
```

## 6. PM2 Installation

```bash
sudo npm install -g pm2
```

## 7. Services Setup and Environment Configuration

### Environment Configuration
Set up `.env` files in the following directories:
- backend
- core
- cron (all three services)
- price data
- price data fe
- ws frontend

### Service Deployment

#### Backend Service
```bash
npm i && npm run build
npx prisma migrate dev
npx prisma generate
pm2 start ./dist/index.js --name "backend"
```

#### Core Price Service
```bash
# In root directory
npm i
# In xts folder
cd xts && npm i
pm2 start index.js --name "core-price"
```

#### FE Price Service
```bash
# In root directory
npm i
# In xts folder
cd xts && npm i
pm2 start server.js --name "fe-price"
```

#### WS Frontend Service
```bash
# In root directory
npm i
# In xts folder
cd xts && npm i
pm2 start index.js --name "ws-frontend"
```

#### Core Python Services
```bash
# Activate virtual environment
source myenv/bin/activate

# Start Python services with PM2
pm2 start latest_info_updater.py --interpreter /root/trade-deck/core/myenv/bin/python
pm2 start point_of_adjustment_service.py --interpreter /root/trade-deck/core/myenv/bin/python
pm2 start place_order_service.py --interpreter /root/trade-deck/core/myenv/bin/python
pm2 start sl_service.py --interpreter /root/trade-deck/core/myenv/bin/python
pm2 start tp_service.py --interpreter /root/trade-deck/core/myenv/bin/python
```

## 8. Nginx Configuration

### API Backend Configuration
```bash
sudo nano /etc/nginx/sites-available/api.tradedeck.narendira.in
```

```nginx
server {
    listen 80;
    server_name api.tradedeck.narendira.in;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/api.tradedeck.narendira.in /etc/nginx/sites-enabled/
```

### FE Socket Configuration
```bash
sudo nano /etc/nginx/sites-available/fesocket.tradedeck.narendira.in
```

```nginx
server {
    listen 80;
    server_name fesocket.tradedeck.narendira.in;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3002/socket.io/;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/fesocket.tradedeck.narendira.in /etc/nginx/sites-enabled/
```

### Main Socket Configuration
```bash
sudo nano /etc/nginx/sites-available/mainsocket.tradedeck.narendira.in
```

```nginx
server {
    listen 80;
    server_name mainsocket.tradedeck.narendira.in;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3001/socket.io/;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/mainsocket.tradedeck.narendira.in /etc/nginx/sites-enabled/
```

### WSS Frontend Configuration
```bash
sudo nano /etc/nginx/sites-available/wssfrontend.tradedeck.narendira.in
```

```nginx
server {
    listen 80;
    server_name wssfrontend.tradedeck.narendira.in;

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3003/socket.io/;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/wssfrontend.tradedeck.narendira.in /etc/nginx/sites-enabled/

# Restart Nginx
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx
```

## 10. SSL Certificate Installation

### Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y

# Generate certificate and configure
sudo certbot --nginx
```

## 11. Cron Job Configuration

### Check Timezone
```bash
timedatectl
```

### Setup Cron Jobs
```bash
sudo crontab -e
```

Add the following cron configuration:

```cron
# Options data fetcher run every day @ 08:35 AM IST
5 5 * * * /root/trade-deck/cronjob/option-data-updater/run.sh >> /root/trade-deck/cronjob/option-data-updater/cron.log 2>&1

# Options strike interval fetcher run every day @ 8:40 AM IST
10 5 * * * /root/trade-deck/cronjob/calculate-strike-interval/run.sh >> /root/trade-deck/cronjob/calculate-strike-interval/cron.log 2>&1

# Backup cron run every 4 hours
0 */4 * * * /root/trade-deck/cronjob/backup-cron/run.sh >> /root/trade-deck/cronjob/backup-cron/cron.log 2>&1

# Start fe-price and main price socket.io @ 8:40 AM IST
10 5 * * * PATH=/root/.nvm/versions/node/v22.17.1/bin:$PATH /root/.nvm/versions/node/v22.17.1/bin/pm2 start 11 12 2 >> /root/cron-logs/pm2-start.log 2>&1

# Stop fe-price and main price @ 3:50 PM IST
20 12 * * * PATH=/root/.nvm/versions/node/v22.17.1/bin:$PATH /root/.nvm/versions/node/v22.17.1/bin/pm2 stop 11 12 2 >> /root/cron-logs/pm2-stop.log 2>&1

# Start core service at 8:50 AM IST
20 5 * * * PATH=/root/.nvm/versions/node/v22.17.1/bin:$PATH /root/.nvm/versions/node/v22.17.1/bin/pm2 start 5 6 7 8 >> /root/cron-logs/pm2-start-4-7.log 2>&1

# Core services stop at 3:45 PM IST
15 12 * * * PATH=/root/.nvm/versions/node/v22.17.1/bin:$PATH /root/.nvm/versions/node/v22.17.1/bin/pm2 stop 5 6 7 8 >> /root/cron-logs/pm2-stop-4-7.log 2>&1
```

### Verify Cron Setup
```bash
# Check cron list
crontab -l

# Check cron service status
systemctl status cron
```

## Summary

This deployment guide covers the complete setup of the TradeDeck application including:
- System dependencies (Node.js, Redis, PostgreSQL, Nginx)
- Security configuration (UFW firewall)
- Application services deployment
- Reverse proxy configuration
- SSL certificate setup
- Automated task scheduling

Ensure all environment variables are properly configured before starting the services.
