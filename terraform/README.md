# Terraform Infrastructure for Solar Information System

This directory contains Terraform configuration files to deploy the Solar Information System (WOMS) on AWS using ECS Fargate.

## Architecture

The infrastructure includes:

- **VPC**: Custom VPC with public and private subnets across multiple availability zones
- **ECS Fargate**: Containerized application deployment
- **Application Load Balancer**: HTTP/HTTPS traffic distribution
- **Auto Scaling**: Automatic scaling based on CPU utilization
- **CloudWatch Logs**: Centralized logging
- **AWS Systems Manager Parameter Store**: Secure storage for environment variables and secrets
- **Security Groups**: Network-level security controls
- **NAT Gateways**: Outbound internet access for private subnets

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Terraform** >= 1.0 installed ([Installation Guide](https://learn.hashicorp.com/tutorials/terraform/install-cli))
3. **AWS CLI** configured with credentials ([Setup Guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html))
4. **Docker** installed (for building container images)
5. **ECR Repository** created (or we'll create it)

## Quick Start

### 1. Install Terraform

```bash
# macOS
brew install terraform

# Linux
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# Verify installation
terraform version
```

### 2. Configure AWS Credentials

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter default region (e.g., us-east-1)
# Enter default output format (json)
```

### 3. Create ECR Repository (if not exists)

```bash
aws ecr create-repository --repository-name woms --region us-east-1
```

### 4. Build and Push Docker Image

```bash
# Get ECR login token
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build image
cd /path/to/woms
docker build -t woms:latest -f terraform/Dockerfile .

# Tag image
docker tag woms:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/woms:latest

# Push image
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/woms:latest
```

### 5. Configure Terraform Variables

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
```

Update `terraform.tfvars`:
- `ecr_repository_url`: Your ECR repository URL
- `aws_region`: Your preferred AWS region
- `environment`: dev, staging, or prod

### 6. Update Secrets in SSM Parameter Store

Before deploying, you need to set the actual values for secrets in AWS Systems Manager Parameter Store. You can do this via:

**Option A: AWS Console**
1. Go to AWS Systems Manager → Parameter Store
2. Update each parameter created by Terraform with actual values

**Option B: AWS CLI**
```bash
# Set Supabase URL
aws ssm put-parameter \
  --name "/woms/prod/NEXT_PUBLIC_SUPABASE_URL" \
  --value "https://your-project.supabase.co" \
  --type "String" \
  --overwrite

# Set Supabase Service Role Key (SecureString)
aws ssm put-parameter \
  --name "/woms/prod/SUPABASE_SERVICE_ROLE_KEY" \
  --value "your-service-role-key" \
  --type "SecureString" \
  --overwrite

# Repeat for all other parameters
```

**Option C: Update secrets.tf and re-apply**
Edit `secrets.tf` and replace `CHANGE_ME` with actual values, then run `terraform apply`.

### 7. Initialize Terraform

```bash
cd terraform
terraform init
```

### 8. Review Deployment Plan

```bash
terraform plan
```

Review the plan to ensure it matches your expectations.

### 9. Deploy Infrastructure

```bash
terraform apply
```

Type `yes` when prompted. This will create:
- VPC and networking components
- ECS cluster and service
- Load balancer
- Security groups
- IAM roles
- CloudWatch log groups
- SSM parameters

### 10. Get Application URL

After deployment completes:

```bash
terraform output load_balancer_dns
```

Or get the full application URL:

```bash
terraform output application_url
```

## Updating the Application

### 1. Build and Push New Docker Image

```bash
# Build new image
docker build -t woms:latest -f terraform/Dockerfile .

# Tag with version or timestamp
docker tag woms:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/woms:v1.0.1

# Push to ECR
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/woms:v1.0.1
```

### 2. Update Terraform Configuration

Edit `terraform.tfvars`:
```hcl
image_tag = "v1.0.1"
```

### 3. Apply Changes

```bash
terraform apply
```

ECS will automatically deploy the new image.

## Environment Variables

All environment variables are stored in AWS Systems Manager Parameter Store and injected into containers at runtime. The following parameters are configured:

### Required Parameters

- `NEXT_PUBLIC_SUPABASE_URL` - Main Supabase database URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (SecureString)
- `TELEMETRY_SUPABASE_URL` - Telemetry database URL
- `TELEMETRY_SUPABASE_ANON_KEY` - Telemetry database anonymous key
- `TELEMETRY_SUPABASE_SERVICE_ROLE_KEY` - Telemetry service role key (SecureString)
- `CRON_SECRET` - Secret for cron job authentication (SecureString)

### Optional Parameters

- `NEW_RELIC_ENABLED` - Enable New Relic APM ("true" or "false")
- `NEW_RELIC_LICENSE_KEY` - New Relic license key (if enabled)
- `INTELLO_API_BASE_URL` - Intello API base URL
- `TRACKSO_API_BASE_URL` - Trackso API base URL
- `SCADA_API_BASE_URL` - SCADA API base URL

## Scaling

The infrastructure includes auto-scaling configured to:
- **Scale out** when CPU utilization exceeds 70%
- **Scale in** when CPU utilization drops below 70%
- **Minimum tasks**: 1 (configurable)
- **Maximum tasks**: 10 (configurable)

Adjust scaling parameters in `terraform.tfvars`:
```hcl
min_task_count = 2
max_task_count = 20
```

## Monitoring

### CloudWatch Logs

View application logs:
```bash
aws logs tail /ecs/woms-prod --follow
```

Or via AWS Console: CloudWatch → Log Groups → `/ecs/woms-prod`

### ECS Service Metrics

Monitor ECS service metrics in CloudWatch:
- CPU utilization
- Memory utilization
- Request count
- Target response time

## Health Checks

The application includes a health check endpoint at `/api/health`. Ensure this endpoint exists in your application:

```typescript
// app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok', timestamp: new Date().toISOString() })
}
```

## HTTPS Setup (Optional)

To enable HTTPS:

1. **Request ACM Certificate**:
```bash
aws acm request-certificate \
  --domain-name app.example.com \
  --validation-method DNS \
  --region us-east-1
```

2. **Validate Certificate** (add DNS records as instructed)

3. **Update terraform.tfvars**:
```hcl
domain_name    = "app.example.com"
certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/xxxxx"
enable_https   = true
```

4. **Apply changes**:
```bash
terraform apply
```

5. **Update Route53** (if using Route53):
   - Create A record pointing to the load balancer DNS name

## Cost Optimization

### Development Environment

For development, consider:
- Using `t3.micro` or `t3.small` instances instead of Fargate
- Reducing `min_task_count` to 1
- Using single availability zone
- Disabling NAT Gateways (use public subnets only)

### Production Environment

- Use Fargate Spot for non-critical workloads (50-70% cost savings)
- Enable CloudWatch Logs retention policies
- Use Reserved Capacity for predictable workloads
- Monitor and adjust auto-scaling thresholds

## Troubleshooting

### ECS Tasks Not Starting

1. Check CloudWatch Logs for errors
2. Verify SSM parameters are set correctly
3. Check ECS task definition for configuration errors
4. Verify security group allows outbound traffic

### Application Not Responding

1. Check load balancer target group health
2. Verify security groups allow traffic from ALB to ECS
3. Check application logs in CloudWatch
4. Verify health check endpoint is working

### High Costs

1. Review CloudWatch Logs retention
2. Check NAT Gateway usage (consider NAT instances for dev)
3. Review ECS task resource allocation
4. Monitor auto-scaling behavior

## Destroying Infrastructure

⚠️ **Warning**: This will delete all resources including databases if managed by Terraform.

```bash
terraform destroy
```

## Additional Resources

- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [ECS Fargate Documentation](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html)
- [Application Load Balancer Guide](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html)

## Support

For issues or questions:
1. Check CloudWatch Logs
2. Review Terraform plan output
3. Verify AWS service quotas
4. Check security group rules

