# EC2 Deployment with New Relic

This directory contains scripts and configuration files for deploying WOMS on EC2 with New Relic APM and Infrastructure monitoring.

## Files

- `newrelic-ec2-setup.sh` - Automated script to install and configure New Relic Infrastructure Agent
- `nginx-newrelic.conf` - Nginx configuration with New Relic integration
- `woms.service` - Systemd service file for the application
- `deploy-ec2.sh` - Complete deployment script for EC2
- `NEW_RELIC_EC2_SETUP.md` - Detailed setup guide

## Quick Start

### 1. Install New Relic Infrastructure Agent

```bash
cd terraform/ec2
sudo ./newrelic-ec2-setup.sh
```

### 2. Deploy Application

```bash
sudo ./deploy-ec2.sh
```

### 3. Configure Environment Variables

Edit `.env.production`:

```env
NEW_RELIC_ENABLED=true
NEW_RELIC_LICENSE_KEY=your_license_key
NEW_RELIC_APP_NAME=Solar Information System
```

### 4. Start Service

```bash
sudo systemctl start woms
sudo systemctl status woms
```

## Manual Setup

See [NEW_RELIC_EC2_SETUP.md](./NEW_RELIC_EC2_SETUP.md) for detailed step-by-step instructions.

## Architecture

```
Internet
   ↓
Nginx (Port 80/443)
   ↓ (with New Relic headers)
Next.js App (Port 3000)
   ↓
New Relic APM Agent
   ↓
New Relic Dashboard
```

## Monitoring

- **APM**: Application performance monitoring (Node.js app)
- **Infrastructure**: Server metrics (CPU, memory, disk, network)
- **Nginx**: Web server metrics (requests, response times)

All data flows to New Relic dashboard at [https://one.newrelic.com](https://one.newrelic.com)

