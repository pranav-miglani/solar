#!/bin/bash

# New Relic Setup Script for EC2 Deployment
# This script sets up New Relic APM and Infrastructure monitoring on EC2

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== New Relic Setup for EC2 ===${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}Please run as root or with sudo${NC}"
  exit 1
fi

# Get New Relic license key
read -sp "Enter your New Relic License Key: " NEW_RELIC_LICENSE_KEY
echo ""

if [ -z "$NEW_RELIC_LICENSE_KEY" ]; then
  echo -e "${RED}License key is required!${NC}"
  exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    echo -e "${RED}Cannot detect OS${NC}"
    exit 1
fi

echo -e "${GREEN}Detected OS: $OS $VER${NC}"

# Install New Relic Infrastructure Agent
echo -e "${YELLOW}Installing New Relic Infrastructure Agent...${NC}"

if [ "$OS" = "amzn" ] || [ "$OS" = "rhel" ] || [ "$OS" = "centos" ]; then
    # Amazon Linux / RHEL / CentOS
    curl -Ls https://download.newrelic.com/infrastructure_agent/linux/yum/el/7/x86_64/newrelic-infra-1.20.0-1.x86_64.rpm \
        -o /tmp/newrelic-infra.rpm
    rpm -Uvh /tmp/newrelic-infra.rpm
    
elif [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    # Ubuntu / Debian
    curl -Ls https://download.newrelic.com/infrastructure_agent/linux/apt/pool/main/n/newrelic-infra/newrelic-infra_1.20.0_amd64.deb \
        -o /tmp/newrelic-infra.deb
    dpkg -i /tmp/newrelic-infra.deb || apt-get install -f -y
    apt-get update
    apt-get install -y newrelic-infra
    
else
    echo -e "${RED}Unsupported OS: $OS${NC}"
    exit 1
fi

# Configure New Relic Infrastructure Agent
echo -e "${YELLOW}Configuring New Relic Infrastructure Agent...${NC}"

cat > /etc/newrelic-infra.yml <<EOF
license_key: ${NEW_RELIC_LICENSE_KEY}
display_name: $(hostname)
verbose: 0
log_file: /var/log/newrelic-infra/newrelic-infra.log
EOF

# Start and enable New Relic Infrastructure Agent
systemctl enable newrelic-infra
systemctl restart newrelic-infra

echo -e "${GREEN}✓ New Relic Infrastructure Agent installed and started${NC}"

# Install New Relic Nginx plugin (optional but recommended)
echo -e "${YELLOW}Setting up New Relic Nginx monitoring...${NC}"

# Check if Nginx is installed
if command -v nginx &> /dev/null; then
    echo -e "${GREEN}Nginx detected. Installing New Relic Nginx plugin...${NC}"
    
    # Create directory for nginx plugin
    mkdir -p /etc/newrelic-infra/plugins.d
    
    # Download nginx plugin
    cat > /etc/newrelic-infra/plugins.d/nginx.yml <<EOF
integrations:
  - name: nri-nginx
    env:
      STATUS_URL: http://127.0.0.1/nginx_status
      # If using custom status endpoint:
      # STATUS_URL: http://127.0.0.1:8080/nginx_status
EOF

    echo -e "${GREEN}✓ Nginx plugin configured${NC}"
    echo -e "${YELLOW}Note: Make sure Nginx status module is enabled in your nginx.conf${NC}"
else
    echo -e "${YELLOW}Nginx not found. Skipping Nginx plugin setup.${NC}"
fi

# Verify installation
echo ""
echo -e "${GREEN}=== Verification ===${NC}"
echo "Checking New Relic Infrastructure Agent status..."
if systemctl is-active --quiet newrelic-infra; then
    echo -e "${GREEN}✓ New Relic Infrastructure Agent is running${NC}"
else
    echo -e "${RED}✗ New Relic Infrastructure Agent is not running${NC}"
    echo "Check logs: journalctl -u newrelic-infra -n 50"
fi

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Set environment variables in your application:"
echo "   export NEW_RELIC_ENABLED=true"
echo "   export NEW_RELIC_LICENSE_KEY=${NEW_RELIC_LICENSE_KEY}"
echo "   export NEW_RELIC_APP_NAME='Solar Information System'"
echo ""
echo "2. Restart your application"
echo ""
echo "3. Check New Relic dashboard in 2-5 minutes:"
echo "   https://one.newrelic.com"
echo ""

