#!/bin/bash

# Quick Setup Script for New Relic on EC2
# This script guides you through the complete setup process

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   New Relic Setup for WOMS on EC2                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Get New Relic License Key
echo -e "${YELLOW}Step 1: New Relic License Key${NC}"
echo "If you don't have a license key:"
echo "  1. Sign up at https://newrelic.com/signup"
echo "  2. Go to Account Settings → API Keys"
echo "  3. Copy your License Key"
echo ""
read -sp "Enter your New Relic License Key: " LICENSE_KEY
echo ""

if [ -z "$LICENSE_KEY" ]; then
  echo -e "${RED}License key is required!${NC}"
  exit 1
fi

# Step 2: Install Infrastructure Agent
echo ""
echo -e "${YELLOW}Step 2: Installing New Relic Infrastructure Agent...${NC}"
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}Running with sudo...${NC}"
  sudo bash -c "NEW_RELIC_LICENSE_KEY='$LICENSE_KEY' bash -s" < <(cat <<'EOF'
    # Install Infrastructure Agent
    if command -v yum &> /dev/null; then
      curl -Ls https://download.newrelic.com/infrastructure_agent/linux/yum/el/7/x86_64/newrelic-infra-1.20.0-1.x86_64.rpm -o /tmp/newrelic-infra.rpm
      rpm -Uvh /tmp/newrelic-infra.rpm
    elif command -v apt-get &> /dev/null; then
      curl -Ls https://download.newrelic.com/infrastructure_agent/linux/apt/pool/main/n/newrelic-infra/newrelic-infra_1.20.0_amd64.deb -o /tmp/newrelic-infra.deb
      dpkg -i /tmp/newrelic-infra.deb || apt-get install -f -y
    fi
    
    # Configure
    cat > /etc/newrelic-infra.yml <<YAML
license_key: ${NEW_RELIC_LICENSE_KEY}
display_name: $(hostname)
verbose: 0
YAML
    
    # Start service
    systemctl enable newrelic-infra
    systemctl restart newrelic-infra
    echo "✓ Infrastructure Agent installed"
EOF
)
else
  echo -e "${RED}Please run as non-root user (script will use sudo when needed)${NC}"
  exit 1
fi

# Step 3: Configure Application
echo ""
echo -e "${YELLOW}Step 3: Configuring Application...${NC}"

APP_DIR="/home/ec2-user/woms"
ENV_FILE="$APP_DIR/.env.production"

if [ ! -f "$ENV_FILE" ]; then
  echo "Creating .env.production file..."
  touch "$ENV_FILE"
fi

# Update or add New Relic variables
if grep -q "NEW_RELIC_ENABLED" "$ENV_FILE"; then
  sed -i 's/^NEW_RELIC_ENABLED=.*/NEW_RELIC_ENABLED=true/' "$ENV_FILE"
else
  echo "NEW_RELIC_ENABLED=true" >> "$ENV_FILE"
fi

if grep -q "NEW_RELIC_LICENSE_KEY" "$ENV_FILE"; then
  sed -i "s|^NEW_RELIC_LICENSE_KEY=.*|NEW_RELIC_LICENSE_KEY=$LICENSE_KEY|" "$ENV_FILE"
else
  echo "NEW_RELIC_LICENSE_KEY=$LICENSE_KEY" >> "$ENV_FILE"
fi

if ! grep -q "NEW_RELIC_APP_NAME" "$ENV_FILE"; then
  echo "NEW_RELIC_APP_NAME=Solar Information System" >> "$ENV_FILE"
fi

if ! grep -q "NEW_RELIC_LABELS" "$ENV_FILE"; then
  echo "NEW_RELIC_LABELS=environment:production,deployment:ec2" >> "$ENV_FILE"
fi

echo -e "${GREEN}✓ Application configured${NC}"

# Step 4: Verify Setup
echo ""
echo -e "${YELLOW}Step 4: Verifying Setup...${NC}"

# Check Infrastructure Agent
if systemctl is-active --quiet newrelic-infra 2>/dev/null; then
  echo -e "${GREEN}✓ Infrastructure Agent is running${NC}"
else
  echo -e "${RED}✗ Infrastructure Agent is not running${NC}"
  echo "  Check: sudo systemctl status newrelic-infra"
fi

# Check newrelic.js
if [ -f "$APP_DIR/newrelic.js" ]; then
  echo -e "${GREEN}✓ newrelic.js found${NC}"
else
  echo -e "${RED}✗ newrelic.js not found in $APP_DIR${NC}"
fi

# Check environment variables
if grep -q "NEW_RELIC_ENABLED=true" "$ENV_FILE" && grep -q "NEW_RELIC_LICENSE_KEY=$LICENSE_KEY" "$ENV_FILE"; then
  echo -e "${GREEN}✓ Environment variables configured${NC}"
else
  echo -e "${YELLOW}⚠ Please verify environment variables in $ENV_FILE${NC}"
fi

# Step 5: Instructions
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Setup Complete!                                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Restart your application:"
echo "   sudo systemctl restart woms"
echo ""
echo "2. Check application logs:"
echo "   sudo journalctl -u woms -f | grep -i newrelic"
echo ""
echo "3. Verify in New Relic dashboard (wait 2-5 minutes):"
echo "   https://one.newrelic.com"
echo "   → APM & Services → Applications"
echo "   → Infrastructure → Hosts"
echo ""
echo "4. (Optional) Configure Nginx monitoring:"
echo "   See: terraform/ec2/NEW_RELIC_EC2_SETUP.md"
echo ""
echo "For troubleshooting, see:"
echo "   terraform/ec2/TROUBLESHOOTING.md"
echo ""

