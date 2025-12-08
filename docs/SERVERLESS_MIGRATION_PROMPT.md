# Serverless Migration & DynamoDB Integration - Complete Transformation Prompt

## Context
You are tasked with analyzing a Next.js monolith application and transforming it into a serverless architecture with DynamoDB integration. The application is a Solar Information System (WOMS) that manages solar plant data, alerts, weather monitoring, and analytics.

## GitHub Repository
**Repository URL:** [Provide your GitHub repository URL here]
**Branch:** main (or specify branch)
**Technology Stack:**
- Next.js 14+ (App Router)
- TypeScript
- Supabase (PostgreSQL) - Current database
- Node.js 18+
- React 18+

## Current Architecture Analysis

### 1. Database Structure (PostgreSQL/Supabase)
The application uses Supabase PostgreSQL with the following schema:

**Main Database Tables:**
- `accounts` - Authentication (UUID id, account_type, email, password_hash, org_id, display_name, logo_url, is_active)
- `organizations` - Organizations (SERIAL id, name, auto_sync_enabled, sync_interval_minutes)
- `vendors` - Vendor configs (SERIAL id, name, vendor_type, credentials JSONB, org_id, tokens, sync configs)
- `plants` - Plant configs (SERIAL id, org_id, vendor_id, vendor_plant_id, name, capacity_kw, location JSONB, telemetry fields, is_active, was_online_today)
- `work_orders` - Work orders (SERIAL id, title, description, location, org_id)
- `work_order_plants` - Junction table (work_order_id, plant_id, is_active)
- `alerts` - Alerts (SERIAL id, plant_id, vendor_id, vendor_alert_id, vendor_plant_id, alert_time, end_time, title, description, severity, status, grid_down_seconds, grid_down_benefit_kwh)
- `disabled_plants` - Disabled plants snapshot
- `wms_vendors` - WMS vendors (SERIAL id, name, vendor_type, credentials, org_id, tokens)
- `wms_sites` - WMS sites (SERIAL id, wms_vendor_id, org_id, vendor_site_id, site_name, address, location, elevation, status, metadata)
- `wms_devices` - WMS devices (SERIAL id, wms_site_id, vendor_device_id, device_name, mac_address, serial_no, metadata)
- `insolation_readings` - Time-series (SERIAL id, wms_device_id, reading_date, insolation_value, reading_count, metadata)

**Analytics Database Tables:**
- `organizations` - Mirror with config hash
- `vendors` - Mirror with config hash
- `plants` - Mirror
- `analytics_snapshot_runs` - Snapshot tracking
- `plant_energy_readings` - Time-series (100-day retention)

### 2. Current Application Structure
- **Frontend:** Next.js App Router with React components
- **Backend:** Next.js API routes (`app/api/`)
- **Cron Jobs:** 9 cron jobs running in-process via `node-cron` in `server.js`
- **Services:** Business logic in `lib/services/`
- **Vendor Adapters:** Pluggable adapters in `lib/vendors/` and `lib/wms/`
- **Database Client:** Supabase client in `lib/supabase/pooled.ts`

### 3. Key Access Patterns
**Alerts:**
- Query by `plant_id` (most common)
- Query by `org_id` (through plants)
- Query by `status` (ACTIVE)
- Order by `created_at DESC`
- Deduplicate by `(vendor_id, vendor_alert_id, plant_id)`

**Plants:**
- Query by `org_id`
- Query by `vendor_id`
- Lookup by `(vendor_id, vendor_plant_id)` (unique constraint)
- Filter by `is_active`

**Accounts:**
- Lookup by `email` (for login)
- Query by `org_id`

## Target Architecture: Serverless + DynamoDB

### 1. DynamoDB Schema Design

#### Table 1: `woms-config` (Single Table Design)
**Purpose:** Stores all configuration data (organizations, vendors, plants, accounts, work orders, WMS vendors/sites/devices, disabled plants)

**Primary Key:**
- **PK:** `entity_type` (STRING) - Values: `ORG`, `VENDOR`, `PLANT`, `ACCOUNT`, `WORK_ORDER`, `WMS_VENDOR`, `WMS_SITE`, `WMS_DEVICE`, `DISABLED_PLANT`
- **SK:** `entity_id` (STRING) - Numeric ID as string or UUID

**Global Secondary Indexes (GSIs):**
1. **GSI1 (org-index):**
   - **GSI1PK:** `org_id` (STRING, INTEGER as string)
   - **GSI1SK:** `entity_type#entity_id` (e.g., `PLANT#123`)
   - **Purpose:** Query all entities for an organization

2. **GSI2 (vendor-index):**
   - **GSI2PK:** `vendor_id` (STRING, INTEGER as string)
   - **GSI2SK:** `entity_type#entity_id` (e.g., `PLANT#456`)
   - **Purpose:** Query all plants for a vendor

3. **GSI3 (email-index):**
   - **GSI3PK:** `email` (STRING)
   - **GSI3SK:** `ACCOUNT#entity_id`
   - **Purpose:** Query account by email (login)

4. **GSI4 (wms-vendor-index):**
   - **GSI4PK:** `wms_vendor_id` (STRING, INTEGER as string)
   - **GSI4SK:** `entity_type#entity_id` (e.g., `WMS_SITE#789`)
   - **Purpose:** Query all sites/devices for a WMS vendor

