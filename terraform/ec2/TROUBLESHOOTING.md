# New Relic Troubleshooting Guide for EC2

Common issues and solutions when setting up New Relic on EC2.

## Issue 1: New Relic Agent Not Initializing

### Symptoms
- No data in New Relic dashboard
- No logs about New Relic initialization
- Application runs but no APM data

### Diagnosis

```bash
# Check if New Relic is being loaded
sudo journalctl -u woms | grep -i "new relic"

# Check environment variables
sudo systemctl show woms | grep NEW_RELIC

# Check if newrelic.js exists
ls -la /home/ec2-user/woms/newrelic.js

# Check if license key is set
grep NEW_RELIC_LICENSE_KEY /home/ec2-user/woms/.env.production
```

### Solutions

1. **Verify New Relic is required first in server.js**
   ```bash
   head -15 /home/ec2-user/woms/server.js
   ```
   Should show:
   ```javascript
   if (process.env.NEW_RELIC_ENABLED === 'true') {
     require('newrelic')
   }
   ```

2. **Check environment variables are loaded**
   ```bash
   # Edit service file
   sudo nano /etc/systemd/system/woms.service
   ```
   Ensure `EnvironmentFile` points to correct file:
   ```ini
   EnvironmentFile=/home/ec2-user/woms/.env.production
   ```

3. **Verify license key format**
   - Should start with region code (e.g., `eu01xx...`, `us01xx...`)
   - No spaces or quotes
   - Check in New Relic dashboard: Account Settings → API Keys

4. **Restart service**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart woms
   sudo journalctl -u woms -f
   ```

## Issue 2: "License key is invalid" Error

### Symptoms
- Error in logs: "License key is invalid"
- New Relic agent fails to start

### Solutions

1. **Get fresh license key from New Relic**
   - Go to: https://one.newrelic.com
   - Account Settings → API Keys → License Key
   - Copy the key (starts with region code)

2. **Update environment file**
   ```bash
   nano /home/ec2-user/woms/.env.production
   ```
   Ensure:
   ```env
   NEW_RELIC_LICENSE_KEY=your_actual_key_here
   ```
   No quotes, no spaces, no line breaks

3. **Verify key is correct**
   ```bash
   # Check what's actually set
   grep NEW_RELIC_LICENSE_KEY /home/ec2-user/woms/.env.production
   ```

4. **Restart service**
   ```bash
   sudo systemctl restart woms
   ```

## Issue 3: Infrastructure Agent Not Reporting

### Symptoms
- APM data visible but no Infrastructure data
- No host metrics in New Relic

### Diagnosis

```bash
# Check Infrastructure agent status
sudo systemctl status newrelic-infra

# Check Infrastructure agent logs
sudo journalctl -u newrelic-infra -n 50

# Check configuration
cat /etc/newrelic-infra.yml
```

### Solutions

1. **Verify Infrastructure agent is running**
   ```bash
   sudo systemctl status newrelic-infra
   ```
   Should show: `active (running)`

2. **Check license key in Infrastructure config**
   ```bash
   sudo nano /etc/newrelic-infra.yml
   ```
   Should match APM license key

3. **Restart Infrastructure agent**
   ```bash
   sudo systemctl restart newrelic-infra
   sudo journalctl -u newrelic-infra -f
   ```

4. **Verify network connectivity**
   ```bash
   # Test connection to New Relic
   curl -I https://infra-api.newrelic.com
   ```

## Issue 4: Nginx Not Showing in New Relic

### Symptoms
- Application data visible
- No Nginx metrics

### Diagnosis

```bash
# Test Nginx status endpoint
curl http://127.0.0.1/nginx_status

# Check if status module is enabled
nginx -V 2>&1 | grep -o with-http_stub_status_module

