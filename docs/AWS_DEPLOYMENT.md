# AWS Deployment Guide: BBIK MOM Generator

**Version:** 1.0.0 | **Region:** ap-southeast-1 (Singapore)  
**Stack:** ECS Fargate + RDS PostgreSQL + ElastiCache Redis + ALB + ACM + Route 53

---

## Architecture: localhost → AWS Mapping

| Docker Compose (localhost)   | AWS Service                          |
|------------------------------|--------------------------------------|
| `db` postgres container      | **RDS PostgreSQL 16** (managed)      |
| `redis` container            | **ElastiCache Redis 7** (managed)    |
| `backend` container :3001    | **ECS Fargate** Task                 |
| `worker` container           | **ECS Fargate** Task (separate)      |
| `frontend` container :3000   | **ECS Fargate** Task                 |
| Docker Hub                   | **Amazon ECR** (private registry)    |
| Port mapping (3000/3001)     | **Application Load Balancer (ALB)**  |
| `.env` file                  | **SSM Parameter Store** (encrypted)  |
| `docker-compose.yml` network | **VPC + Private Subnets**            |

```
Internet → Route 53 → ACM (SSL) → ALB
                                    ├── /          → ECS Frontend :3000
                                    └── /api/*     → ECS Backend  :3001
                                                         │
                                         ┌───────────────┼──────────────────┐
                                    ECS Worker     RDS PostgreSQL  ElastiCache Redis
                                    (BullMQ)       (db container)  (redis container)
```

---

## 0. Prerequisites

```bash
brew install awscli jq

aws configure
# Region: ap-southeast-1
# Output: json

export AWS_REGION=ap-southeast-1
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export APP_NAME=bbik-mom
```

---

## 1. VPC & Networking

```bash
# VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${APP_NAME}-vpc}]" \
  --query 'Vpc.VpcId' --output text)

aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-support

# Public Subnets (for ALB)
PUBLIC_SUBNET_A=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 \
  --availability-zone ${AWS_REGION}a --query 'Subnet.SubnetId' --output text)
PUBLIC_SUBNET_B=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 \
  --availability-zone ${AWS_REGION}b --query 'Subnet.SubnetId' --output text)

# Private Subnets (for ECS, RDS, Redis)
PRIVATE_SUBNET_A=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.11.0/24 \
  --availability-zone ${AWS_REGION}a --query 'Subnet.SubnetId' --output text)
PRIVATE_SUBNET_B=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.12.0/24 \
  --availability-zone ${AWS_REGION}b --query 'Subnet.SubnetId' --output text)

# Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway --query 'InternetGateway.InternetGatewayId' --output text)
aws ec2 attach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID

# NAT Gateway (private subnets → internet for ECR pull, Anthropic/OpenAI API calls)
EIP_ALLOC=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)
NAT_GW=$(aws ec2 create-nat-gateway --subnet-id $PUBLIC_SUBNET_A --allocation-id $EIP_ALLOC \
  --query 'NatGateway.NatGatewayId' --output text)
aws ec2 wait nat-gateway-available --nat-gateway-ids $NAT_GW

# Route Tables
PUBLIC_RT=$(aws ec2 create-route-table --vpc-id $VPC_ID --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id $PUBLIC_RT --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID
aws ec2 associate-route-table --route-table-id $PUBLIC_RT --subnet-id $PUBLIC_SUBNET_A
aws ec2 associate-route-table --route-table-id $PUBLIC_RT --subnet-id $PUBLIC_SUBNET_B

PRIVATE_RT=$(aws ec2 create-route-table --vpc-id $VPC_ID --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id $PRIVATE_RT --destination-cidr-block 0.0.0.0/0 --nat-gateway-id $NAT_GW
aws ec2 associate-route-table --route-table-id $PRIVATE_RT --subnet-id $PRIVATE_SUBNET_A
aws ec2 associate-route-table --route-table-id $PRIVATE_RT --subnet-id $PRIVATE_SUBNET_B
```

---

## 2. Security Groups