5. **GSI5 (wms-site-index):**
   - **GSI5PK:** `wms_site_id` (STRING, INTEGER as string)
   - **GSI5SK:** `WMS_DEVICE#entity_id`
   - **Purpose:** Query all devices for a WMS site

6. **GSI6 (vendor-plant-unique-index):**
   - **GSI6PK:** `vendor_id` (STRING, INTEGER as string)
   - **GSI6SK:** `vendor_plant_id` (STRING, e.g., `STATION123`)
   - **Purpose:** Enforce unique constraint (vendor_id, vendor_plant_id) and lookup plant by vendor_plant_id

**Item Examples:**
```
Organization:
PK: ORG, SK: 1
Attributes: name, auto_sync_enabled, sync_interval_minutes, created_at, updated_at

Vendor:
PK: VENDOR, SK: 5
GSI1PK: 1 (org_id), GSI1SK: VENDOR#5
Attributes: name, vendor_type, credentials (JSON), org_id, access_token, token_expires_at, telemetry_sync_mode, telemetry_sync_interval, plant_sync_time_ist, etc.

Plant:
PK: PLANT, SK: 123
GSI1PK: 1 (org_id), GSI1SK: PLANT#123
GSI2PK: 5 (vendor_id), GSI2SK: PLANT#123
GSI6PK: 5 (vendor_id), GSI6SK: STATION123 (vendor_plant_id)
Attributes: name, vendor_plant_id, org_id, vendor_id, capacity_kw, location (JSON), current_power_kw, daily_energy_kwh, network_status, is_active, was_online_today, etc.

Account:
PK: ACCOUNT, SK: d816d896-b60b-4e24-884c-785926d6c2c0
GSI1PK: 1 (org_id, nullable), GSI1SK: ACCOUNT#d816d896-b60b-4e24-884c-785926d6c2c0
GSI3PK: admin@woms.com (email), GSI3SK: ACCOUNT#d816d896-b60b-4e24-884c-785926d6c2c0
Attributes: account_type, email, password_hash, org_id, display_name, logo_url, is_active
```

#### Table 2: `woms-timeseries` (Time-Series Data)
**Purpose:** Stores alerts, insolation readings, plant energy readings (with TTL for auto-cleanup)

**Primary Key:**
- **PK:** `entity_type#entity_id` (STRING)
  - For Alerts: `PLANT#plant_id` (distributes across partitions for 10K+ plants)
  - For Readings: `DEVICE#device_id` or `PLANT_ENERGY#plant_id`
- **SK:** `timestamp` or `timestamp#unique_id` (STRING)
  - For Alerts: `alert_time#alert_id` (e.g., `2025-12-08T14:30:00Z#789`) - enables sorting by time, unique per alert
  - For Readings: `reading_date` (e.g., `2025-12-08`)

**Global Secondary Indexes (GSIs):**
1. **GSI1 (date-index):**
   - **GSI1PK:** `reading_date` (STRING, DATE format: `2025-12-08`)
   - **GSI1SK:** `entity_type#entity_id`
   - **Purpose:** Query all readings/alerts for a specific date across all entities

2. **GSI2 (plant-alert-index):**
   - **GSI2PK:** `plant_id` (STRING, INTEGER as string)
   - **GSI2SK:** `alert_time#alert_id` (same as SK for consistency)
   - **Purpose:** Query all alerts for a plant, sorted by alert_time descending

3. **GSI3 (vendor-alert-index):**
   - **GSI3PK:** `vendor_id#vendor_plant_id` (STRING, e.g., `5#STATION123`)
   - **GSI3SK:** `vendor_alert_id#alert_time` (STRING)
   - **Purpose:** Deduplicate alerts by (vendor_id, vendor_alert_id, plant_id)

4. **GSI4 (alert-id-index):**
   - **GSI4PK:** `id` (STRING, alert_id, INTEGER as string)
   - **GSI4SK:** `PLANT#plant_id`
   - **Purpose:** Direct lookup of alert by ID (for updates/deletes)

**TTL Attribute:**
- **Attribute:** `ttl` (NUMBER, Unix timestamp in seconds)
- **Insolation readings:** TTL = reading_date + 100 days
- **Alerts:** TTL = alert_time + 365 days (1 year retention)
- **Plant energy readings:** TTL = reading_date + 100 days
- DynamoDB automatically deletes expired items

**Item Examples:**
```
Alert:
PK: PLANT#123 (plant_id for distribution), SK: 2025-12-08T14:30:00Z#789 (alert_time#alert_id)
GSI2PK: 123 (plant_id), GSI2SK: 2025-12-08T14:30:00Z#789
GSI3PK: 5#STATION123 (vendor_id#vendor_plant_id), GSI3SK: ALERT123#2025-12-08T14:30:00Z
GSI4PK: 789 (alert_id), GSI4SK: PLANT#123
ttl: 1736359800 (alert_time + 365 days)
Attributes: id, plant_id, vendor_id, vendor_alert_id, vendor_plant_id, alert_time, end_time, title, description, severity, status, grid_down_seconds, grid_down_benefit_kwh, created_at, updated_at

Insolation Reading:
PK: DEVICE#456, SK: 2025-12-08
GSI1PK: 2025-12-08, GSI1SK: DEVICE#456
ttl: 1736359800 (reading_date + 100 days)
Attributes: wms_device_id, insolation_value, reading_count, metadata (JSON), created_at, updated_at

Plant Energy Reading (Analytics):
PK: PLANT_ENERGY#123, SK: 2025-12-08
GSI1PK: 2025-12-08, GSI1SK: PLANT_ENERGY#123
ttl: 1736359800 (reading_date + 100 days)
Attributes: plant_id, org_id, vendor_id, vendor_plant_id, reading_date, daily_energy_kwh, monthly_energy_kwh, yearly_energy_mwh, total_energy_mwh, was_online, metadata (JSON)
```

