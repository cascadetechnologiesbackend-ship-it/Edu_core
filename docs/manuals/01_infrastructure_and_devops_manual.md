# SchoolMitra ERP — Infrastructure & DevOps Architecture Manual

> **Document Classification**: Engineering Handbook & Infrastructure Manual  
> **Target Audience**: Cloud Architects, DevOps Engineers, SREs, Systems Administrators  
> **Status**: Production Reference  
> **Version**: 2.0.0  
> **Last Updated**: October 2026

---

## 1. Executive Infrastructure Overview

SchoolMitra ERP is engineered as a cloud-native, containerized multi-tenant platform designed for high availability, zero data loss, strict tenant isolation, and regulatory compliance (DPDP Act 2023). The infrastructure is deployed on **Amazon Web Services (AWS)** in the `ap-south-1` (Mumbai) region, optimized for low latency across the Indian subcontinent while complying with domestic data residency requirements.

### Infrastructure Topology Diagram

```mermaid
flowchart TB
    subgraph Internet ["Public Internet"]
        ClientWeb["Web & PWA Clients\n(Desktop, Android, iOS)"]
        PaymentGW["Razorpay Payment Gateway\n(Webhooks)"]
    end

    subgraph AWS ["AWS Cloud (ap-south-1 Mumbai)"]
        subgraph VPC ["Virtual Private Cloud (172.31.0.0/16)"]
            
            subgraph PublicSubnets ["Public Subnets (AZ-1a, AZ-1b)"]
                ALB["Application Load Balancer (ALB)\neducore-alb (Port 80/443)"]
                NATGW["Internet Gateway\n(IGW)"]
            end

            subgraph ECSCluster ["AWS ECS Fargate Cluster (educore-cluster)"]
                subgraph ECSTasks ["Task: educore-task (Linux/AMD64)"]
                    NextApp["Next.js 14 Standalone Container\neducore-app:latest (Port 3000)\n0.5 vCPU / 1024 MB"]
                end
            end

            subgraph StorageData ["Managed Data Tier (Private Subnets)"]
                RDS["Amazon RDS PostgreSQL 16\neducore-postgres\n(db.t4g.micro / GP3)\nPort 5432"]
                Valkey["Amazon ElastiCache for Valkey\neducore-valkey (Port 6379 TLS)\n(Cache, BullMQ Queues & Locks)"]
                S3["Amazon S3 Bucket\neducore-platform-storage-mumbai\n(Documents, Avatars, Receipts)"]
            end

            subgraph Observability ["Observability & Management"]
                CW["Amazon CloudWatch\n(Log Group: /ecs/educore-task)\nAlarms: CPU, Memory, 5XX"]
                ECR["Amazon ECR Repository\neducore-app (Docker Images)"]
            end
        end
    end

    ClientWeb -->|HTTP / HTTPS| ALB
    PaymentGW -->|Webhooks /api/webhooks/razorpay| ALB
    ALB -->|Target Group HTTP:3000| NextApp
    NextApp -->|Drizzle ORM Connection Pool| RDS
    NextApp -->|BullMQ Async Jobs & Caching| Valkey
    NextApp -->|AWS SDK v3 S3Client / Presigned URLs| S3
    NextApp -->|Structured JSON Logs| CW
    ECR -.->|Pulls latest container image| NextApp
```

---

## 2. AWS Network Architecture (VPC & Subnets)

### 2.1 CIDR Block Allocation
- **VPC ID**: Default / Custom VPC in region `ap-south-1`.
- **VPC CIDR**: `172.31.0.0/16` (65,536 private IP addresses).
- **Subnet Distribution**:
  - `subnet-001` (AZ `ap-south-1a`): `172.31.32.0/20` — ALB Listener & Fargate Task execution.
  - `subnet-002` (AZ `ap-south-1b`): `172.31.0.0/20` — Multi-AZ redundancy for ALB and database subnet group.
  - `subnet-003` (AZ `ap-south-1c`): `172.31.16.0/20` — Spare availability zone for cluster auto-scaling.

### 2.2 Security Groups Configuration