```bash
# ALB SG — internet → ALB
ALB_SG=$(aws ec2 create-security-group --group-name "${APP_NAME}-alb-sg" \
  --description "ALB" --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 80  --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 443 --cidr 0.0.0.0/0

# ECS SG — ALB → ECS tasks
ECS_SG=$(aws ec2 create-security-group --group-name "${APP_NAME}-ecs-sg" \
  --description "ECS Tasks" --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $ECS_SG --protocol tcp --port 3001 --source-group $ALB_SG
aws ec2 authorize-security-group-ingress --group-id $ECS_SG --protocol tcp --port 3000 --source-group $ALB_SG

# RDS SG — ECS → Postgres only
RDS_SG=$(aws ec2 create-security-group --group-name "${APP_NAME}-rds-sg" \
  --description "RDS" --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $RDS_SG --protocol tcp --port 5432 --source-group $ECS_SG

# Redis SG — ECS → Redis only
REDIS_SG=$(aws ec2 create-security-group --group-name "${APP_NAME}-redis-sg" \
  --description "Redis" --vpc-id $VPC_ID --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $REDIS_SG --protocol tcp --port 6379 --source-group $ECS_SG
```

---

## 3. RDS PostgreSQL (replaces `db` container)

```bash
aws rds create-db-subnet-group \
  --db-subnet-group-name "${APP_NAME}-rds-subnet" \
  --db-subnet-group-description "BBIK RDS" \
  --subnet-ids $PRIVATE_SUBNET_A $PRIVATE_SUBNET_B

aws rds create-db-instance \
  --db-instance-identifier "${APP_NAME}-postgres" \
  --db-instance-class db.t3.micro \
  --engine postgres --engine-version 16.3 \
  --master-username bbikadmin \
  --master-user-password "CHANGE_THIS_STRONG_PASSWORD" \
  --db-name mom_generator \
  --allocated-storage 20 --storage-type gp3 \
  --no-publicly-accessible \
  --vpc-security-group-ids $RDS_SG \
  --db-subnet-group-name "${APP_NAME}-rds-subnet" \
  --backup-retention-period 7 --deletion-protection

aws rds wait db-instance-available --db-instance-identifier "${APP_NAME}-postgres"

RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier "${APP_NAME}-postgres" \
  --query 'DBInstances[0].Endpoint.Address' --output text)
echo "RDS Endpoint: $RDS_ENDPOINT"
```

---

## 4. ElastiCache Redis (replaces `redis` container)

```bash
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name "${APP_NAME}-redis-subnet" \
  --cache-subnet-group-description "BBIK Redis" \
  --subnet-ids $PRIVATE_SUBNET_A $PRIVATE_SUBNET_B

aws elasticache create-cache-cluster \
  --cache-cluster-id "${APP_NAME}-redis" \
  --cache-node-type cache.t3.micro \
  --engine redis --engine-version 7.1 \
  --num-cache-nodes 1 \
  --cache-subnet-group-name "${APP_NAME}-redis-subnet" \
  --security-group-ids $REDIS_SG

aws elasticache wait cache-cluster-available --cache-cluster-id "${APP_NAME}-redis"

REDIS_ENDPOINT=$(aws elasticache describe-cache-clusters \
  --cache-cluster-id "${APP_NAME}-redis" --show-cache-node-info \
  --query 'CacheClusters[0].CacheNodes[0].Endpoint.Address' --output text)
echo "Redis Endpoint: $REDIS_ENDPOINT"
```

---

## 5. SSM Parameter Store (replaces `.env` file)

> ⚠️ ใส่ค่าจริงก่อน push — ไม่มี `.env` บน AWS เลย

```bash
# API Keys (SecureString = KMS encrypted)
aws ssm put-parameter --name "/${APP_NAME}/ANTHROPIC_API_KEY" \
  --value "sk-ant-YOUR_KEY" --type SecureString --overwrite
aws ssm put-parameter --name "/${APP_NAME}/OPENAI_API_KEY" \
  --value "sk-YOUR_KEY" --type SecureString --overwrite
aws ssm put-parameter --name "/${APP_NAME}/JWT_SECRET" \
  --value "$(openssl rand -hex 64)" --type SecureString --overwrite
aws ssm put-parameter --name "/${APP_NAME}/DATABASE_URL" \
  --value "postgresql://bbikadmin:CHANGE_THIS_STRONG_PASSWORD@${RDS_ENDPOINT}:5432/mom_generator" \
  --type SecureString --overwrite

# Config (String)
aws ssm put-parameter --name "/${APP_NAME}/REDIS_HOST"      --value "$REDIS_ENDPOINT"         --type String --overwrite
aws ssm put-parameter --name "/${APP_NAME}/REDIS_PORT"      --value "6379"                    --type String --overwrite
aws ssm put-parameter --name "/${APP_NAME}/ANTHROPIC_MODEL" --value "claude-sonnet-4-5"        --type String --overwrite
aws ssm put-parameter --name "/${APP_NAME}/ALLOWED_ORIGINS" --value "https://your-domain.com" --type String --overwrite
aws ssm put-parameter --name "/${APP_NAME}/NODE_ENV"        --value "production"              --type String --overwrite
aws ssm put-parameter --name "/${APP_NAME}/PORT"            --value "3001"                    --type String --overwrite
```