#### Table 3: `woms-junctions` (Junction/Relationship Data)
**Purpose:** Stores many-to-many relationships: work_order_plants

**Primary Key:**
- **PK:** `parent_type#parent_id` (STRING, e.g., `WORK_ORDER#100`)
- **SK:** `child_type#child_id` (STRING, e.g., `PLANT#123`)

**Global Secondary Index:**
1. **GSI1 (plant-workorder-index):**
   - **GSI1PK:** `child_type#child_id` (STRING, e.g., `PLANT#123`)
   - **GSI1SK:** `parent_type#parent_id` (STRING, e.g., `WORK_ORDER#100`)
   - **Purpose:** Query all work orders for a plant (reverse lookup)
   - **Unique Constraint:** Use conditional write (ConditionExpression) to enforce one active work order per plant

**Item Example:**
```
Work Order Plant:
PK: WORK_ORDER#100, SK: PLANT#123
GSI1PK: PLANT#123, GSI1SK: WORK_ORDER#100
Attributes: work_order_id, plant_id, is_active, added_at
```

#### Table 4: `woms-analytics-config` (Analytics DB Mirror)
**Purpose:** Stores mirrored configuration from main DB for analytics (organizations, vendors, plants, snapshot runs)

**Primary Key:**
- **PK:** `entity_type` (STRING) - Values: `ANALYTICS_ORG`, `ANALYTICS_VENDOR`, `ANALYTICS_PLANT`, `SNAPSHOT_RUN`
- **SK:** `entity_id` (STRING) - Numeric ID as string, or composite key for snapshot runs: `vendor_id#started_at`

**Global Secondary Indexes:**
1. **GSI1 (analytics-org-index):**
   - **GSI1PK:** `org_id` (STRING)
   - **GSI1SK:** `entity_type#entity_id`
   - **Purpose:** Query all analytics entities for an organization

2. **GSI2 (analytics-vendor-index):**
   - **GSI2PK:** `vendor_id` (STRING)
   - **GSI2SK:** `entity_type#entity_id` or `started_at` (for snapshot runs)
   - **Purpose:** Query analytics plants and snapshot runs for a vendor

### 2. Frontend Deployment Strategy

**Recommended Option: Vercel (Best for Next.js)**
- **Why:** Native Next.js support, zero-config deployment, automatic CI/CD, edge functions, built-in analytics
- **Cost:** Free tier (100 GB bandwidth/month) or Pro ($20/month, unlimited bandwidth)
- **Alternative:** Netlify ($19/month), Cloudflare Pages (free, unlimited bandwidth), AWS S3+CloudFront (~$4-5/month)

**Frontend Changes Required:**
1. **Option A (Recommended):** Keep Next.js App Router, deploy to Vercel
   - No code changes needed
   - Update API base URL: `NEXT_PUBLIC_API_BASE_URL`
   - Configure CORS in API Gateway
   - Environment variables set in Vercel dashboard

2. **Option B:** Convert to static export
   - Run: `next build && next export`
   - Deploy `out/` directory to S3/CloudFront or Netlify
   - Remove server-side rendering dependencies
   - Update API calls to use fetch (no server-side API routes)

**Deployment Steps (Vercel):**
1. Connect GitHub repository to Vercel
2. Set environment variables:
   - `NEXT_PUBLIC_API_BASE_URL=https://api-gateway-url.execute-api.region.amazonaws.com/prod`
   - `NEXT_PUBLIC_ENVIRONMENT=production`
3. Configure build settings:
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Framework Preset: Next.js
4. Deploy automatically on push to main branch
5. Set up custom domain and SSL (automatic)

