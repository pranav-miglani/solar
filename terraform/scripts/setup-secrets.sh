#!/bin/bash

# Script to set up AWS SSM Parameters for WOMS deployment
# Usage: ./setup-secrets.sh <environment> [region]
# Example: ./setup-secrets.sh prod us-east-1

set -e

ENVIRONMENT=${1:-prod}
REGION=${2:-us-east-1}
PROJECT_NAME="woms"

echo "Setting up SSM Parameters for ${PROJECT_NAME}/${ENVIRONMENT} in ${REGION}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to set parameter
set_parameter() {
  local name=$1
  local value=$2
  local type=${3:-String}
  local description=$4

  if [ -z "$value" ]; then
    echo -e "${YELLOW}⚠ Skipping ${name} (value not provided)${NC}"
    return
  fi

  echo -e "${GREEN}Setting ${name}...${NC}"
  aws ssm put-parameter \
    --name "/${PROJECT_NAME}/${ENVIRONMENT}/${name}" \
    --value "${value}" \
    --type "${type}" \
    --description "${description}" \
    --region "${REGION}" \
    --overwrite \
    > /dev/null 2>&1

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ${name} set successfully${NC}"
  else
    echo -e "${RED}✗ Failed to set ${name}${NC}"
    exit 1
  fi
}

# Read values from user or environment
echo ""
echo "Enter values for SSM Parameters (press Enter to skip):"
echo ""

# Supabase Main Database
read -p "NEXT_PUBLIC_SUPABASE_URL: " SUPABASE_URL
read -p "NEXT_PUBLIC_SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY
read -sp "SUPABASE_SERVICE_ROLE_KEY (hidden): " SUPABASE_SERVICE_ROLE_KEY
echo ""

# Telemetry Database
read -p "TELEMETRY_SUPABASE_URL: " TELEMETRY_SUPABASE_URL
read -p "TELEMETRY_SUPABASE_ANON_KEY: " TELEMETRY_ANON_KEY
read -sp "TELEMETRY_SUPABASE_SERVICE_ROLE_KEY (hidden): " TELEMETRY_SERVICE_ROLE_KEY
echo ""

# Cron Secret
read -sp "CRON_SECRET (hidden, or press Enter to generate): " CRON_SECRET
echo ""
if [ -z "$CRON_SECRET" ]; then
  CRON_SECRET=$(openssl rand -hex 32)
  echo -e "${GREEN}Generated CRON_SECRET: ${CRON_SECRET}${NC}"
fi

# New Relic (optional)
read -p "NEW_RELIC_ENABLED (true/false, default: false): " NEW_RELIC_ENABLED
NEW_RELIC_ENABLED=${NEW_RELIC_ENABLED:-false}

if [ "$NEW_RELIC_ENABLED" = "true" ]; then
  read -sp "NEW_RELIC_LICENSE_KEY (hidden): " NEW_RELIC_LICENSE_KEY
  echo ""
else
  NEW_RELIC_LICENSE_KEY=""
fi

# Vendor API URLs (optional)
read -p "INTELLO_API_BASE_URL (optional): " INTELLO_API_BASE_URL
read -p "TRACKSO_API_BASE_URL (optional): " TRACKSO_API_BASE_URL
read -p "SCADA_API_BASE_URL (optional): " SCADA_API_BASE_URL

echo ""
echo "Setting parameters..."

# Set all parameters
set_parameter "NEXT_PUBLIC_SUPABASE_URL" "$SUPABASE_URL" "String" "Supabase URL for main database"
set_parameter "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY" "SecureString" "Supabase anon key"
set_parameter "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY" "SecureString" "Supabase service role key"

set_parameter "TELEMETRY_SUPABASE_URL" "$TELEMETRY_SUPABASE_URL" "String" "Supabase URL for telemetry database"
set_parameter "TELEMETRY_SUPABASE_ANON_KEY" "$TELEMETRY_ANON_KEY" "SecureString" "Telemetry Supabase anon key"
set_parameter "TELEMETRY_SUPABASE_SERVICE_ROLE_KEY" "$TELEMETRY_SERVICE_ROLE_KEY" "SecureString" "Telemetry Supabase service role key"

set_parameter "CRON_SECRET" "$CRON_SECRET" "SecureString" "Secret for cron job authentication"

set_parameter "NEW_RELIC_ENABLED" "$NEW_RELIC_ENABLED" "String" "Enable New Relic APM"

if [ "$NEW_RELIC_ENABLED" = "true" ] && [ -n "$NEW_RELIC_LICENSE_KEY" ]; then
  set_parameter "NEW_RELIC_LICENSE_KEY" "$NEW_RELIC_LICENSE_KEY" "SecureString" "New Relic license key"
fi

if [ -n "$INTELLO_API_BASE_URL" ]; then
  set_parameter "INTELLO_API_BASE_URL" "$INTELLO_API_BASE_URL" "String" "Intello API base URL"
fi

if [ -n "$TRACKSO_API_BASE_URL" ]; then
  set_parameter "TRACKSO_API_BASE_URL" "$TRACKSO_API_BASE_URL" "String" "Trackso API base URL"
fi

if [ -n "$SCADA_API_BASE_URL" ]; then
  set_parameter "SCADA_API_BASE_URL" "$SCADA_API_BASE_URL" "String" "SCADA API base URL"
fi

echo ""
echo -e "${GREEN}✓ All parameters set successfully!${NC}"
echo ""
echo "You can now run: terraform apply"