---

## 6. Amazon ECR (Container Registry)

```bash
aws ecr create-repository --repository-name "${APP_NAME}-backend"  --image-scanning-configuration scanOnPush=true
aws ecr create-repository --repository-name "${APP_NAME}-frontend" --image-scanning-configuration scanOnPush=true

aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

cd /path/to/BBIK_MOM_Generator

# Backend image (ใช้ร่วมกันทั้ง backend + worker services)
docker build -t ${APP_NAME}-backend ./Backend
docker tag ${APP_NAME}-backend:latest \
  ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${APP_NAME}-backend:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${APP_NAME}-backend:latest

# Frontend image (ต้องใส่ domain จริงตอน build เพราะ NEXT_PUBLIC_ is baked at build time)
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://your-domain.com \
  -t ${APP_NAME}-frontend ./Frontend/my-app
docker tag ${APP_NAME}-frontend:latest \
  ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${APP_NAME}-frontend:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${APP_NAME}-frontend:latest
```

---

## 7. IAM Execution Role

```bash
aws iam create-role \
  --role-name "${APP_NAME}-ecs-exec-role" \
  --assume-role-policy-document \
  '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

aws iam attach-role-policy \
  --role-name "${APP_NAME}-ecs-exec-role" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Allow reading SSM secrets
aws iam put-role-policy \
  --role-name "${APP_NAME}-ecs-exec-role" \
  --policy-name "SSMReadPolicy" \
  --policy-document "{
    \"Version\":\"2012-10-17\",
    \"Statement\":[{
      \"Effect\":\"Allow\",
      \"Action\":[\"ssm:GetParameters\",\"ssm:GetParameter\",\"kms:Decrypt\"],
      \"Resource\":[\"arn:aws:ssm:${AWS_REGION}:${AWS_ACCOUNT_ID}:parameter/${APP_NAME}/*\"]
    }]
  }"
```

---

## 8. ECS Cluster

```bash
aws ecs create-cluster --cluster-name "${APP_NAME}-cluster" --capacity-providers FARGATE
aws logs create-log-group --log-group-name "/ecs/${APP_NAME}"
```

สร้างไฟล์ `aws/task-def-backend.json` (แทน `backend` service ใน docker-compose):

```json
{
  "family": "bbik-mom-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/bbik-mom-ecs-exec-role",
  "containerDefinitions": [{
    "name": "backend",
    "image": "ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/bbik-mom-backend:latest",
    "portMappings": [{ "containerPort": 3001, "protocol": "tcp" }],
    "environment": [
      { "name": "TZ",        "value": "Asia/Bangkok" },
      { "name": "LOGO_PATH", "value": "./assets/Bluebik_Logo_2025_Horizontal_Primary_Logo_Black.png" }
    ],
    "secrets": [
      { "name": "ANTHROPIC_API_KEY", "valueFrom": "arn:aws:ssm:ap-southeast-1:ACCOUNT_ID:parameter/bbik-mom/ANTHROPIC_API_KEY" },
      { "name": "OPENAI_API_KEY",    "valueFrom": "arn:aws:ssm:ap-southeast-1:ACCOUNT_ID:parameter/bbik-mom/OPENAI_API_KEY" },
      { "name": "JWT_SECRET",        "valueFrom": "arn:aws:ssm:ap-southeast-1:ACCOUNT_ID:parameter/bbik-mom/JWT_SECRET" },
      { "name": "DATABASE_URL",      "valueFrom": "arn:aws:ssm:ap-southeast-1:ACCOUNT_ID:parameter/bbik-mom/DATABASE_URL" },
      { "name": "REDIS_HOST",        "valueFrom": "arn:aws:ssm:ap-southeast-1:ACCOUNT_ID:parameter/bbik-mom/REDIS_HOST" },
      { "name": "REDIS_PORT",        "valueFrom": "arn:aws:ssm:ap-southeast-1:ACCOUNT_ID:parameter/bbik-mom/REDIS_PORT" },
      { "name": "ANTHROPIC_MODEL",   "valueFrom": "arn:aws:ssm:ap-southeast-1:ACCOUNT_ID:parameter/bbik-mom/ANTHROPIC_MODEL" },
      { "name": "ALLOWED_ORIGINS",   "valueFrom": "arn:aws:ssm:ap-southeast-1:ACCOUNT_ID:parameter/bbik-mom/ALLOWED_ORIGINS" },
      { "name": "NODE_ENV",          "valueFrom": "arn:aws:ssm:ap-southeast-1:ACCOUNT_ID:parameter/bbik-mom/NODE_ENV" },
      { "name": "PORT",              "valueFrom": "arn:aws:ssm:ap-southeast-1:ACCOUNT_ID:parameter/bbik-mom/PORT" }
    ],
    "healthCheck": {
      "command": ["CMD-SHELL", "wget -qO- http://localhost:3001/health || exit 1"],
      "interval": 30, "timeout": 10, "retries": 3, "startPeriod": 30
    },
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/bbik-mom",
        "awslogs-region": "ap-southeast-1",
        "awslogs-stream-prefix": "backend"
      }
    }
  }]
}
```