# Check plugin configuration
cat /etc/newrelic-infra/plugins.d/nginx.yml
```

### Solutions

1. **Enable Nginx status module**
   Add to `/etc/nginx/nginx.conf`:
   ```nginx
   server {
       listen 127.0.0.1:80;
       location /nginx_status {
           stub_status on;
           allow 127.0.0.1;
           deny all;
       }
   }
   ```

2. **Test status endpoint**
   ```bash
   curl http://127.0.0.1/nginx_status
   ```
   Should return status information

3. **Configure New Relic plugin**
   ```bash
   sudo nano /etc/newrelic-infra/plugins.d/nginx.yml
   ```
   Ensure:
   ```yaml
   integrations:
     - name: nri-nginx
       env:
         STATUS_URL: http://127.0.0.1/nginx_status
   ```

4. **Restart Infrastructure agent**
   ```bash
   sudo systemctl restart newrelic-infra
   ```

## Issue 5: Distributed Tracing Not Working

### Symptoms
- Individual transactions visible
- No end-to-end traces through Nginx → App

### Solutions

1. **Verify Nginx forwards New Relic headers**
   Check `/etc/nginx/conf.d/woms.conf`:
   ```nginx
   proxy_set_header X-NewRelic-ID $http_x_newrelic_id;
   proxy_set_header X-NewRelic-Transaction-ID $http_x_newrelic_transaction_id;
   proxy_set_header X-NewRelic-Trace-Context $http_x_newrelic_trace_context;
   ```

2. **Verify distributed tracing is enabled**
   Check `newrelic.js`:
   ```javascript
   distributed_tracing: {
     enabled: true
   }
   ```

3. **Test with curl**
   ```bash
   curl -H "X-NewRelic-ID: test" http://localhost/api/health
   ```

## Issue 6: High Memory Usage

### Symptoms
- Application using more memory than expected
- Server running out of memory

### Solutions

1. **Reduce event storage**
   Edit `newrelic.js`:
   ```javascript
   error_collector: {
     max_event_samples_stored: 50  // Reduce from default
   }
   ```

2. **Disable browser monitoring** (if not needed)
   ```javascript
   browser_monitoring: {
     enable: false
   }
   ```

3. **Reduce logging level**
   ```env
   NEW_RELIC_LOG_LEVEL=warn  # Instead of info
   ```

## Issue 7: No Custom Events Appearing

### Symptoms
- APM data visible
- Custom events not showing in NRQL queries

### Solutions

1. **Wait 2-3 minutes**
   - Custom events are not real-time
   - Data appears with slight delay

2. **Verify custom events are enabled**
   Check `newrelic.js`:
   ```javascript
   custom_insights_events: {
     enabled: true
   }
   ```

3. **Check event names**
   - Must be < 255 characters
   - Use valid characters only

4. **Verify attribute types**
   - Numbers, strings, booleans only
   - No nested objects

5. **Test with NRQL**
   ```sql
   SELECT * FROM VendorSync SINCE 10 minutes ago
   ```

## Issue 8: Service Won't Start

### Symptoms
- `systemctl start woms` fails
- Service status shows failed

### Diagnosis

```bash
# Check service status
sudo systemctl status woms

# Check detailed logs
sudo journalctl -u woms -n 100 --no-pager

# Check if port is in use
sudo netstat -tulpn | grep 3000
```

### Solutions

1. **Check Node.js path**
   ```bash
   which node
   ```
   Update service file if different:
   ```ini
   ExecStart=/usr/bin/node server.js
   ```

2. **Check working directory**
   ```bash
   ls -la /home/ec2-user/woms/server.js
   ```
   Ensure it exists

3. **Check permissions**
   ```bash
   sudo chown -R ec2-user:ec2-user /home/ec2-user/woms
   ```

4. **Check environment file**
   ```bash
   sudo cat /home/ec2-user/woms/.env.production
   ```
   Ensure all required variables are set

## Quick Diagnostic Commands

```bash
# Full system check
echo "=== New Relic APM Status ==="
sudo journalctl -u woms | grep -i "new relic" | tail -5

echo "=== Infrastructure Agent Status ==="
sudo systemctl status newrelic-infra --no-pager

echo "=== Environment Variables ==="
sudo systemctl show woms | grep NEW_RELIC

echo "=== License Key Check ==="
grep NEW_RELIC_LICENSE_KEY /home/ec2-user/woms/.env.production | cut -d'=' -f2 | cut -c1-10

echo "=== Nginx Status Endpoint ==="
curl -s http://127.0.0.1/nginx_status | head -5

echo "=== Application Health ==="
curl -s http://localhost:3000/api/health
```

## Still Having Issues?

1. **Check New Relic Status Page**
   - https://status.newrelic.com

2. **Review New Relic Documentation**
   - https://docs.newrelic.com/docs/apm/agents/nodejs-agent/

3. **Enable Debug Logging**
   ```env
   NEW_RELIC_LOG_LEVEL=debug
   ```
   Then check logs:
   ```bash
   sudo journalctl -u woms -f | grep -i newrelic
   ```

4. **Test License Key**
   ```bash
   curl -H "Api-Key: YOUR_LICENSE_KEY" \
        https://api.newrelic.com/v2/applications.json
   ```

5. **Contact Support**
   - New Relic Support: https://support.newrelic.com
   - Include logs and diagnostic output

