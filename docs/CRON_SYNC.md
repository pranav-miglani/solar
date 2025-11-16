# Plant Sync Cron Job

## Overview

The Plant Sync Cron Job automatically synchronizes plant data from all active vendors across all organizations at configurable intervals. It's designed to be vendor-agnostic and processes organizations in parallel for optimal performance.

## Features

- **Generic Vendor Support**: Works with any vendor adapter (Solarman, Sungrow, etc.)
- **Token Management**: Automatically validates and refreshes tokens from the database
- **Parallel Processing**: Processes multiple organizations concurrently
- **Batch Operations**: Efficiently syncs plants in batches
- **Error Handling**: Gracefully handles errors and continues processing other vendors
- **Configurable**: Cron frequency and behavior controlled via environment variables

## Configuration

### Environment Variables

Add these to your `.env.local` or deployment environment:

```bash
# Enable/disable the cron job (default: true)
ENABLE_PLANT_SYNC_CRON=true

# Secret token for securing the cron endpoint (optional but recommended)
CRON_SECRET=your-secret-token-here

# Cron frequency (for external cron services)
# Default: Every 15 minutes (*/15 * * * *)
PLANT_SYNC_CRON_SCHEDULE="*/15 * * * *"
```

### Vercel Cron Jobs

If deploying on Vercel, the cron job is automatically configured via `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-plants",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

The schedule uses cron syntax:
- `*/15 * * * *` = Every 15 minutes
- `0 * * * *` = Every hour
- `0 */6 * * *` = Every 6 hours
- `0 0 * * *` = Daily at midnight

## API Endpoints

### GET `/api/cron/sync-plants`

Triggered by cron services. Requires `CRON_SECRET` in Authorization header if configured.

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

**Response:**
```json
{
  "success": true,
  "message": "Plant sync completed",
  "summary": {
    "totalVendors": 5,
    "successful": 4,
    "failed": 1,
    "totalPlantsSynced": 1250,
    "totalPlantsCreated": 50,
    "totalPlantsUpdated": 1200,
    "duration": 45230,
    "results": [
      {
        "vendorId": 1,
        "vendorName": "Solarman Vendor 1",
        "orgId": 3,
        "orgName": "Organization A",
        "success": true,
        "synced": 250,
        "created": 10,
        "updated": 240,
        "total": 250,
        "error": null
      }
    ]
  }
}
```

### POST `/api/cron/sync-plants`

Manual trigger endpoint. Requires SUPERADMIN authentication.

**Authentication:** Session cookie (SUPERADMIN only)

**Response:** Same as GET endpoint

## How It Works

1. **Fetch Active Vendors**: Retrieves all active vendors assigned to organizations
2. **Token Validation**: For each vendor:
   - Retrieves stored token from database
   - Validates token expiry (with 5-minute buffer)
   - Refreshes token if expired or invalid
3. **Plant Fetching**: Uses vendor adapter to fetch all plants from vendor API
4. **Batch Upsert**: Syncs plants to database in batches of 100:
   - Inserts new plants
   - Updates existing plants
   - Handles errors gracefully
5. **Parallel Processing**: Processes up to 5 vendors concurrently to avoid overwhelming the system

## Token Management

The cron job automatically handles token lifecycle:

1. **Token Retrieval**: Fetches stored token from `vendors.access_token`
2. **Expiry Check**: Validates token using:
   - `vendors.token_expires_at` (if stored)
   - JWT expiry decoding (if token is JWT format)
   - 5-minute safety buffer
3. **Token Refresh**: If token is expired or invalid:
   - Calls vendor adapter's `authenticate()` method
   - Stores new token in database
   - Updates `token_expires_at` and `token_metadata`

## Vendor Adapter Requirements

For a vendor adapter to work with the cron system, it must:

1. **Extend BaseVendorAdapter**: Implement all abstract methods
2. **Support Token Storage** (optional but recommended):
   ```typescript
   setTokenStorage(vendorId: number, supabaseClient: any): void {
     this.vendorId = vendorId
     this.supabaseClient = supabaseClient
   }
   ```
3. **Implement authenticate()**: Should check for cached/DB tokens before making API calls

## External Cron Services

If not using Vercel, you can use external cron services:

### GitHub Actions

Create `.github/workflows/sync-plants.yml`:

```yaml
name: Sync Plants

on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes
  workflow_dispatch:  # Allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Plant Sync
        run: |
          curl -X GET \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            https://your-domain.com/api/cron/sync-plants
```

### cron-job.org

1. Create account at https://cron-job.org
2. Add new cron job:
   - URL: `https://your-domain.com/api/cron/sync-plants`
   - Schedule: Every 15 minutes
   - Method: GET
   - Headers: `Authorization: Bearer <CRON_SECRET>`

### Other Services

Any HTTP cron service can trigger the endpoint. Ensure:
- Uses GET method
- Includes `Authorization: Bearer <CRON_SECRET>` header if `CRON_SECRET` is configured
- Handles the response appropriately

## Monitoring

The cron job logs detailed information:

- Start/end times
- Number of vendors processed
- Success/failure counts
- Plants synced per vendor
- Errors encountered

Check your deployment logs to monitor cron execution.

## Troubleshooting

### Cron Not Running

1. **Check Environment Variables**:
   - `ENABLE_PLANT_SYNC_CRON` should be `true` (or not set)
   - `CRON_SECRET` should match if using external cron

2. **Check Vercel Cron** (if using Vercel):
   - Go to Vercel Dashboard → Project → Settings → Cron Jobs
   - Verify cron job is enabled and scheduled correctly

3. **Check External Cron Service**:
   - Verify cron job is active
   - Check execution logs
   - Verify URL and headers are correct

### Token Validation Failures

- Check vendor credentials in database
- Verify vendor API is accessible
- Check token expiry logic in vendor adapter
- Review error logs for specific vendor failures

### Sync Failures

- Check database connection
- Verify vendor adapters are registered
- Review vendor API responses
- Check for rate limiting from vendor APIs

## Manual Testing

Test the cron endpoint manually:

```bash
# With authentication (SUPERADMIN session required)
curl -X POST \
  -H "Cookie: session=<your-session-cookie>" \
  https://your-domain.com/api/cron/sync-plants

# With secret token (if configured)
curl -X GET \
  -H "Authorization: Bearer <CRON_SECRET>" \
  https://your-domain.com/api/cron/sync-plants
```

## Performance Considerations

- **Concurrency Limit**: Currently set to 5 vendors at a time
- **Batch Size**: 100 plants per database batch
- **Token Caching**: Tokens are cached in memory and database
- **Error Isolation**: One vendor failure doesn't stop others

Adjust `CONCURRENCY_LIMIT` in `lib/services/plantSyncService.ts` if needed.