สร้างไฟล์ `aws/task-def-worker.json` (แทน `worker` service — same image, different command):

```json
{
  "family": "bbik-mom-worker",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/bbik-mom-ecs-exec-role",
  "containerDefinitions": [{
    "name": "worker",
    "image": "ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/bbik-mom-backend:latest",
    "command": ["npm", "run", "worker"],
    "environment": [
      { "name": "TZ",        "value": "Asia/Bangkok" },
      { "name": "LOGO_PATH", "value": "./assets/Bluebik_Logo_2025_Horizontal_Primary_Logo_Black.png" }
    ],
    "secrets": [
      { "name": "ANTHROPIC_API_KEY", "valueFrom": "arn:aws:ssm:ap-southeast-1:ACCOUNT_ID:parameter/bbik-mom/ANTHROPIC_API_KEY" },
      { "name": "OPENAI_API_KEY",    "valueFrom": "arn:aws:ssm:ap-southeast-1:ACCOUNT_ID:parameter/bbik-mom/OPENAI_API_KEY" },
      { "name": "JWT_SECRET",        "valueFrom": "arn:aws:ssm:ap-southeast-1:ACCOUNT_ID:parameter/bbik-mom/JWT_SECRET" },
      { "name": "DATABASE_URL",      "valueFrom": "arn:aws:ssm:ap-southeast-1:ACCOUNT_ID:parameter/bbik-mom/DATABASE_URL" },
      { "name": "REDIS_HOST",        "valueFrom": "arn:aws:ssm:ap-southeast-1:ACCOUNT_ID:parameter/bbik-mom/REDIS_HOST" },
      { "name": "REDIS_PORT",        "valueFrom": "arn:aws:ssm:ap-southeast-1:ACCOUNT_ID:parameter/bbik-mom/REDIS_PORT" },
      { "name": "NODE_ENV",          "valueFrom": "arn:aws:ssm:ap-southeast-1:ACCOUNT_ID:parameter/bbik-mom/NODE_ENV" }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/bbik-mom",
        "awslogs-region": "ap-southeast-1",
        "awslogs-stream-prefix": "worker"
      }
    }
  }]
}
```

สร้างไฟล์ `aws/task-def-frontend.json`:

```json
{
  "family": "bbik-mom-frontend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/bbik-mom-ecs-exec-role",
  "containerDefinitions": [{
    "name": "frontend",
    "image": "ACCOUNT_ID.dkr.ecr.ap-southeast-1.amazonaws.com/bbik-mom-frontend:latest",
    "portMappings": [{ "containerPort": 3000, "protocol": "tcp" }],
    "environment": [
      { "name": "NODE_ENV", "value": "production" },
      { "name": "HOSTNAME", "value": "0.0.0.0" }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/bbik-mom",
        "awslogs-region": "ap-southeast-1",
        "awslogs-stream-prefix": "frontend"
      }
    }
  }]
}
```

```bash
# Register task definitions
aws ecs register-task-definition --cli-input-json file://aws/task-def-backend.json
aws ecs register-task-definition --cli-input-json file://aws/task-def-worker.json
aws ecs register-task-definition --cli-input-json file://aws/task-def-frontend.json
```

