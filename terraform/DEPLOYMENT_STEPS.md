# Step-by-Step Deployment Guide

This guide walks you through deploying the Solar Information System (WOMS) to AWS using Terraform.

## Prerequisites Checklist

- [ ] AWS Account with admin access
- [ ] AWS CLI installed and configured
- [ ] Terraform >= 1.0 installed
- [ ] Docker installed
- [ ] Git repository cloned
- [ ] Supabase projects created (main DB and telemetry DB)

## Step 1: Install Prerequisites

### Install Terraform

**macOS:**
```bash
brew install terraform
```

**Linux:**
```bash
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
terraform version
```

**Windows:**
Download from [terraform.io/downloads](https://www.terraform.io/downloads)

### Install AWS CLI

**macOS:**
```bash
brew install awscli
```

**Linux:**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### Configure AWS Credentials

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter default region (e.g., us-east-1)
# Enter default output format (json)
```

Verify:
```bash
aws sts get-caller-identity
```

## Step 2: Create ECR Repository

```bash
# Replace with your AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"

# Create ECR repository
aws ecr create-repository \
  --repository-name woms \
  --region $REGION \
  --image-scanning-configuration scanOnPush=true

# Get login token
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com
```

## Step 3: Build and Push Docker Image

```bash
# Navigate to project root
cd /path/to/woms

# Build Docker image
docker build -t woms:latest -f terraform/Dockerfile .

# Tag for ECR
docker tag woms:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/woms:latest

# Push to ECR
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/woms:latest
```

## Step 4: Configure Terraform Variables

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
aws_region   = "us-east-1"
project_name = "woms"
environment  = "prod"

# Update with your ECR repository URL
ecr_repository_url = "123456789012.dkr.ecr.us-east-1.amazonaws.com/woms"
image_tag          = "latest"

# Adjust resource sizes as needed
task_cpu    = 2048
task_memory = 4096

desired_task_count = 2
min_task_count     = 1
max_task_count     = 10
```

## Step 5: Set Up Secrets in AWS Systems Manager

### Option A: Using the Setup Script (Recommended)

```bash
cd terraform/scripts
chmod +x setup-secrets.sh
./setup-secrets.sh prod us-east-1
```

Follow the prompts to enter your secrets.

### Option B: Using AWS CLI

```bash
# Set Supabase main database
aws ssm put-parameter \
  --name "/woms/prod/NEXT_PUBLIC_SUPABASE_URL" \
  --value "https://your-project.supabase.co" \
  --type "String" \
  --region us-east-1 \
  --overwrite

aws ssm put-parameter \
  --name "/woms/prod/NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --value "your-anon-key" \
  --type "SecureString" \
  --region us-east-1 \
  --overwrite

aws ssm put-parameter \
  --name "/woms/prod/SUPABASE_SERVICE_ROLE_KEY" \
  --value "your-service-role-key" \
  --type "SecureString" \
  --region us-east-1 \
  --overwrite

# Set Telemetry database
aws ssm put-parameter \
  --name "/woms/prod/TELEMETRY_SUPABASE_URL" \
  --value "https://your-telemetry-project.supabase.co" \
  --type "String" \
  --region us-east-1 \
  --overwrite

aws ssm put-parameter \
  --name "/woms/prod/TELEMETRY_SUPABASE_ANON_KEY" \
  --value "your-telemetry-anon-key" \
  --type "SecureString" \
  --region us-east-1 \
  --overwrite

aws ssm put-parameter \
  --name "/woms/prod/TELEMETRY_SUPABASE_SERVICE_ROLE_KEY" \
  --value "your-telemetry-service-role-key" \
  --type "SecureString" \
  --region us-east-1 \
  --overwrite

# Generate and set CRON_SECRET
CRON_SECRET=$(openssl rand -hex 32)
aws ssm put-parameter \
  --name "/woms/prod/CRON_SECRET" \
  --value "$CRON_SECRET" \
  --type "SecureString" \
  --region us-east-1 \
  --overwrite

# Optional: New Relic
aws ssm put-parameter \
  --name "/woms/prod/NEW_RELIC_ENABLED" \
  --value "false" \
  --type "String" \
  --region us-east-1 \
  --overwrite
```

### Option C: Using AWS Console

1. Go to AWS Systems Manager → Parameter Store
2. Create parameters with paths like `/woms/prod/NEXT_PUBLIC_SUPABASE_URL`
3. Set appropriate types (String or SecureString)

## Step 6: Initialize Terraform

```bash
cd terraform
terraform init
```

This downloads the AWS provider and initializes the backend.

## Step 7: Review Deployment Plan

```bash
terraform plan
```

Review the output carefully. It should show:
- VPC and networking resources
- ECS cluster and service
- Load balancer
- Security groups
- IAM roles
- CloudWatch log groups

## Step 8: Deploy Infrastructure

```bash
# Using deployment script
cd scripts
./deploy.sh prod apply

# Or directly with Terraform
cd ..
terraform apply
```

Type `yes` when prompted.

**Expected time:** 10-15 minutes

## Step 9: Verify Deployment

### Get Application URL

```bash
terraform output application_url
# or
terraform output load_balancer_dns
```

### Check ECS Service Status

```bash
aws ecs describe-services \
  --cluster woms-prod-cluster \
  --services woms-prod-service \
  --region us-east-1
```

### View Logs

```bash
aws logs tail /ecs/woms-prod --follow --region us-east-1
```

### Test Health Endpoint

```bash
curl http://$(terraform output -raw load_balancer_dns)/api/health
```

Should return: `{"status":"ok","timestamp":"..."}`

## Step 10: Update Application (Future Deployments)

### Build and Push New Image

```bash
# Build
docker build -t woms:v1.0.1 -f terraform/Dockerfile .

# Tag
docker tag woms:v1.0.1 $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/woms:v1.0.1

# Push
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/woms:v1.0.1
```

### Update Terraform

```bash
# Edit terraform.tfvars
image_tag = "v1.0.1"

# Apply
terraform apply
```

ECS will automatically deploy the new image.

## Troubleshooting

### Issue: Terraform fails with "Access Denied"

**Solution:** Verify AWS credentials and IAM permissions:
```bash
aws sts get-caller-identity
```

### Issue: ECS tasks not starting

**Check:**
1. CloudWatch Logs: `aws logs tail /ecs/woms-prod --follow`
2. ECS service events: AWS Console → ECS → Services
3. SSM parameters are set correctly
4. Security groups allow outbound traffic

### Issue: Application not responding

**Check:**
1. Load balancer target group health
2. Security group rules (ALB → ECS)
3. Application logs in CloudWatch
4. Health check endpoint exists

### Issue: High costs

**Optimize:**
1. Reduce `desired_task_count` for dev/staging
2. Use smaller task sizes (`task_cpu`, `task_memory`)
3. Consider single AZ for dev environments
4. Review CloudWatch Logs retention

## Cleanup (Destroy Infrastructure)

⚠️ **Warning:** This deletes ALL resources!

```bash
terraform destroy
```

Or using the script:
```bash
./scripts/deploy.sh prod destroy
```

## Next Steps

1. **Set up HTTPS** (see README.md)
2. **Configure domain** (Route53 or external DNS)
3. **Set up monitoring alerts** (CloudWatch Alarms)
4. **Configure backup strategy** (for Supabase databases)
5. **Set up CI/CD** (GitHub Actions, GitLab CI, etc.)

## Additional Resources

- [Terraform Documentation](https://www.terraform.io/docs)
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)