**vercel.json Configuration:**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_API_BASE_URL": "@api-base-url"
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Credentials", "value": "true" },
        { "key": "Access-Control-Allow-Origin", "value": "*" }
      ]
    }
  ]
}
```

### 3. Backend Serverless Architecture

**AWS Lambda Functions:**
Each API route becomes a Lambda function:
- `/api/vendors` → `lambda-vendors-handler`
- `/api/plants` → `lambda-plants-handler`
- `/api/alerts` → `lambda-alerts-handler`
- `/api/dashboard` → `lambda-dashboard-handler`
- `/api/wms/*` → `lambda-wms-handler`
- `/api/analytics/*` → `lambda-analytics-handler`
- All other API routes → Individual Lambda functions

**API Gateway:**
- REST API Gateway for HTTP endpoints
- Configure CORS for frontend access
- Custom authorizers for authentication (optional)
- Rate limiting and throttling

**EventBridge (Cron Jobs):**
Replace 9 cron jobs with EventBridge Rules:
- `lambda-plant-sync` (triggered daily at vendor-specified time)
- `lambda-telemetry-sync` (triggered every 15 minutes)
- `lambda-alert-sync` (triggered every 30 minutes)
- `lambda-wms-site-sync` (triggered daily)
- `lambda-wms-insolation-sync` (triggered daily at 6 AM IST)
- `lambda-disable-plants` (triggered daily at 2 AM IST)
- `lambda-analytics-config-mirror` (triggered daily)
- `lambda-analytics-snapshot` (triggered daily at 10 PM IST)
- `lambda-reset-was-online` (triggered daily at 12:05 AM IST)

### 4. Authentication Strategy

**Current:** HTTP-only cookies with base64-encoded JSON session

**Serverless Approach:**
- **Option A (Recommended):** Keep cookie-based authentication
  - Cookies work with API Gateway
  - Configure CORS properly for cross-domain cookies:
    ```typescript
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://your-frontend-domain.com',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
    ```
  - Use `SameSite=None; Secure` for cross-domain cookies
  - Set cookie domain/path appropriately
  - Validate session in each Lambda function:
    ```typescript
    function getSessionFromCookies(event: APIGatewayProxyEvent) {
      const cookies = event.headers.Cookie || event.headers.cookie || ''
      const sessionCookie = cookies.split(';').find(c => c.trim().startsWith('session='))
      if (!sessionCookie) return null
      const sessionValue = sessionCookie.split('=')[1]
      return JSON.parse(Buffer.from(sessionValue, 'base64').toString())
    }
    ```

- **Option B:** Lambda Authorizer (for better performance)
  - Create separate Lambda authorizer function
  - Validates session and returns IAM policy
  - API Gateway caches authorizer response (TTL: 300 seconds)
  - Reduces Lambda invocations for auth checks

**Implementation:**
- Shared authentication logic in Lambda Layer
- Session validation utility function
- Error handling for invalid/expired sessions
- Support for both CRON_SECRET (for cron jobs) and session cookies (for UI)

## Required Code Transformations

### Phase 1: Database Client Abstraction

**Create:** `lib/dynamodb/client.ts`
```typescript
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb"

let dynamoClient: DynamoDBDocumentClient | null = null

export function getDynamoClient(): DynamoDBDocumentClient {
  if (!dynamoClient) {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || "ap-south-1",
    })
    dynamoClient = DynamoDBDocumentClient.from(client)
  }
  return dynamoClient
}
```

**Create:** `lib/database/repository.ts` (Abstraction layer)
```typescript
// Repository interface that supports both Supabase and DynamoDB
export interface Repository<T> {
  findById(id: string): Promise<T | null>
  findByOrgId(orgId: number): Promise<T[]>
  create(entity: T): Promise<T>
  update(id: string, updates: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
}
```

### Phase 2: DynamoDB Repository Implementations

**Create:** `lib/dynamodb/repositories/`
- `organizationRepository.ts`
- `vendorRepository.ts`
- `plantRepository.ts`
- `accountRepository.ts`
- `alertRepository.ts`
- `wmsRepository.ts`
- `insolationRepository.ts`

**Each repository must:**
- Implement query patterns using PK/SK and GSIs
- Handle batch operations (BatchGetItem, BatchWriteItem)
- Support pagination (LastEvaluatedKey)
- Handle conditional writes for unique constraints
- Map DynamoDB items to TypeScript types

### Phase 3: Service Layer Updates

**Update:** `lib/services/`
- Replace direct Supabase calls with repository calls
- Add feature flag: `USE_DYNAMODB` environment variable
- Support both Supabase and DynamoDB implementations
- Update all services:
  - `plantSyncService.ts`
  - `liveTelemetrySyncService.ts`
  - `alertSyncService.ts`
  - `wmsSyncService.ts`
  - `analyticsMirrorService.ts`
  - `analyticsSnapshotService.ts`

### Phase 4: Lambda Function Handlers

**Create:** `lambda/functions/`
- `vendors/handler.ts` - Handles `/api/vendors/*`
- `plants/handler.ts` - Handles `/api/plants/*`
- `alerts/handler.ts` - Handles `/api/alerts/*`
- `dashboard/handler.ts` - Handles `/api/dashboard`
- `wms/handler.ts` - Handles `/api/wms/*`
- `analytics/handler.ts` - Handles `/api/analytics/*`
- `cron/plant-sync/handler.ts` - Plant sync cron
- `cron/telemetry-sync/handler.ts` - Telemetry sync cron
- `cron/alert-sync/handler.ts` - Alert sync cron
- `cron/wms-site-sync/handler.ts` - WMS site sync cron
- `cron/wms-insolation-sync/handler.ts` - WMS insolation sync cron
- `cron/disable-plants/handler.ts` - Disable plants cron
- `cron/analytics-config-mirror/handler.ts` - Analytics config mirror cron
- `cron/analytics-snapshot/handler.ts` - Analytics snapshot cron
- `cron/reset-was-online/handler.ts` - Reset was_online_today cron

**Each Lambda handler must:**
- Parse API Gateway event or EventBridge event
- Extract session from cookies (for API routes)
- Call appropriate service function
- Return proper API Gateway response format
- Handle errors and return appropriate status codes
- Set CORS headers

### Phase 5: Infrastructure as Code

**Create:** `infrastructure/`
- `cdk/` or `serverless/` or `sam/` configuration
- Define all Lambda functions
- Define API Gateway routes
- Define EventBridge rules
- Define DynamoDB tables and GSIs
- Define IAM roles and policies
- Define environment variables
- Define Lambda Layers for shared code

**Recommended:** AWS CDK (TypeScript) or Serverless Framework

### Phase 6: Frontend Updates

**Update:** `app/` and `components/`
- Update API base URL to API Gateway URL
- Handle CORS for cross-domain requests
- Update environment variables (build-time only)
- Remove server-side rendering dependencies (if converting to static export)
- Update authentication cookie settings

**Create:** `.env.production` with:
```
NEXT_PUBLIC_API_BASE_URL=https://api-gateway-url.execute-api.region.amazonaws.com/prod
```

### Phase 7: Data Migration Script

**Create:** `scripts/migrate-to-dynamodb.ts`
- Export data from Supabase (JSON format)
- Transform to DynamoDB item format (PK/SK structure)
- Batch write to DynamoDB (25 items per batch)
- Validate data integrity (compare counts, sample records)
- Run in parallel for faster migration
- Support rollback mechanism

## Detailed Implementation Requirements

### 1. Query Pattern Implementations

**Get all plants for an organization:**
```typescript
// Query GSI1 (org-index) where GSI1PK = org_id AND GSI1SK begins_with "PLANT#"
const params = {
  TableName: 'woms-config',
  IndexName: 'org-index',
  KeyConditionExpression: 'GSI1PK = :orgId AND begins_with(GSI1SK, :prefix)',
  ExpressionAttributeValues: {
    ':orgId': orgId.toString(),
    ':prefix': 'PLANT#'
  }
}
```

**Get all alerts for a plant (recent first):**
```typescript
// Query woms-timeseries where PK = PLANT#plant_id, ScanIndexForward = false
const params = {
  TableName: 'woms-timeseries',
  KeyConditionExpression: 'PK = :pk',
  ExpressionAttributeValues: {
    ':pk': `PLANT#${plantId}`
  },
  ScanIndexForward: false, // DESC order
  Limit: limit
}
```

**Get alert by ID:**
```typescript
// Query GSI4 (alert-id-index) where GSI4PK = alert_id
const params = {
  TableName: 'woms-timeseries',
  IndexName: 'alert-id-index',
  KeyConditionExpression: 'GSI4PK = :alertId',
  ExpressionAttributeValues: {
    ':alertId': alertId.toString()
  }
}
```

**Deduplicate alert by vendor_alert_id:**
```typescript
// Query GSI3 (vendor-alert-index) where GSI3PK = vendor_id#vendor_plant_id AND GSI3SK begins_with vendor_alert_id
const params = {
  TableName: 'woms-timeseries',
  IndexName: 'vendor-alert-index',
  KeyConditionExpression: 'GSI3PK = :vendorPlant AND begins_with(GSI3SK, :alertId)',
  ExpressionAttributeValues: {
    ':vendorPlant': `${vendorId}#${vendorPlantId}`,
    ':alertId': vendorAlertId
  }
}
```

### 2. Batch Operations

**Batch write plants (100 per batch):**
```typescript
const batches = chunk(plants, 25) // DynamoDB limit
for (const batch of batches) {
  const requests = batch.map(plant => ({
    PutRequest: {
      Item: transformPlantToDynamoItem(plant)
    }
  }))
  await dynamoClient.send(new BatchWriteCommand({
    RequestItems: {
      'woms-config': requests
    }
  }))
}
```

### 3. Conditional Writes (Unique Constraints)

**Enforce unique (vendor_id, vendor_plant_id):**
```typescript
const params = {
  TableName: 'woms-config',
  Item: plantItem,
  ConditionExpression: 'attribute_not_exists(PK) OR GSI6PK <> :vendorId OR GSI6SK <> :vendorPlantId',
  ExpressionAttributeValues: {
    ':vendorId': vendorId.toString(),
    ':vendorPlantId': vendorPlantId
  }
}
```

### 4. TTL Implementation

**Set TTL for alerts:**
```typescript
const alertItem = {
  PK: `PLANT#${plantId}`,
  SK: `${alertTime}#${alertId}`,
  // ... other attributes
  ttl: Math.floor((new Date(alertTime).getTime() + 365 * 24 * 60 * 60 * 1000) / 1000) // +365 days
}
```

### 5. Pagination

**Implement pagination with LastEvaluatedKey:**
```typescript
let lastEvaluatedKey = undefined
const items = []

do {
  const result = await dynamoClient.send(new QueryCommand({
    TableName: 'woms-timeseries',
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': `PLANT#${plantId}` },
    ExclusiveStartKey: lastEvaluatedKey,
    Limit: 100
  }))
  
  items.push(...result.Items || [])
  lastEvaluatedKey = result.LastEvaluatedKey
} while (lastEvaluatedKey)
```

## Deployment Architecture

### Frontend Deployment (Vercel Recommended)

**Project Structure:**
```
frontend/
├── app/              # Next.js app directory
├── components/       # React components
├── lib/              # Shared utilities (no DB clients)
├── public/           # Static assets
├── vercel.json       # Vercel configuration
└── package.json
```

**vercel.json:**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "env": {
    "NEXT_PUBLIC_API_BASE_URL": "@api-base-url"
  }
}
```

**Environment Variables (Vercel Dashboard):**
- `NEXT_PUBLIC_API_BASE_URL` - API Gateway URL
- `NEXT_PUBLIC_ENVIRONMENT` - production/staging

### Backend Deployment (AWS Lambda)

**Project Structure:**
```
backend/
├── lambda/
│   ├── functions/        # Individual Lambda functions
│   │   ├── vendors/
│   │   ├── plants/
│   │   ├── alerts/
│   │   └── cron/
│   ├── layers/           # Shared code (adapters, services)
│   └── shared/           # Shared utilities
├── infrastructure/       # CDK/Serverless config
└── package.json
```

**Lambda Layer Structure:**
```
layer/
├── nodejs/
│   ├── node_modules/     # Shared dependencies
│   └── lib/              # Shared code (adapters, services, repositories)
```

**CDK Example (TypeScript):**
```typescript
// infrastructure/cdk/lib/stack.ts
import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as events from 'aws-cdk-lib/aws-events'

export class WomsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // DynamoDB Tables
    const configTable = new dynamodb.Table(this, 'WomsConfig', {
      tableName: 'woms-config',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      // ... GSIs
    })

    // Lambda Layer
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset('lambda/layers/shared'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
    })

    // Lambda Functions
    const vendorsHandler = new lambda.Function(this, 'VendorsHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/functions/vendors'),
      layers: [sharedLayer],
      environment: {
        CONFIG_TABLE: configTable.tableName,
        TIMESERIES_TABLE: timeseriesTable.tableName,
      },
    })

    // API Gateway
    const api = new apigateway.RestApi(this, 'WomsApi', {
      restApiName: 'WOMS API',
      defaultCorsPreflightOptions: {
        allowOrigins: ['https://your-frontend-domain.com'],
        allowCredentials: true,
      },
    })

    // EventBridge Rules for Cron Jobs
    const plantSyncRule = new events.Rule(this, 'PlantSyncRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '2' }), // 2 AM IST
    })
    plantSyncRule.addTarget(new targets.LambdaFunction(plantSyncHandler))
  }
}
```

## Migration Checklist

### Pre-Migration
- [ ] Set up AWS account and configure credentials
- [ ] Create DynamoDB tables with all GSIs
- [ ] Set up API Gateway
- [ ] Set up EventBridge rules
- [ ] Create Lambda Layer with shared code
- [ ] Set up Vercel/Netlify account for frontend

### Phase 1: Database Migration
- [ ] Create DynamoDB client abstraction
- [ ] Implement repository interfaces
- [ ] Implement DynamoDB repositories
- [ ] Create data migration script
- [ ] Run migration script (test on staging first)
- [ ] Validate data integrity

### Phase 2: Backend Migration
- [ ] Convert API routes to Lambda functions
- [ ] Update service layer to use repositories
- [ ] Add feature flag for Supabase/DynamoDB selection
- [ ] Deploy Lambda functions
- [ ] Configure API Gateway routes
- [ ] Test all API endpoints

### Phase 3: Cron Jobs Migration
- [ ] Convert cron jobs to EventBridge-triggered Lambdas
- [ ] Update cron handlers to use new repositories
- [ ] Deploy cron Lambdas
- [ ] Configure EventBridge rules
- [ ] Test cron execution

### Phase 4: Frontend Migration
- [ ] Update API base URL
- [ ] Configure CORS
- [ ] Update environment variables
- [ ] Deploy to Vercel/Netlify
- [ ] Test end-to-end

### Phase 5: Validation
- [ ] Run integration tests
- [ ] Monitor Lambda execution logs
- [ ] Monitor DynamoDB metrics
- [ ] Validate cost savings
- [ ] Performance testing

## Cost Optimization

**DynamoDB Free Tier:**
- 25 GB storage (permanently free)
- 25 read units (~200M reads/month free)
- 25 write units (~200M writes/month free)

**Expected Monthly Costs (10K plants):**
- DynamoDB: $0 (within free tier)
- Lambda: ~$2.66/month
- API Gateway: $0 (within free tier)
- EventBridge: $0 (within free tier)
- CloudWatch Logs: $0 (within free tier)
- Frontend (Vercel Pro): $20/month
- **Total: ~$22.66/month** (vs $89.38/month current)

## Testing Strategy

1. **Unit Tests:** Test repository implementations
2. **Integration Tests:** Test Lambda functions with DynamoDB Local
3. **E2E Tests:** Test complete flows (frontend → API Gateway → Lambda → DynamoDB)
4. **Load Tests:** Test with 10K plants, 1.5M alerts/month
5. **Cost Tests:** Monitor AWS costs during testing

## Documentation Requirements

1. **API Documentation:** Update Swagger/OpenAPI specs
2. **Architecture Diagrams:** Draw new serverless architecture
3. **Deployment Guide:** Step-by-step deployment instructions
4. **Troubleshooting Guide:** Common issues and solutions
5. **Cost Analysis:** Detailed cost breakdown

## Deliverables

1. **Complete Codebase:** Transformed code with all changes
2. **Infrastructure Code:** CDK/Serverless/SAM configuration
3. **Migration Scripts:** Data migration and validation scripts
4. **Documentation:** Updated architecture and deployment docs
5. **Test Suite:** Comprehensive test coverage
6. **Deployment Guide:** Step-by-step deployment instructions

## Success Criteria

1. ✅ All API endpoints working with DynamoDB
2. ✅ All cron jobs running via EventBridge
3. ✅ Frontend deployed and connected to API Gateway
4. ✅ Data migration completed successfully
5. ✅ Performance meets or exceeds current architecture
6. ✅ Costs reduced by 80%+ (within free tier)
7. ✅ Zero data loss during migration
8. ✅ All tests passing

## Additional Considerations

1. **Rollback Plan:** Ability to rollback to Supabase if needed
2. **Monitoring:** CloudWatch dashboards for Lambda and DynamoDB
3. **Alerts:** CloudWatch alarms for errors and high costs
4. **Backup:** DynamoDB point-in-time recovery enabled
5. **Security:** IAM roles with least privilege, encryption at rest
6. **Compliance:** Ensure data residency requirements met

## Questions to Answer During Analysis

1. What are all the query patterns used in the current codebase?
2. Are there any complex joins that need to be refactored?
3. What are the performance bottlenecks in the current architecture?
4. How can we optimize DynamoDB query patterns?
5. What are the critical paths that need the most testing?
6. How do we handle transactions that span multiple tables?
7. What is the rollback strategy if migration fails?

---

**Start your analysis by:**
1. Cloning the repository
2. Analyzing the current database schema and access patterns
3. Identifying all API routes and their dependencies
4. Mapping all query patterns to DynamoDB queries
5. Creating a detailed migration plan
6. Implementing the transformations phase by phase
7. Testing thoroughly at each phase
8. Documenting all changes

**Remember:** This is a complex migration. Take it step by step, test thoroughly, and maintain the ability to rollback if needed.

## Frontend Deployment Options Comparison

| Option | Cost | Setup Complexity | Next.js Support | Bandwidth | Recommendation |
|--------|------|------------------|-----------------|-----------|----------------|
| **Vercel** | Free/$20/mo | Low | Excellent | 100GB/Unlimited | ⭐⭐⭐⭐⭐ Best for Next.js |
| **Netlify** | Free/$19/mo | Low | Excellent | 100GB/Unlimited | ⭐⭐⭐⭐ Good alternative |
| **Cloudflare Pages** | Free | Low | Good | Unlimited | ⭐⭐⭐⭐ Best free option |
| **AWS S3+CloudFront** | ~$4-5/mo | Medium | Requires static export | Pay-per-use | ⭐⭐⭐ Best for AWS ecosystem |

**Recommendation:** Use **Vercel** for frontend deployment. It provides the best Next.js experience with zero-config deployment, automatic CI/CD, and excellent performance. The $20/month Pro tier is cost-effective for production.

## Backend Deployment Architecture

**Recommended Stack:**
- **Compute:** AWS Lambda (serverless functions)
- **API:** API Gateway REST API
- **Scheduling:** EventBridge Rules (cron jobs)
- **Database:** DynamoDB (configuration) + Supabase (time-series, hybrid approach)
- **Storage:** S3 (for static assets, if needed)
- **Monitoring:** CloudWatch Logs + Metrics
- **Secrets:** AWS Secrets Manager + Parameter Store

**Infrastructure as Code:**
- **Recommended:** AWS CDK (TypeScript) - Type-safe, excellent IDE support
- **Alternative:** Serverless Framework - Simpler YAML config
- **Alternative:** AWS SAM - Native AWS tooling

## Step-by-Step Migration Plan

### Week 1: Preparation & Setup
1. Set up AWS account and configure credentials
2. Create DynamoDB tables with all GSIs
3. Set up Vercel account and connect GitHub repo
4. Create AWS CDK/Serverless project structure
5. Set up development environment

### Week 2: Database Layer
1. Create DynamoDB client abstraction
2. Implement repository interfaces
3. Implement DynamoDB repositories (start with one entity)
4. Add feature flag for Supabase/DynamoDB selection
5. Test repository implementations

### Week 3: Service Layer Updates
1. Update services to use repositories
2. Test all service functions
3. Update vendor adapters (if needed)
4. Update WMS adapters (if needed)

### Week 4: Lambda Functions
1. Convert API routes to Lambda functions
2. Create Lambda Layer with shared code
3. Deploy Lambda functions
4. Configure API Gateway routes
5. Test all API endpoints

### Week 5: Cron Jobs Migration
1. Convert cron jobs to EventBridge-triggered Lambdas
2. Configure EventBridge rules
3. Test cron execution
4. Monitor logs and metrics

### Week 6: Frontend Migration
1. Update API base URL
2. Configure CORS
3. Deploy to Vercel
4. Test end-to-end

### Week 7: Data Migration
1. Create migration script
2. Run migration on staging
3. Validate data integrity
4. Run migration on production
5. Monitor for issues

### Week 8: Testing & Optimization
1. Run integration tests
2. Performance testing
3. Cost optimization
4. Documentation updates
5. Team training

## Critical Implementation Details

### 1. Alert Partition Key Strategy
**Important:** Use `PLANT#plant_id` as PK (not `ALERT#alert_id`) to distribute alerts across partitions for 10K+ plants. This prevents hot partition issues.

**SK Format:** `alert_time#alert_id` (e.g., `2025-12-08T14:30:00Z#789`)
- Enables sorting by time (DESC order)
- Ensures uniqueness per alert
- Allows range queries by time

### 2. Connection Pooling in Lambda
**Challenge:** Lambda doesn't support persistent connection pooling
**Solutions:**
- Use Supabase connection pooling (pgBouncer) for time-series data
- Reuse DynamoDB client within Lambda execution context (warm starts)
- Consider RDS Proxy if migrating time-series to RDS
- Use connection reuse pattern (initialize outside handler)

### 3. Long-Running Sync Operations
**Challenge:** Lambda 15-minute timeout limit
**Solutions:**
- Break large syncs into smaller batches (100 plants per invocation)
- Use Step Functions for orchestration (chain multiple Lambdas)
- Use SQS + Lambda for async processing (queue-based)
- Consider ECS Fargate for truly long-running tasks (if needed)

### 4. Cold Start Mitigation
**Strategies:**
- Use Lambda Provisioned Concurrency for critical functions
- Optimize Lambda bundle size (tree-shaking, exclude unused deps)
- Initialize heavy dependencies outside handler (reuse in warm starts)
- Use Lambda Layers for shared code (reduces bundle size)
- Keep frequently-used functions warm (scheduled ping)

### 5. Error Handling & Retries
- Implement exponential backoff for DynamoDB throttling
- Use Dead Letter Queues (DLQ) for failed Lambda invocations
- Set up CloudWatch Alarms for errors
- Implement retry logic in service layer
- Log all errors with MDC context

### 6. Data Consistency
- Use DynamoDB transactions for multi-item operations (within same partition)
- Implement idempotency keys for retries
- Use conditional writes for unique constraints
- Validate data integrity after migration
- Implement data validation in repositories

## Code Structure After Migration

```
woms-serverless/
├── frontend/                    # Next.js frontend (deployed to Vercel)
│   ├── app/
│   ├── components/
│   ├── lib/                     # Shared utilities (no DB clients)
│   └── package.json
│
├── backend/
│   ├── lambda/
│   │   ├── functions/          # Individual Lambda functions
│   │   │   ├── vendors/
│   │   │   │   └── handler.ts
│   │   │   ├── plants/
│   │   │   │   └── handler.ts
│   │   │   ├── alerts/
│   │   │   │   └── handler.ts
│   │   │   └── cron/
│   │   │       ├── plant-sync/
│   │   │       │   └── handler.ts
│   │   │       └── telemetry-sync/
│   │   │           └── handler.ts
│   │   └── layers/
│   │       └── shared/          # Lambda Layer
│   │           ├── nodejs/
│   │           │   ├── lib/
│   │           │   │   ├── dynamodb/      # DynamoDB repositories
│   │           │   │   ├── vendors/       # Vendor adapters
│   │           │   │   ├── wms/            # WMS adapters
│   │           │   │   └── services/       # Business logic
│   │           │   └── node_modules/
│   │
│   ├── infrastructure/          # Infrastructure as Code
│   │   └── cdk/
│   │       ├── lib/
│   │       │   └── stack.ts     # CDK stack definition
│   │       └── bin/
│   │           └── app.ts       # CDK app entry point
│   │
│   └── scripts/
│       ├── migrate-to-dynamodb.ts
│       └── validate-migration.ts
│
└── docs/
    ├── SERVERLESS_MIGRATION_PROMPT.md
    └── DEPLOYMENT_GUIDE.md
```

## Environment Variables

### Frontend (Vercel)
```
NEXT_PUBLIC_API_BASE_URL=https://api-gateway-url.execute-api.ap-south-1.amazonaws.com/prod
NEXT_PUBLIC_ENVIRONMENT=production
```

### Backend (Lambda)
```
AWS_REGION=ap-south-1
CONFIG_TABLE=woms-config
TIMESERIES_TABLE=woms-timeseries
JUNCTIONS_TABLE=woms-junctions
ANALYTICS_CONFIG_TABLE=woms-analytics-config
USE_DYNAMODB=true
SUPABASE_URL=... (for time-series data, hybrid approach)
SUPABASE_SERVICE_ROLE_KEY=... (for time-series data)
CRON_SECRET=... (for cron job authentication)
```

### AWS Credentials
```
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

## Testing Checklist

### Unit Tests
- [ ] Repository implementations (DynamoDB queries)
- [ ] Service layer functions
- [ ] Vendor adapter methods
- [ ] Utility functions

### Integration Tests
- [ ] Lambda functions with DynamoDB Local
- [ ] API Gateway → Lambda → DynamoDB flow
- [ ] EventBridge → Lambda flow
- [ ] Authentication flow

### E2E Tests
- [ ] Frontend → API Gateway → Lambda → DynamoDB
- [ ] Complete user workflows
- [ ] Cron job execution
- [ ] Error scenarios

### Performance Tests
- [ ] Lambda cold start times
- [ ] DynamoDB query performance
- [ ] API Gateway latency
- [ ] Concurrent request handling

### Cost Tests
- [ ] Monitor AWS costs during testing
- [ ] Validate free tier usage
- [ ] Optimize Lambda memory/timeout
- [ ] Optimize DynamoDB read/write units

## Rollback Plan

1. **Keep Supabase code:** Maintain feature flag to switch back
2. **Dual-write:** Write to both Supabase and DynamoDB during migration
3. **Data validation:** Compare data between both databases
4. **Gradual cutover:** Migrate one service at a time
5. **Monitoring:** Set up alerts for errors/issues
6. **Documentation:** Document rollback procedure

## Success Metrics

- ✅ All API endpoints working
- ✅ All cron jobs executing successfully
- ✅ Frontend deployed and functional
- ✅ Data migration completed (zero data loss)
- ✅ Performance meets or exceeds current architecture
- ✅ Costs reduced by 80%+ (within free tier)
- ✅ Zero downtime during migration
- ✅ All tests passing
- ✅ Documentation complete

---

**Final Notes:**
- Start with a small scope (one API route or one cron job)
- Test thoroughly before expanding
- Monitor costs and performance continuously
- Keep the ability to rollback at all times
- Document all decisions and changes
- Train the team on the new architecture

**Good luck with your migration!** 🚀