| Security Group Name | Description | Inbound Rules | Outbound Rules |
| :--- | :--- | :--- | :--- |
| **`educore-alb-sg`** | Application Load Balancer Security Group | • TCP 80 from `0.0.0.0/0`<br>• TCP 443 from `0.0.0.0/0` | • TCP 3000 to `educore-ecs-sg`<br>• All traffic to `0.0.0.0/0` |
| **`educore-ecs-sg`** | ECS Fargate Tasks Security Group | • TCP 3000 from `educore-alb-sg` | • TCP 5432 to `educore-rds-sg`<br>• TCP 6379 to `educore-valkey-sg`<br>• TCP 443 to `0.0.0.0/0` (AWS API endpoints & S3) |
| **`educore-rds-sg`** | Amazon RDS PostgreSQL Security Group | • TCP 5432 from `educore-ecs-sg`<br>• TCP 5432 from authorized admin bastion/IPs | • None (Database does not initiate outbound egress) |
| **`educore-valkey-sg`** | Amazon ElastiCache for Valkey Security Group | • TCP 6379 from `educore-ecs-sg` | • None (In-memory cache does not initiate outbound egress) |

---

## 3. Application Load Balancer (ALB) & Routing

### 3.1 Load Balancer Specifications
- **Name**: `educore-alb`
- **ARN**: `arn:aws:elasticloadbalancing:ap-south-1:144911976586:loadbalancer/app/educore-alb/...`
- **DNS Endpoint**: `http://educore-alb-1749225371.ap-south-1.elb.amazonaws.com`
- **Scheme**: Internet-facing
- **IP Address Type**: Dualstack (IPv4 & IPv6 ready)
- **Idle Timeout**: `60` seconds

### 3.2 Target Group Architecture
- **Target Group Name**: `educore-tg`
- **Target Type**: `ip` (required for AWS Fargate `awsvpc` network mode)
- **Protocol & Port**: `HTTP:3000`
- **Health Check Settings**:
  - **Path**: `/api/health`
  - **HTTP Success Codes**: `200`
  - **Interval**: `30` seconds
  - **Timeout**: `5` seconds
  - **Healthy Threshold**: `2` consecutive successes
  - **Unhealthy Threshold**: `3` consecutive failures
- **Deregistration Delay**: `15` seconds (allows rapid rolling deployment draining without dropping in-flight Next.js Server Actions)

```typescript
// frontend/src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    // Active PostgreSQL connection verification
    await db.execute(sql`SELECT 1`);
    return NextResponse.json(
      { 
        status: "healthy", 
        timestamp: new Date().toISOString(),
        version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0"
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: "unhealthy", error: (error as Error).message },
      { status: 503 }
    );
  }
}
```

---

## 4. AWS ECS Fargate Cluster & Task Definition

### 4.1 Cluster Overview
- **Cluster Name**: `educore-cluster`
- **Capacity Provider**: `FARGATE` and `FARGATE_SPOT`
- **Service Name**: `educore-service`
- **Deployment Controller**: Rolling update with `minimumHealthyPercent: 100` and `maximumPercent: 200`.

### 4.2 Task Definition Specifications (`educore-task`)
- **CPU**: `512` units (0.5 vCPU)
- **Memory**: `1024` MB (1 GB RAM)
- **Network Mode**: `awsvpc`
- **Requires Compatibilities**: `FARGATE`
- **Operating System Family**: `LINUX`
- **Architecture**: `X86_64` (AMD64)
- **Execution Role**: `ecsTaskExecutionRole`

### 4.3 Container Environment Variables & Secrets Injection

