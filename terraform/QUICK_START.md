# Quick Start Guide - Terraform Deployment

## 🚀 Fastest Path to Deployment

### 1. Prerequisites (5 minutes)

```bash
# Install Terraform
brew install terraform  # macOS
# or download from https://www.terraform.io/downloads

# Install AWS CLI
brew install awscli  # macOS
# or download from https://aws.amazon.com/cli/

# Configure AWS
aws configure
```

### 2. Create ECR Repository (2 minutes)

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="us-east-1"

aws ecr create-repository --repository-name woms --region $REGION
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com
```

### 3. Build & Push Docker Image (5 minutes)

```bash
cd /path/to/woms
docker build -t woms:latest -f terraform/Dockerfile .
docker tag woms:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/woms:latest
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/woms:latest
```

### 4. Configure Terraform (2 minutes)

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
- Set `ecr_repository_url` to: `$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/woms`
- Adjust `aws_region` if needed

### 5. Set Secrets (5 minutes)

```bash
cd scripts
chmod +x setup-secrets.sh
./setup-secrets.sh prod us-east-1
```

Enter your Supabase credentials when prompted.

### 6. Deploy (15 minutes)

```bash
cd terraform
terraform init
terraform plan  # Review the plan
terraform apply  # Type 'yes' to confirm
```

### 7. Get Your URL

```bash
terraform output application_url
```

## 📋 What Gets Created

- ✅ VPC with public/private subnets
- ✅ ECS Fargate cluster
- ✅ Application Load Balancer
- ✅ Auto-scaling (1-10 tasks)
- ✅ CloudWatch Logs
- ✅ Security Groups
- ✅ IAM Roles

## 🔄 Updating the Application

```bash
# 1. Build new image
docker build -t woms:v1.0.1 -f terraform/Dockerfile .
docker tag woms:v1.0.1 $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/woms:v1.0.1
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/woms:v1.0.1

# 2. Update terraform.tfvars
# image_tag = "v1.0.1"

# 3. Apply
terraform apply
```

## 🆘 Troubleshooting

**Can't connect to application?**
```bash
# Check ECS service
aws ecs describe-services --cluster woms-prod-cluster --services woms-prod-service

# Check logs
aws logs tail /ecs/woms-prod --follow
```

**Tasks not starting?**
- Verify SSM parameters are set: `aws ssm get-parameters-by-path --path "/woms/prod/"`
- Check CloudWatch logs for errors

## 📚 Full Documentation

- [DEPLOYMENT_STEPS.md](./DEPLOYMENT_STEPS.md) - Detailed step-by-step guide
- [README.md](./README.md) - Complete documentation

## 💰 Estimated Costs

**Development:**
- ~$50-100/month (single task, minimal usage)

**Production:**
- ~$200-400/month (2 tasks, standard usage)
- Can scale up to 10 tasks (~$1000/month at max)

*Costs vary based on traffic, data transfer, and CloudWatch logs retention*

