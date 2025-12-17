#!/bin/bash

# EC2 Deployment Script for WOMS with New Relic Integration
# This script sets up the application on EC2 with proper New Relic configuration

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== WOMS EC2 Deployment Script ===${NC}"
echo ""

# Check if running as ec2-user or with sudo
if [ "$USER" != "ec2-user" ] && [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as ec2-user or with sudo${NC}"
  exit 1
fi

APP_DIR="/home/ec2-user/woms"
SERVICE_FILE="/etc/systemd/system/woms.service"
NGINX_CONF="/etc/nginx/conf.d/woms.conf"

# Step 1: Check prerequisites
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found. Please install Node.js 18+ first.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm not found. Please install npm first.${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Node.js version 18+ required. Current: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"

# Step 2: Setup application directory
echo -e "${YELLOW}Step 2: Setting up application directory...${NC}"

if [ ! -d "$APP_DIR" ]; then
    echo "Creating application directory..."
    mkdir -p "$APP_DIR"
fi

cd "$APP_DIR"

# Step 3: Install dependencies
echo -e "${YELLOW}Step 3: Installing dependencies...${NC}"

if [ -f "package.json" ]; then
    npm ci --production=false
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${RED}package.json not found in $APP_DIR${NC}"
    exit 1
fi

# Step 4: Build application
echo -e "${YELLOW}Step 4: Building application...${NC}"

export NODE_OPTIONS='--max-old-space-size=4096'
npm run build

echo -e "${GREEN}✓ Application built${NC}"

# Step 5: Setup environment variables
echo -e "${YELLOW}Step 5: Setting up environment variables...${NC}"

ENV_FILE="$APP_DIR/.env.production"

if [ ! -f "$ENV_FILE" ]; then
    echo "Creating .env.production file..."
    cat > "$ENV_FILE" <<EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Telemetry Database
TELEMETRY_SUPABASE_URL=
TELEMETRY_SUPABASE_ANON_KEY=
TELEMETRY_SUPABASE_SERVICE_ROLE_KEY=

# New Relic Configuration
NEW_RELIC_ENABLED=true
NEW_RELIC_LICENSE_KEY=
NEW_RELIC_APP_NAME=Solar Information System
NEW_RELIC_LABELS=environment:production,deployment:ec2

# Application Configuration
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# Cron Configuration
ENABLE_LIVE_TELEMETRY_SYNC_CRON=true
CRON_SECRET=
EOF
    echo -e "${YELLOW}⚠ Created $ENV_FILE - Please update with your actual values!${NC}"
    echo "Edit the file: nano $ENV_FILE"
    read -p "Press Enter after updating environment variables..."
else
    echo -e "${GREEN}✓ Environment file exists${NC}"
fi

# Step 6: Verify New Relic configuration
echo -e "${YELLOW}Step 6: Verifying New Relic configuration...${NC}"

if [ ! -f "$APP_DIR/newrelic.js" ]; then
    echo -e "${RED}newrelic.js not found!${NC}"
    exit 1
fi

# Check if New Relic license key is set
source "$ENV_FILE"
if [ -z "$NEW_RELIC_LICENSE_KEY" ] || [ "$NEW_RELIC_LICENSE_KEY" = "" ]; then
    echo -e "${YELLOW}⚠ NEW_RELIC_LICENSE_KEY not set in .env.production${NC}"
    echo "New Relic will not work without a license key."
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓ New Relic license key configured${NC}"
fi

# Step 7: Setup systemd service
echo -e "${YELLOW}Step 7: Setting up systemd service...${NC}"

if [ "$EUID" -eq 0 ]; then
    cp "$APP_DIR/terraform/ec2/woms.service" "$SERVICE_FILE"
    systemctl daemon-reload
    echo -e "${GREEN}✓ Systemd service installed${NC}"
else
    echo -e "${YELLOW}⚠ Not running as root. Skipping systemd service setup.${NC}"
    echo "To install the service, run:"
    echo "  sudo cp $APP_DIR/terraform/ec2/woms.service $SERVICE_FILE"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable woms"
    echo "  sudo systemctl start woms"
fi

# Step 8: Setup Nginx (if root)
if [ "$EUID" -eq 0 ] && command -v nginx &> /dev/null; then
    echo -e "${YELLOW}Step 8: Setting up Nginx...${NC}"
    
    # Create Nginx config directory if it doesn't exist
    mkdir -p /etc/nginx/conf.d
    
    # Copy Nginx configuration
    if [ -f "$APP_DIR/terraform/ec2/nginx-newrelic.conf" ]; then
        cp "$APP_DIR/terraform/ec2/nginx-newrelic.conf" "$NGINX_CONF"
        echo -e "${GREEN}✓ Nginx configuration installed${NC}"
        echo -e "${YELLOW}⚠ Please review and update $NGINX_CONF with your domain${NC}"
        echo "Then test and reload Nginx:"
        echo "  sudo nginx -t"
        echo "  sudo systemctl reload nginx"
    else
        echo -e "${YELLOW}⚠ Nginx config file not found at $APP_DIR/terraform/ec2/nginx-newrelic.conf${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Skipping Nginx setup (not root or Nginx not installed)${NC}"
fi

# Step 9: Final instructions
echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Verify environment variables in $ENV_FILE"
echo ""
echo "2. Start the service:"
if [ "$EUID" -eq 0 ]; then
    echo "   sudo systemctl start woms"
    echo "   sudo systemctl status woms"
else
    echo "   sudo systemctl start woms"
    echo "   sudo systemctl status woms"
fi
echo ""
echo "3. Enable auto-start on boot:"
echo "   sudo systemctl enable woms"
echo ""
echo "4. Check logs:"
echo "   sudo journalctl -u woms -f"
echo ""
echo "5. Verify New Relic is working:"
echo "   - Check application logs for New Relic initialization"
echo "   - Visit https://one.newrelic.com in 2-5 minutes"
echo ""
echo "6. Configure Nginx (if using):"
echo "   sudo nano $NGINX_CONF"
echo "   sudo nginx -t"
echo "   sudo systemctl reload nginx"
echo ""

