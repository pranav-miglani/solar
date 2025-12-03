# New Relic APM Setup Guide for Solar Information System

This guide provides step-by-step instructions for integrating New Relic APM (Application Performance Monitoring) into the Solar Information System to monitor performance, track business metrics, and set up SLOs/SLIs.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Create New Relic Account](#step-1-create-new-relic-account)
3. [Step 2: Install New Relic Agent](#step-2-install-new-relic-agent)
4. [Step 3: Configure New Relic](#step-3-configure-new-relic)
5. [Step 4: Add Custom Business Metrics](#step-4-add-custom-business-metrics)
6. [Step 5: Create Performance Dashboards](#step-5-create-performance-dashboards)
7. [Step 6: Set Up SLOs/SLIs](#step-6-set-up-slosslis)
8. [Step 7: Configure Alerts](#step-7-configure-alerts)
9. [Step 8: Verify Integration](#step-8-verify-integration)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- **Node.js 18+** installed
- **npm** or **yarn** package manager
- **New Relic account** (free tier available)
- **Access to production/staging environment** for deployment
- **Environment variable access** for configuration

---

## Step 1: Create New Relic Account

### 1.1 Sign Up for New Relic

1. Go to [https://newrelic.com/signup](https://newrelic.com/signup)
2. Choose the **Free Forever** plan (includes 100GB/month data ingest)
3. Complete the signup process with your email
4. Verify your email address

### 1.2 Create a New Application

1. Log in to New Relic One dashboard
2. Navigate to **APM & Services** → **Add more data**
3. Select **APM** → **Node.js**
4. Note your **License Key** (you'll need this later)
5. Note your **Application Name** (e.g., "Solar Information System")

### 1.3 Get Your License Key

1. Click on your account name (top right)
2. Go to **Account settings** → **API keys**
3. Copy your **License Key** (starts with `NRAL-` or similar)
4. Store it securely - you'll add it to environment variables

---

## Step 2: Install New Relic Agent

### 2.1 Install the Package

In your project root directory, run:

```bash
npm install newrelic --save
```

Or with yarn:

```bash
yarn add newrelic
```

### 2.2 Create New Relic Configuration File

Create a new file `newrelic.js` in the project root:

```javascript
'use strict'

/**
 * New Relic agent configuration.
 *
 * See lib/config/default.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
  /**
   * Array of application names.
   */
  app_name: [process.env.NEW_RELIC_APP_NAME || 'Solar Information System'],
  
  /**
   * Your New Relic license key.
   */
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  
  /**
   * This setting controls whether the agent collects performance metrics.
   */
  agent_enabled: process.env.NODE_ENV === 'production' || process.env.NEW_RELIC_ENABLED === 'true',
  
  /**
   * This setting controls whether the agent collects error traces.
   */
  error_collector: {
    enabled: true,
    capture_events: true,
    max_event_samples_stored: 100
  },
  
  /**
   * This setting controls whether the agent collects transaction traces.
   */
  transaction_tracer: {
    enabled: true,
    record_sql: 'obfuscated',
    explain_threshold: 500
  },
  
  /**
   * This setting controls whether the agent collects distributed tracing.
   */
  distributed_tracing: {
    enabled: true
  },
  
  /**
   * This setting controls whether the agent collects custom events.
   */
  custom_insights_events: {
    enabled: true
  },
  
  /**
   * This setting controls whether the agent collects browser monitoring.
   */
  browser_monitoring: {
    enable: false // Disable browser monitoring for API-only app
  },
  
  /**
   * Logging configuration
   */
  logging: {
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
    filepath: 'stdout'
  },
  
  /**
   * Application logging configuration
   */
  application_logging: {
    enabled: true,
    forwarding: {
      enabled: true,
      max_samples_stored: 10000
    },
    local_decorating: {
      enabled: false
    }
  },
  
  /**
   * Labels for organizing applications
   */
  labels: process.env.NEW_RELIC_LABELS || 'environment:production'
}
```

---

## Step 3: Configure New Relic

### 3.1 Update Environment Variables

Add the following to your `.env` or `.env.production` file:

```env
# New Relic Configuration
NEW_RELIC_LICENSE_KEY=your_license_key_here
NEW_RELIC_APP_NAME=Solar Information System
NEW_RELIC_ENABLED=true
NEW_RELIC_LOG_LEVEL=info
NEW_RELIC_LABELS=environment:production,team:engineering
```

**Important**: Never commit your license key to version control. Use environment variables or secrets management.

### 3.2 Update Next.js Configuration

Modify `next.config.js` to require New Relic at the start:

```javascript
// Load New Relic first (before other imports)
if (process.env.NEW_RELIC_ENABLED === 'true') {
  require('newrelic')
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... your existing config
}

module.exports = nextConfig
```

### 3.3 Update Server Entry Point

If you're using a custom server (`server.js`), add New Relic at the very top:

```javascript
// Load New Relic first (before other imports)
if (process.env.NEW_RELIC_ENABLED === 'true') {
  require('newrelic')
}

// ... rest of your server.js code
```

### 3.4 Update Package.json Scripts

Add New Relic to your start scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "NODE_OPTIONS='--max-old-space-size=4096' next start",
    "start:newrelic": "NODE_OPTIONS='--max-old-space-size=4096' NEW_RELIC_ENABLED=true node -r newrelic server.js"
  }
}
```

---

## Step 4: Add Custom Business Metrics

### 4.1 Create Metrics Utility

Create `lib/monitoring/newrelic.ts`:

```typescript
/**
 * New Relic monitoring utilities for custom business metrics
 */

let newrelic: any = null

// Lazy load New Relic to avoid issues in development
function getNewRelic() {
  if (process.env.NEW_RELIC_ENABLED !== 'true') {
    return null
  }
  
  if (!newrelic) {
    try {
      newrelic = require('newrelic')
    } catch (error) {
      console.warn('New Relic not available:', error)
      return null
    }
  }
  
  return newrelic
}

/**
 * Record a custom event for business operations
 */
export function recordCustomEvent(eventType: string, attributes: Record<string, any>) {
  const nr = getNewRelic()
  if (nr) {
    nr.recordCustomEvent(eventType, attributes)
  }
}

/**
 * Record a custom metric
 */
export function recordMetric(metricName: string, value: number) {
  const nr = getNewRelic()
  if (nr) {
    nr.recordMetric(metricName, value)
  }
}

/**
 * Increment a custom metric counter
 */
export function incrementMetric(metricName: string, value: number = 1) {
  const nr = getNewRelic()
  if (nr) {
    nr.incrementMetric(metricName, value)
  }
}

/**
 * Record vendor sync metrics
 */
export function recordVendorSyncMetrics(vendorType: string, metrics: {
  duration: number
  plantsSynced: number
  alertsSynced: number
  success: boolean
  error?: string
}) {
  recordCustomEvent('VendorSync', {
    vendorType,
    duration: metrics.duration,
    plantsSynced: metrics.plantsSynced,
    alertsSynced: metrics.alertsSynced,
    success: metrics.success,
    error: metrics.error || null,
    timestamp: new Date().toISOString()
  })
  
  recordMetric(`Custom/VendorSync/${vendorType}/Duration`, metrics.duration)
  recordMetric(`Custom/VendorSync/${vendorType}/PlantsSynced`, metrics.plantsSynced)
  recordMetric(`Custom/VendorSync/${vendorType}/AlertsSynced`, metrics.alertsSynced)
  
  if (metrics.success) {
    incrementMetric(`Custom/VendorSync/${vendorType}/Success`)
  } else {
    incrementMetric(`Custom/VendorSync/${vendorType}/Failure`)
  }
}

/**
 * Record plant sync metrics
 */
export function recordPlantSyncMetrics(metrics: {
  vendorId: number
  vendorType: string
  duration: number
  plantsProcessed: number
  plantsCreated: number
  plantsUpdated: number
  success: boolean
  error?: string
}) {
  recordCustomEvent('PlantSync', {
    vendorId: metrics.vendorId,
    vendorType: metrics.vendorType,
    duration: metrics.duration,
    plantsProcessed: metrics.plantsProcessed,
    plantsCreated: metrics.plantsCreated,
    plantsUpdated: metrics.plantsUpdated,
    success: metrics.success,
    error: metrics.error || null,
    timestamp: new Date().toISOString()
  })
  
  recordMetric('Custom/PlantSync/Duration', metrics.duration)
  recordMetric('Custom/PlantSync/PlantsProcessed', metrics.plantsProcessed)
  recordMetric('Custom/PlantSync/PlantsCreated', metrics.plantsCreated)
  recordMetric('Custom/PlantSync/PlantsUpdated', metrics.plantsUpdated)
}

/**
 * Record live telemetry sync metrics
 */
export function recordLiveTelemetrySyncMetrics(metrics: {
  vendorId: number
  vendorType: string
  mode: 'LIST_PLANTS' | 'PER_PLANT'
  duration: number
  plantsUpdated: number
  success: boolean
  error?: string
}) {
  recordCustomEvent('LiveTelemetrySync', {
    vendorId: metrics.vendorId,
    vendorType: metrics.vendorType,
    mode: metrics.mode,
    duration: metrics.duration,
    plantsUpdated: metrics.plantsUpdated,
    success: metrics.success,
    error: metrics.error || null,
    timestamp: new Date().toISOString()
  })
  
  recordMetric(`Custom/LiveTelemetrySync/${metrics.mode}/Duration`, metrics.duration)
  recordMetric(`Custom/LiveTelemetrySync/${metrics.mode}/PlantsUpdated`, metrics.plantsUpdated)
}

/**
 * Record alert sync metrics
 */
export function recordAlertSyncMetrics(metrics: {
  vendorId: number
  vendorType: string
  duration: number
  alertsFetched: number
  alertsCreated: number
  alertsUpdated: number
  success: boolean
  error?: string
}) {
  recordCustomEvent('AlertSync', {
    vendorId: metrics.vendorId,
    vendorType: metrics.vendorType,
    duration: metrics.duration,
    alertsFetched: metrics.alertsFetched,
    alertsCreated: metrics.alertsCreated,
    alertsUpdated: metrics.alertsUpdated,
    success: metrics.success,
    error: metrics.error || null,
    timestamp: new Date().toISOString()
  })
  
  recordMetric('Custom/AlertSync/Duration', metrics.duration)
  recordMetric('Custom/AlertSync/AlertsFetched', metrics.alertsFetched)
  recordMetric('Custom/AlertSync/AlertsCreated', metrics.alertsCreated)
  recordMetric('Custom/AlertSync/AlertsUpdated', metrics.alertsUpdated)
}

/**
 * Record API endpoint metrics
 */
export function recordApiMetrics(endpoint: string, method: string, metrics: {
  duration: number
  statusCode: number
  error?: string
}) {
  recordCustomEvent('ApiRequest', {
    endpoint,
    method,
    duration: metrics.duration,
    statusCode: metrics.statusCode,
    error: metrics.error || null,
    timestamp: new Date().toISOString()
  })
  
  recordMetric(`Custom/Api/${method}/${endpoint}/Duration`, metrics.duration)
  recordMetric(`Custom/Api/${method}/${endpoint}/StatusCode`, metrics.statusCode)
  
  if (metrics.statusCode >= 200 && metrics.statusCode < 300) {
    incrementMetric(`Custom/Api/${method}/${endpoint}/Success`)
  } else {
    incrementMetric(`Custom/Api/${method}/${endpoint}/Error`)
  }
}

/**
 * Record database query metrics
 */
export function recordDatabaseMetrics(operation: string, metrics: {
  duration: number
  table: string
  success: boolean
  error?: string
}) {
  recordMetric(`Custom/Database/${table}/${operation}/Duration`, metrics.duration)
  
  if (metrics.success) {
    incrementMetric(`Custom/Database/${table}/${operation}/Success`)
  } else {
    incrementMetric(`Custom/Database/${table}/${operation}/Failure`)
  }
}
```

### 4.2 Integrate Metrics into Services

Update `lib/services/plantSyncService.ts` to add metrics:

```typescript
import { recordPlantSyncMetrics } from '@/lib/monitoring/newrelic'

// In your sync function:
async function syncVendorPlants(vendor: any, supabase: any) {
  const startTime = Date.now()
  let plantsProcessed = 0
  let plantsCreated = 0
  let plantsUpdated = 0
  let success = false
  let error: string | undefined

  try {
    // ... your existing sync logic
    
    // Record metrics
    recordPlantSyncMetrics({
      vendorId: vendor.id,
      vendorType: vendor.vendor_type,
      duration: Date.now() - startTime,
      plantsProcessed,
      plantsCreated,
      plantsUpdated,
      success: true
    })
    
    success = true
  } catch (err: any) {
    error = err.message
    recordPlantSyncMetrics({
      vendorId: vendor.id,
      vendorType: vendor.vendor_type,
      duration: Date.now() - startTime,
      plantsProcessed,
      plantsCreated,
      plantsUpdated,
      success: false,
      error: err.message
    })
    throw err
  }
}
```

Similarly, update:
- `lib/services/liveTelemetrySyncService.ts`
- `lib/services/alertSyncService.ts`
- API routes (add middleware for API metrics)

---

## Step 5: Create Performance Dashboards

### 5.1 Access New Relic Dashboard Builder

1. Log in to New Relic One
2. Navigate to **Dashboards** → **Create a dashboard**
3. Click **Create dashboard**

### 5.2 Create Business Operations Dashboard

Add the following widgets:

#### Widget 1: Vendor Sync Performance
- **Query**: `SELECT average(duration) FROM VendorSync FACET vendorType TIMESERIES`
- **Chart Type**: Line chart
- **Title**: "Vendor Sync Duration by Vendor Type"

#### Widget 2: Plant Sync Metrics
- **Query**: `SELECT count(*) FROM PlantSync FACET success TIMESERIES`
- **Chart Type**: Area chart
- **Title**: "Plant Sync Success Rate"

#### Widget 3: Plants Synced Count
- **Query**: `SELECT sum(plantsProcessed) FROM PlantSync TIMESERIES`
- **Chart Type**: Bar chart
- **Title**: "Total Plants Processed"

#### Widget 4: API Response Times
- **Query**: `SELECT average(duration) FROM ApiRequest FACET endpoint TIMESERIES`
- **Chart Type**: Line chart
- **Title**: "API Endpoint Response Times"

#### Widget 5: Error Rate
- **Query**: `SELECT count(*) FROM ApiRequest WHERE error IS NOT NULL FACET endpoint TIMESERIES`
- **Chart Type**: Area chart
- **Title**: "API Error Rate by Endpoint"

#### Widget 6: Database Query Performance
- **Query**: `SELECT average(duration) FROM DatabaseMetrics FACET table TIMESERIES`
- **Chart Type**: Line chart
- **Title**: "Database Query Performance by Table"

### 5.3 Create System Health Dashboard

Add widgets for:
- **Transaction Throughput**: `SELECT rate(count(*), 1 minute) FROM Transaction`
- **Error Rate**: `SELECT percentage(count(*), WHERE error IS NOT NULL) FROM Transaction`
- **Apdex Score**: `SELECT apdex(duration, t:0.5) FROM Transaction`
- **Response Time (P95)**: `SELECT percentile(duration, 95) FROM Transaction`

---

## Step 6: Set Up SLOs/SLIs

### 6.1 Define Service Level Objectives

Create SLOs for critical operations:

#### SLO 1: Plant Sync Availability
- **Target**: 99.5% success rate
- **Time Window**: 30 days
- **Query**: `SELECT percentage(count(*), WHERE success = true) FROM PlantSync`

#### SLO 2: API Response Time
- **Target**: 95% of requests < 500ms
- **Time Window**: 7 days
- **Query**: `SELECT percentage(count(*), WHERE duration < 500) FROM ApiRequest`

#### SLO 3: Vendor Sync Duration
- **Target**: 90% of syncs complete in < 60 seconds
- **Time Window**: 7 days
- **Query**: `SELECT percentage(count(*), WHERE duration < 60000) FROM VendorSync`

### 6.2 Create SLO Monitors

1. Navigate to **Service Level** → **SLOs**
2. Click **Create an SLO**
3. Configure each SLO with:
   - **Name**: Descriptive name
   - **Target**: Percentage (e.g., 99.5%)
   - **Time Window**: Rolling window (7 or 30 days)
   - **Query**: NRQL query from above
   - **Alert Threshold**: When SLO drops below target

---

## Step 7: Configure Alerts

### 7.1 Create Alert Policies

1. Navigate to **Alerts & AI** → **Alert conditions**
2. Click **New alert condition**
3. Create conditions for:

#### Alert 1: High Error Rate
- **Condition**: `SELECT count(*) FROM ApiRequest WHERE statusCode >= 500 FACET endpoint`
- **Threshold**: > 10 errors in 5 minutes
- **Notification**: Email/Slack/PagerDuty

#### Alert 2: Slow API Response
- **Condition**: `SELECT average(duration) FROM ApiRequest WHERE duration > 2000`
- **Threshold**: Average > 2000ms for 5 minutes
- **Notification**: Email/Slack

#### Alert 3: Plant Sync Failure
- **Condition**: `SELECT count(*) FROM PlantSync WHERE success = false`
- **Threshold**: > 3 failures in 10 minutes
- **Notification**: Email/Slack/PagerDuty

#### Alert 4: Vendor Sync Timeout
- **Condition**: `SELECT count(*) FROM VendorSync WHERE duration > 120000`
- **Threshold**: > 2 timeouts in 15 minutes
- **Notification**: Email/Slack

### 7.2 Set Up Notification Channels

1. Navigate to **Alerts & AI** → **Notification channels**
2. Add channels:
   - **Email**: Your team email
   - **Slack**: Webhook URL
   - **PagerDuty**: Integration key (if using)

---

## Step 8: Verify Integration

### 8.1 Check Agent Status

1. Deploy your application with New Relic enabled
2. Wait 2-3 minutes for data to appear
3. Navigate to **APM & Services** → **Solar Information System**
4. Verify you see:
   - Transaction traces
   - Error traces
   - Database queries
   - Custom events

### 8.2 Test Custom Metrics

1. Trigger a vendor sync manually
2. Wait 1-2 minutes
3. Navigate to **Query your data** (NRQL)
4. Run query: `SELECT * FROM VendorSync SINCE 5 minutes ago`
5. Verify you see your custom event

### 8.3 Verify Dashboards

1. Navigate to your dashboards
2. Verify widgets are showing data
3. Check that metrics are updating in real-time

---

## Troubleshooting

### Issue: New Relic agent not sending data

**Solutions**:
1. Verify `NEW_RELIC_ENABLED=true` in environment variables
2. Check `NEW_RELIC_LICENSE_KEY` is correct
3. Verify `newrelic.js` is in project root
4. Check application logs for New Relic errors
5. Ensure New Relic is required before other imports

### Issue: Custom events not appearing

**Solutions**:
1. Wait 2-3 minutes for data to appear (not real-time)
2. Verify `custom_insights_events.enabled = true` in config
3. Check event names don't exceed 255 characters
4. Verify attribute values are valid (numbers, strings, booleans)

### Issue: High memory usage

**Solutions**:
1. Reduce `max_event_samples_stored` in config
2. Disable browser monitoring if not needed
3. Reduce transaction trace sample rate
4. Monitor memory usage in New Relic dashboard

### Issue: Missing database queries

**Solutions**:
1. Verify `record_sql: 'obfuscated'` in config
2. Check database client is instrumented
3. Ensure queries are executed through instrumented client

---

## Next Steps

Once you've completed the setup:

1. **Monitor for 24-48 hours** to establish baseline metrics
2. **Review dashboards** daily for the first week
3. **Tune alert thresholds** based on actual performance
4. **Add more custom metrics** as needed for specific operations
5. **Set up weekly reports** for stakeholders

---

## Additional Resources

- [New Relic Node.js Agent Documentation](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/)
- [NRQL Query Language Guide](https://docs.newrelic.com/docs/query-your-data/nrql-new-relic-query-language/)
- [New Relic Dashboard Best Practices](https://docs.newrelic.com/docs/query-your-data/explore-query-data/dashboards/dashboards-best-practices/)
- [SLO Configuration Guide](https://docs.newrelic.com/docs/service-level-management/)

---

**Last Updated**: 2025-01-XX
**Version**: 1.0

