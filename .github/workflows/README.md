# GitHub Actions Workflows

This directory contains GitHub Actions workflows for automated cron jobs.

## Setup Instructions

### 1. Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add:

- `CRON_SECRET`: Your secret token for authenticating cron requests (same as `CRON_SECRET` in your `.env`)
- `API_URL`: Your application URL (e.g., `https://your-domain.com`)

### 2. Available Workflows

#### sync-plants.yml
- **Schedule**: Every 15 minutes
- **Purpose**: Triggers plant synchronization from all vendors
- **Endpoint**: `GET /api/cron/sync-plants`

#### sync-alerts.yml
- **Schedule**: Every 30 minutes
- **Purpose**: Triggers alert synchronization from all vendors
- **Endpoint**: `GET /api/cron/sync-alerts`

### 3. Manual Trigger

All workflows support manual triggering:
1. Go to Actions tab in GitHub
2. Select the workflow
3. Click "Run workflow"

### 4. Monitoring

All requests from GitHub Actions are automatically logged with:
- Full request details (headers, query params, body)
- Full response details (status, headers, body)
- Request source detection (marked as "github-actions")
- Request ID for tracking
- Duration timing

Check your application logs or New Relic dashboard to see:
- `📥 API Request` entries for incoming requests
- `📤 API Response` entries for responses
- Source will be marked as `"github-actions"`

## Logging

All GitHub Actions requests are automatically logged with:
- Request method, path, URL
- Request headers (sensitive ones redacted)
- Query parameters
- Request body (if JSON)
- Response status, headers, body
- Duration
- Request ID for correlation

These logs appear in:
- Application console logs
- New Relic APM (if configured)
- New Relic Logs (if configured)

## Troubleshooting

### Workflow not running
- Check GitHub Actions tab for errors
- Verify secrets are configured correctly
- Check workflow file syntax

### 401 Unauthorized errors
- Verify `CRON_SECRET` matches in both GitHub secrets and your `.env` file
- Check that the Authorization header is being sent correctly

### Logs not appearing
- Wait 2-3 minutes for logs to appear in New Relic
- Check application logs: `pm2 logs solar-app`
- Verify New Relic is configured correctly

