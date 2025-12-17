# New Relic Setup Guide for EC2 Deployment

This guide will help you set up New Relic APM and Infrastructure monitoring on your EC2 instance with Nginx.

## Prerequisites

- EC2 instance running Amazon Linux, Ubuntu, or RHEL
- Node.js 18+ installed
- Nginx installed (optional but recommended)
- Root or sudo access

## Step 1: Get New Relic License Key

1. Sign up for New Relic at [https://newrelic.com/signup](https://newrelic.com/signup)
2. After signing up, go to **Account Settings** → **API Keys**
3. Copy your **License Key** (starts with a region code like `eu01xx...` or `us01xx...`)

## Step 2: Install New Relic Infrastructure Agent

Run the setup script:

```bash
cd /path/to/woms/terraform/ec2
chmod +x newrelic-ec2-setup.sh
sudo ./newrelic-ec2-setup.sh
```

This script will:
- Install New Relic Infrastructure Agent
- Configure it with your license key
- Set up Nginx monitoring plugin (if Nginx is installed)
- Start and enable the agent

**Manual Installation** (if script doesn't work):

### Amazon Linux / RHEL / CentOS:

```bash
curl -Ls https://download.newrelic.com/infrastructure_agent/linux/yum/el/7/x86_64/newrelic-infra-1.20.0-1.x86_64.rpm \
    -o /tmp/newrelic-infra.rpm
sudo rpm -Uvh /tmp/newrelic-infra.rpm
```

### Ubuntu / Debian:

```bash
curl -Ls https://download.newrelic.com/infrastructure_agent/linux/apt/pool/main/n/newrelic-infra/newrelic-infra_1.20.0_amd64.deb \
    -o /tmp/newrelic-infra.deb
sudo dpkg -i /tmp/newrelic-infra.deb
sudo apt-get install -f -y
```

### Configure Infrastructure Agent:

```bash
sudo nano /etc/newrelic-infra.yml
```

Add your license key:

```yaml
license_key: YOUR_LICENSE_KEY_HERE
display_name: your-ec2-hostname
```

Start the agent:

```bash
sudo systemctl enable newrelic-infra
sudo systemctl start newrelic-infra
sudo systemctl status newrelic-infra
```

## Step 3: Configure Application Environment Variables

Edit your application's environment file (`.env.production` or `.env.local`):

```bash
cd /home/ec2-user/woms
nano .env.production
```

Add these variables:

```env
# New Relic Configuration
NEW_RELIC_ENABLED=true
NEW_RELIC_LICENSE_KEY=your_license_key_here
NEW_RELIC_APP_NAME=Solar Information System
NEW_RELIC_LABELS=environment:production,deployment:ec2
NEW_RELIC_LOG_LEVEL=info
```

**Important**: The license key must match the one used for the Infrastructure Agent.

## Step 4: Verify New Relic Configuration File

Ensure `newrelic.js` exists in your project root:

```bash
ls -la /home/ec2-user/woms/newrelic.js
```

The file should already be configured correctly. Verify it reads from environment variables:

```javascript
license_key: process.env.NEW_RELIC_LICENSE_KEY,
agent_enabled: process.env.NEW_RELIC_ENABLED === 'true',
```

## Step 5: Configure Nginx for New Relic

### Enable Nginx Status Module

Edit your Nginx configuration:

```bash
sudo nano /etc/nginx/nginx.conf
```

Add this inside the `http` block:

```nginx
# Status endpoint for New Relic monitoring
server {
    listen 127.0.0.1:80;
    server_name localhost;
    
    location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        deny all;
    }
}
```

### Update Main Server Block

Copy the Nginx configuration template:

```bash
sudo cp /home/ec2-user/woms/terraform/ec2/nginx-newrelic.conf /etc/nginx/conf.d/woms.conf
sudo nano /etc/nginx/conf.d/woms.conf
```

Update the `server_name` and other settings as needed.

**Key New Relic headers** (already included in the config):

```nginx
proxy_set_header X-NewRelic-ID $http_x_newrelic_id;
proxy_set_header X-NewRelic-Transaction-ID $http_x_newrelic_transaction_id;
proxy_set_header X-NewRelic-Trace-Context $http_x_newrelic_trace_context;
```

Test and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Step 6: Setup Systemd Service

Install the systemd service file:

```bash
sudo cp /home/ec2-user/woms/terraform/ec2/woms.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable woms
sudo systemctl start woms
```

Check service status:

```bash
sudo systemctl status woms
```

View logs:

```bash
sudo journalctl -u woms -f
```

## Step 7: Verify New Relic is Working

### Check Application Logs

```bash
sudo journalctl -u woms | grep -i "new relic"
```

You should see messages like:
```
[INFO] New Relic agent initialized
```

### Check Infrastructure Agent

```bash
sudo systemctl status newrelic-infra
sudo journalctl -u newrelic-infra -n 50
```

### Verify in New Relic Dashboard

1. Go to [https://one.newrelic.com](https://one.newrelic.com)
2. Navigate to **APM & Services** → **Applications**
3. You should see "Solar Information System" appear within 2-5 minutes
4. Navigate to **Infrastructure** → **Hosts** to see your EC2 instance

## Troubleshooting

### Issue: New Relic agent not initializing

**Symptoms**: No data in New Relic dashboard, no logs about New Relic

**Solutions**:
1. Verify `NEW_RELIC_ENABLED=true` in environment variables
2. Check license key is correct: `echo $NEW_RELIC_LICENSE_KEY`
3. Verify `newrelic.js` exists and is readable
4. Check application logs: `sudo journalctl -u woms | grep -i newrelic`
5. Ensure New Relic is required **before** any other modules in `server.js`

### Issue: "License key is invalid" error

**Solutions**:
1. Verify license key in `.env.production`
2. Ensure no extra spaces or quotes around the key
3. Check the key in New Relic dashboard (Account Settings → API Keys)
4. Restart the service: `sudo systemctl restart woms`

### Issue: Infrastructure agent not reporting

**Symptoms**: No host data in New Relic Infrastructure

**Solutions**:
1. Check agent status: `sudo systemctl status newrelic-infra`
2. Check agent logs: `sudo journalctl -u newrelic-infra -n 50`
3. Verify license key in `/etc/newrelic-infra.yml`
4. Restart agent: `sudo systemctl restart newrelic-infra`

### Issue: Nginx not showing in New Relic

**Symptoms**: Application data visible but no Nginx metrics

**Solutions**:
1. Verify Nginx status module is enabled
2. Test status endpoint: `curl http://127.0.0.1/nginx_status`
3. Check plugin config: `cat /etc/newrelic-infra/plugins.d/nginx.yml`
4. Restart infrastructure agent: `sudo systemctl restart newrelic-infra`

### Issue: Distributed tracing not working

**Symptoms**: Requests not showing end-to-end traces

**Solutions**:
1. Verify Nginx is forwarding New Relic headers (check `nginx-newrelic.conf`)
2. Ensure `distributed_tracing.enabled: true` in `newrelic.js`
3. Check that both APM and Infrastructure agents use the same license key

## Testing New Relic Integration

### Test APM

1. Make a request to your application:
   ```bash
   curl http://localhost:3000/api/health
   ```

2. Wait 1-2 minutes, then check New Relic dashboard:
   - Go to **APM & Services** → **Solar Information System**
   - Click **Transactions** to see the request

### Test Infrastructure Monitoring

1. Check host appears in Infrastructure:
   - Go to **Infrastructure** → **Hosts**
   - Your EC2 instance should be listed

2. Check Nginx metrics (if configured):
   - Go to **Infrastructure** → **Integrations** → **Nginx**
   - You should see Nginx metrics

## Best Practices

1. **Use the same license key** for both APM and Infrastructure agents
2. **Set appropriate labels** to organize applications by environment
3. **Monitor error rates** in New Relic dashboards
4. **Set up alerts** for critical metrics (error rate, response time)
5. **Review transaction traces** regularly to identify performance bottlenecks

## Additional Resources

- [New Relic Node.js Agent Documentation](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/)
- [New Relic Infrastructure Agent Guide](https://docs.newrelic.com/docs/infrastructure/)
- [Nginx Monitoring with New Relic](https://docs.newrelic.com/docs/infrastructure/host-integrations/host-integrations-list/nginx-monitoring-integration/)

## Quick Reference

```bash
# Check APM agent status
sudo journalctl -u woms | grep -i newrelic

# Check Infrastructure agent status
sudo systemctl status newrelic-infra

# View Infrastructure agent logs
sudo journalctl -u newrelic-infra -f

# Restart APM (restart application)
sudo systemctl restart woms

# Restart Infrastructure agent
sudo systemctl restart newrelic-infra

# Test Nginx status endpoint
curl http://127.0.0.1/nginx_status

# View application logs
sudo journalctl -u woms -f
```