---

## 9. Application Load Balancer (ALB)

```bash
# Request SSL cert from ACM
CERT_ARN=$(aws acm request-certificate \
  --domain-name "your-domain.com" \
  --subject-alternative-names "*.your-domain.com" \
  --validation-method DNS \
  --query 'CertificateArn' --output text)
# ⚠️ ไปทำ DNS validation ใน Route 53 Console ก่อนไปขั้นตอนถัดไป

# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name "${APP_NAME}-alb" \
  --subnets $PUBLIC_SUBNET_A $PUBLIC_SUBNET_B \
  --security-groups $ALB_SG \
  --scheme internet-facing --type application \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# Target Groups
BACKEND_TG=$(aws elbv2 create-target-group \
  --name "${APP_NAME}-backend-tg" --protocol HTTP --port 3001 \
  --vpc-id $VPC_ID --target-type ip --health-check-path /health \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

FRONTEND_TG=$(aws elbv2 create-target-group \
  --name "${APP_NAME}-frontend-tg" --protocol HTTP --port 3000 \
  --vpc-id $VPC_ID --target-type ip --health-check-path / \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

# HTTPS Listener (default → frontend)
HTTPS_LISTENER=$(aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN --protocol HTTPS --port 443 \
  --ssl-policy ELBSecurityPolicy-TLS13-1-2-2021-06 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=$FRONTEND_TG \
  --query 'Listeners[0].ListenerArn' --output text)

# /api/* and /health → backend
aws elbv2 create-rule --listener-arn $HTTPS_LISTENER --priority 10 \
  --conditions '[{"Field":"path-pattern","Values":["/api/*"]}]' \
  --actions "[{\"Type\":\"forward\",\"TargetGroupArn\":\"${BACKEND_TG}\"}]"

aws elbv2 create-rule --listener-arn $HTTPS_LISTENER --priority 20 \
  --conditions '[{"Field":"path-pattern","Values":["/health"]}]' \
  --actions "[{\"Type\":\"forward\",\"TargetGroupArn\":\"${BACKEND_TG}\"}]"

# HTTP → HTTPS redirect
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN --protocol HTTP --port 80 \
  --default-actions 'Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'

ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].DNSName' --output text)
echo "ALB DNS: $ALB_DNS"
```

---

## 10. ECS Services

```bash
# Backend
aws ecs create-service \
  --cluster "${APP_NAME}-cluster" \
  --service-name "${APP_NAME}-backend" \
  --task-definition "bbik-mom-backend" \
  --desired-count 1 --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[$PRIVATE_SUBNET_A,$PRIVATE_SUBNET_B],
    securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=${BACKEND_TG},containerName=backend,containerPort=3001" \
  --health-check-grace-period-seconds 60

# Worker (ไม่มี ALB — internal only, รับ job จาก Redis)
aws ecs create-service \
  --cluster "${APP_NAME}-cluster" \
  --service-name "${APP_NAME}-worker" \
  --task-definition "bbik-mom-worker" \
  --desired-count 1 --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[$PRIVATE_SUBNET_A,$PRIVATE_SUBNET_B],
    securityGroups=[$ECS_SG],assignPublicIp=DISABLED}"

# Frontend
aws ecs create-service \
  --cluster "${APP_NAME}-cluster" \
  --service-name "${APP_NAME}-frontend" \
  --task-definition "bbik-mom-frontend" \
  --desired-count 1 --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={
    subnets=[$PRIVATE_SUBNET_A,$PRIVATE_SUBNET_B],
    securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=${FRONTEND_TG},containerName=frontend,containerPort=3000" \
  --health-check-grace-period-seconds 60
```

---

## 11. Route 53 DNS

```bash
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name "your-domain.com" \
  --query 'HostedZones[0].Id' --output text | sed 's|/hostedzone/||')

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch "{
    \"Changes\":[{
      \"Action\":\"UPSERT\",
      \"ResourceRecordSet\":{
        \"Name\":\"your-domain.com\",\"Type\":\"A\",
        \"AliasTarget\":{
          \"HostedZoneId\":\"Z1LMS91P8CMLE5\",
          \"DNSName\":\"${ALB_DNS}\",
          \"EvaluateTargetHealth\":true
        }
      }
    }]
  }"
# Z1LMS91P8CMLE5 = ALB Hosted Zone ID for ap-southeast-1
# See: https://docs.aws.amazon.com/general/latest/gr/elb.html
```