```json
{
  "containerDefinitions": [
    {
      "name": "educore-app",
      "image": "144911976586.dkr.ecr.ap-south-1.amazonaws.com/educore-app:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 3000,
          "hostPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "PORT", "value": "3000" },
        { "name": "HOSTNAME", "value": "0.0.0.0" },
        { "name": "DATABASE_URL", "value": "postgresql://postgres:***@educore-postgres.c3e6ik6w4c0u.ap-south-1.rds.amazonaws.com:5432/educore?sslmode=no-verify" },
        { "name": "DATABASE_POOL_MIN", "value": "2" },
        { "name": "DATABASE_POOL_MAX", "value": "10" },
        { "name": "AUTH_URL", "value": "http://educore-alb-1749225371.ap-south-1.elb.amazonaws.com" },
        { "name": "NEXTAUTH_URL", "value": "http://educore-alb-1749225371.ap-south-1.elb.amazonaws.com" },
        { "name": "AUTH_TRUST_HOST", "value": "true" },
        { "name": "AWS_REGION", "value": "ap-south-1" },
        { "name": "AWS_S3_BUCKET_NAME", "value": "educore-platform-storage-mumbai" },
        { "name": "VALKEY_URL", "value": "valkeys://default:***@educore-valkey.c3e6ik.ap-south-1.cache.amazonaws.com:6379" },
        { "name": "REDIS_URL", "value": "redis://127.0.0.1:6379" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/educore-task",
          "awslogs-region": "ap-south-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

---

## 5. Amazon RDS PostgreSQL Database Tier

### 5.1 Database Instance Specifications
- **Instance Identifier**: `educore-postgres`
- **Engine**: PostgreSQL 16.3
- **Instance Class**: `db.t4g.micro` (AWS Graviton2 64-bit Arm processor, 2 vCPU, 1 GB RAM)
- **Storage**: 20 GiB General Purpose SSD (`gp3`), 3,000 baseline IOPS, 125 MB/s throughput, Storage Auto-Scaling enabled up to 100 GiB.
- **Master Username**: `postgres`
- **Database Name**: `educore`
- **Endpoint**: `educore-postgres.c3e6ik6w4c0u.ap-south-1.rds.amazonaws.com:5432`

### 5.2 Connection Pooling & Statement Timeouts
To prevent database connection exhaustion and runaway slow queries, connection limits and statement timeouts are enforced at both the client and server levels:
1. **Drizzle Connection Pool (`pg.Pool`)**:
   - `min: 2` connections per container task
   - `max: 10` connections per container task
   - `idleTimeoutMillis: 30000` (reclaims idle connections after 30s)
   - `connectionTimeoutMillis: 5000` (fails fast within 5s if pool is saturated)
2. **Statement Timeout Guard**:
   - Default OLTP statement timeout: `2,000 ms` (2 seconds) to guarantee fast request-response cycles.
   - Long-running analytical reports and administrative batch jobs explicitly override timeouts up to `60,000 ms`.
   - SSL Verification: `rejectUnauthorized: false` configured for AWS RDS default certificate chain without requiring local cert bundles.

### 5.3 Amazon ElastiCache for Valkey Tier (Cache, BullMQ Queues & Distributed Locks)
- **Engine**: Valkey 7.2+ (Amazon ElastiCache for Valkey, fully protocol-compatible with RESP2/RESP3)
- **Deployment Topology**: Replication Group with Multi-AZ automatic failover across `ap-south-1a` and `ap-south-1b`.
- **Node Type**: `cache.t4g.micro` (Dev/Test) / `cache.m7g.large` (Production, AWS Graviton3, 64-bit Arm processor)
- **Port & Transport Encryption**: Port `6379`, In-Transit Encryption (`TLS 1.2+` required), At-Rest Encryption (AWS KMS `aws/elasticache`), Token-Based Access Control (`--auth-token`).
- **Primary Roles & Capabilities**:
  1. **L5 Application Query & Session Cache**: Caches hot school tenant configuration, fee structures, exam blueprints, and attendance summaries.
  2. **BullMQ Background Job Queues**: Powers asynchronous processing for report card PDF generation, automated fee reminders, and DPDP compliance retention purges.
  3. **Atomic Rate Limiter & Circuit Breaker**: Atomic sliding-window rate limiting via EVAL Lua scripts, backed by a 30s client-side circuit breaker with in-memory fallback.
  4. **Distributed Locks**: Multi-task concurrency control preventing duplicate fee invoice generations and double payment reconciliations.
- **Architectural Advantages over Redis OSS**:
  - **33% Lower Pricing**: ElastiCache for Valkey is priced approximately 33% lower than legacy ElastiCache for Redis OSS nodes.
  - **20% Higher Throughput**: Optimized vector search and multicore engine scaling.
  - **Open Source Governance**: Governed under the Linux Foundation with BSD-3-Clause license, avoiding restrictive SSPL/RSAL licensing.
  - **100% Wire Protocol Parity**: Native RESP2/RESP3 compatibility with port 6379, standard `ioredis` client with automatic `valkeys://` protocol translation.

---

## 6. S3 Storage Architecture & Media Delivery

### 6.1 Bucket Configuration
- **Bucket Identifier**: `educore-platform-storage-mumbai`
- **Region**: `ap-south-1` (Mumbai)
- **Access Control**: Public access blocked at the bucket level; access is granted strictly through cryptographically signed **Presigned URLs** with expiration windows (5 to 15 minutes).
- **Default Encryption**: Server-Side Encryption with Amazon S3 managed keys (`SSE-S3` / AES-256).

