#!/bin/bash

# Deployment script for WOMS infrastructure
# Usage: ./deploy.sh [environment] [action]
# Example: ./deploy.sh prod apply

set -e

ENVIRONMENT=${1:-prod}
ACTION=${2:-plan}
REGION=${3:-us-east-1}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "$TERRAFORM_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}WOMS Terraform Deployment${NC}"
echo "Environment: ${ENVIRONMENT}"
echo "Action: ${ACTION}"
echo "Region: ${REGION}"
echo ""

# Check if terraform.tfvars exists
if [ ! -f "terraform.tfvars" ]; then
  echo -e "${YELLOW}⚠ terraform.tfvars not found. Creating from example...${NC}"
  cp terraform.tfvars.example terraform.tfvars
  echo -e "${YELLOW}Please edit terraform.tfvars with your values before proceeding.${NC}"
  exit 1
fi

# Initialize Terraform if needed
if [ ! -d ".terraform" ]; then
  echo -e "${GREEN}Initializing Terraform...${NC}"
  terraform init
fi

# Validate configuration
echo -e "${GREEN}Validating Terraform configuration...${NC}"
terraform validate

# Select action
case $ACTION in
  plan)
    echo -e "${GREEN}Running terraform plan...${NC}"
    terraform plan -var="environment=${ENVIRONMENT}" -var="aws_region=${REGION}"
    ;;
  apply)
    echo -e "${YELLOW}⚠ This will create/modify AWS resources.${NC}"
    read -p "Continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
      echo "Aborted."
      exit 1
    fi
    echo -e "${GREEN}Running terraform apply...${NC}"
    terraform apply -var="environment=${ENVIRONMENT}" -var="aws_region=${REGION}" -auto-approve
    echo ""
    echo -e "${GREEN}✓ Deployment complete!${NC}"
    echo ""
    echo "Application URL:"
    terraform output -raw application_url 2>/dev/null || terraform output load_balancer_dns
    ;;
  destroy)
    echo -e "${RED}⚠ WARNING: This will DESTROY all infrastructure!${NC}"
    read -p "Type 'yes' to confirm: " confirm
    if [ "$confirm" != "yes" ]; then
      echo "Aborted."
      exit 1
    fi
    echo -e "${RED}Destroying infrastructure...${NC}"
    terraform destroy -var="environment=${ENVIRONMENT}" -var="aws_region=${REGION}"
    ;;
  *)
    echo "Unknown action: ${ACTION}"
    echo "Usage: ./deploy.sh [environment] [plan|apply|destroy]"
    exit 1
    ;;
esac