---

## 12. GitHub Actions CI/CD

สร้างไฟล์ `.github/workflows/deploy.yml`:

```yaml
name: Build and Deploy to AWS ECS
on:
  push:
    branches: [main]

env:
  AWS_REGION: ap-southeast-1
  ECS_CLUSTER: bbik-mom-cluster
  ECR_BACKEND: bbik-mom-backend
  ECR_FRONTEND: bbik-mom-frontend
  NEXT_PUBLIC_API_URL: https://your-domain.com

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and Push Backend
        env:
          REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          TAG: ${{ github.sha }}
        run: |
          docker build -t $REGISTRY/$ECR_BACKEND:$TAG ./Backend
          docker push $REGISTRY/$ECR_BACKEND:$TAG
          docker tag $REGISTRY/$ECR_BACKEND:$TAG $REGISTRY/$ECR_BACKEND:latest
          docker push $REGISTRY/$ECR_BACKEND:latest

      - name: Build and Push Frontend
        env:
          REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          TAG: ${{ github.sha }}
        run: |
          docker build \
            --build-arg NEXT_PUBLIC_API_URL=${{ env.NEXT_PUBLIC_API_URL }} \
            -t $REGISTRY/$ECR_FRONTEND:$TAG ./Frontend/my-app
          docker push $REGISTRY/$ECR_FRONTEND:$TAG
          docker tag $REGISTRY/$ECR_FRONTEND:$TAG $REGISTRY/$ECR_FRONTEND:latest
          docker push $REGISTRY/$ECR_FRONTEND:latest

      - name: Deploy All Services
        run: |
          for svc in bbik-mom-backend bbik-mom-worker bbik-mom-frontend; do
            aws ecs update-service \
              --cluster $ECS_CLUSTER \
              --service $svc \
              --force-new-deployment
          done

      - name: Wait for Backend Stable
        run: |
          aws ecs wait services-stable \
            --cluster $ECS_CLUSTER \
            --services bbik-mom-backend
```

**GitHub Secrets ที่ต้องตั้ง:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

---

## 13. Estimated Monthly Cost (ap-southeast-1)

| Service                      | Spec                | Cost/mo  |
|------------------------------|---------------------|----------|
| ECS Fargate (backend)        | 0.5 vCPU / 1 GB     | ~$15     |
| ECS Fargate (worker)         | 1 vCPU / 2 GB       | ~$30     |
| ECS Fargate (frontend)       | 0.25 vCPU / 0.5 GB  | ~$8      |
| RDS PostgreSQL (db.t3.micro) | 20 GB gp3           | ~$25     |
| ElastiCache Redis (t3.micro) | 1 node              | ~$15     |
| ALB                          | ~720 hrs/mo         | ~$20     |
| NAT Gateway                  | ~10 GB traffic      | ~$10     |
| ECR Storage                  | < 1 GB              | ~$1      |
| **Total**                    |                     | **~$124**|

> 💡 ลด 30–40% ด้วย **Savings Plans** หรือ **RDS Reserved Instances**

---

## 14. Post-Deploy Checklist

- [ ] `curl https://your-domain.com/health` → `{"status":"ok"}`
- [ ] Login `test@bbik.com` / `password123` บน frontend
- [ ] อัพโหลดไฟล์เสียง → Worker logs ใน CloudWatch ต้องเห็น job
- [ ] `aws logs tail /ecs/bbik-mom --follow`
- [ ] ตรวจ header `Cross-Origin-Opener-Policy: same-origin` บน frontend

---

## 15. Useful Commands

```bash
# Status
aws ecs describe-services --cluster bbik-mom-cluster \
  --services bbik-mom-backend bbik-mom-worker bbik-mom-frontend

# Force redeploy
aws ecs update-service --cluster bbik-mom-cluster \
  --service bbik-mom-backend --force-new-deployment

# Stream logs
aws logs tail /ecs/bbik-mom --follow

# Exec into running container (ต้อง enable ECS Exec ใน task def)
aws ecs execute-command --cluster bbik-mom-cluster \
  --task <TASK_ID> --container backend \
  --interactive --command "/bin/sh"
```

---

*Last updated: 2026-04-03 | ap-southeast-1 (Singapore)*