### 6.2 Key Namespace Structure
```
educore-platform-storage-mumbai/
├── schools/
│   └── {school_id}/
│       ├── logos/
│       │   └── logo_{timestamp}.png
│       ├── documents/
│       │   └── admissions/
│       │       └── {application_id}_{doc_type}.pdf
│       ├── student_vault/
│       │   └── {student_id}/
│       │       ├── id_proof_{hash}.pdf
│       │       └── medical_record_{hash}.pdf
│       └── fee_receipts/
│           └── {receipt_id}.pdf
└── system/
    └── templates/
        └── global_report_card_template.pdf
```

### 6.3 Local Development vs. Production Parity
- **Production**: Direct AWS SDK v3 `@aws-sdk/client-s3` interfacing with `s3.ap-south-1.amazonaws.com`.
- **Local Development**: MinIO container (`minio/minio:latest`) running on `localhost:9000` with S3-compatible API compatibility, managed via `docker-compose.yml`.

---

## 7. Multi-Stage Dockerfile Engineering

The production container uses a 4-stage build utilizing Node.js 20 Alpine and PNPM v9 with Next.js Standalone mode.

```dockerfile
# Dockerfile — Production Multi-Stage Build
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
WORKDIR /app

# 1. Dependency Resolution Stage (Caches node_modules)
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
COPY database/package.json ./database/
COPY frontend/package.json ./frontend/
COPY packages/domain-events/package.json ./packages/domain-events/
COPY packages/dpdp/package.json ./packages/dpdp/
COPY packages/validators/package.json ./packages/validators/
RUN pnpm install --frozen-lockfile

# 2. Source Compilation & Next.js Standalone Build
FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/database/node_modules ./database/node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY --from=deps /app/packages/domain-events/node_modules ./packages/domain-events/node_modules
COPY --from=deps /app/packages/dpdp/node_modules ./packages/dpdp/node_modules
COPY --from=deps /app/packages/validators/node_modules ./packages/validators/node_modules

ENV NODE_ENV=production
ENV NEXT_OUTPUT_STANDALONE=true
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @schoolmitra/database run type-check
RUN pnpm --filter @schoolmitra/validators run type-check
RUN pnpm --filter @schoolmitra/frontend build

# 3. Lean Production Runner Stage (No build tools, minimal image size)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root security isolation
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/frontend/public ./public
COPY --from=builder /app/frontend/public ./frontend/public
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "frontend/server.js"]
```

---

## 8. Amazon CloudWatch Observability & Monitoring

### 8.1 Log Group Architecture
- **Log Group**: `/ecs/educore-task`
- **Retention**: `30` days
- **Format**: Structured JSON logs capturing timestamp, log level (`INFO`, `WARN`, `ERROR`), request method, path, HTTP status, and tenant `school_id`.

### 8.2 Real-Time CloudWatch Alarms

| Alarm Name | Metric Name | Threshold | Evaluation Period | Action |
| :--- | :--- | :--- | :--- | :--- |
| **`educore-ecs-high-cpu`** | `CPUUtilization` | `> 85%` | 2 consecutive periods of 60s | Alert DevOps on-call |
| **`educore-ecs-high-memory`** | `MemoryUtilization` | `> 85%` | 2 consecutive periods of 60s | Trigger Fargate task scale-out |
| **`educore-alb-5xx-errors`** | `HTTPCode_Target_5XX_Count` | `> 5 errors` | 1 minute window | Alert engineering team |
| **`educore-rds-low-storage`** | `FreeStorageSpace` | `< 5,000 MB` | 5 minutes window | Auto-expand GP3 volume |

---

## 9. CI/CD Deployment Workflows

### 9.1 Container Deployment Sequence
1. **GitHub Actions / Local Toolchain**: Runs test suites (`vitest`) and type checks (`tsc --noEmit`).
2. **ECR Authentication**: Logs into Amazon ECR registry using AWS credentials:
   ```bash
   aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 144911976586.dkr.ecr.ap-south-1.amazonaws.com
   ```
3. **Docker Buildx Execution**: Cross-compiles for `linux/amd64` architecture:
   ```bash
   docker buildx build --platform linux/amd64 -t 144911976586.dkr.ecr.ap-south-1.amazonaws.com/educore-app:latest --push .
   ```
4. **ECS Rolling Service Update**: Forces a new deployment without downtime:
   ```bash
   aws ecs update-service --cluster educore-cluster --service educore-service --force-new-deployment --region ap-south-1
   ```
5. **ALB Target Verification**: Monitors until the new task registers as `healthy` on target group `educore-tg`, after which old tasks are safely drained and terminated.
