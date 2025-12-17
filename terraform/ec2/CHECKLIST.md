# New Relic EC2 Setup Checklist

Use this checklist to ensure New Relic is properly configured on your EC2 instance.

## Pre-Setup

- [ ] New Relic account created (https://newrelic.com/signup)
- [ ] License key obtained from New Relic dashboard
- [ ] EC2 instance has Node.js 18+ installed
- [ ] Application code deployed to EC2
- [ ] Nginx installed (if using reverse proxy)

## Infrastructure Agent Setup

- [ ] Infrastructure Agent installed
  ```bash
  sudo ./newrelic-ec2-setup.sh
  # OR
  sudo ./quick-setup.sh
  ```
- [ ] Infrastructure Agent running
  ```bash
  sudo systemctl status newrelic-infra
  ```
- [ ] License key configured in `/etc/newrelic-infra.yml`
- [ ] Infrastructure Agent logs show no errors
  ```bash
  sudo journalctl -u newrelic-infra -n 50
  ```

## Application Configuration

- [ ] `newrelic.js` exists in project root
- [ ] `newrelic` package installed (`npm list newrelic`)
- [ ] Environment variables set in `.env.production`:
  - [ ] `NEW_RELIC_ENABLED=true`
  - [ ] `NEW_RELIC_LICENSE_KEY=<your_key>`
  - [ ] `NEW_RELIC_APP_NAME=Solar Information System`
  - [ ] `NEW_RELIC_LABELS=environment:production,deployment:ec2`
- [ ] `server.js` loads New Relic first (before other imports)
- [ ] Application builds successfully
  ```bash
  npm run build
  ```

## Systemd Service

- [ ] Service file installed (`/etc/systemd/system/woms.service`)
- [ ] Service file references correct environment file
- [ ] Service enabled for auto-start
  ```bash
  sudo systemctl enable woms
  ```
- [ ] Service running
  ```bash
  sudo systemctl status woms
  ```
- [ ] Service logs show New Relic initialization
  ```bash
  sudo journalctl -u woms | grep -i "new relic"
  ```

## Nginx Configuration (if using)

- [ ] Nginx status module enabled
- [ ] Status endpoint accessible: `curl http://127.0.0.1/nginx_status`
- [ ] Nginx config includes New Relic headers:
  - [ ] `X-NewRelic-ID`
  - [ ] `X-NewRelic-Transaction-ID`
  - [ ] `X-NewRelic-Trace-Context`
- [ ] Nginx plugin configured (`/etc/newrelic-infra/plugins.d/nginx.yml`)
- [ ] Nginx config tested: `sudo nginx -t`
- [ ] Nginx reloaded: `sudo systemctl reload nginx`

## Verification

- [ ] Application health check works: `curl http://localhost:3000/api/health`
- [ ] Application accessible through Nginx (if using): `curl http://your-domain/api/health`
- [ ] New Relic dashboard shows application (wait 2-5 minutes)
  - [ ] APM & Services → Applications → "Solar Information System"
- [ ] Infrastructure dashboard shows host
  - [ ] Infrastructure → Hosts → Your EC2 instance
- [ ] Custom events visible (if implemented)
  - [ ] Query: `SELECT * FROM VendorSync SINCE 1 hour ago`

## Testing

- [ ] Make test API request
- [ ] Check transaction appears in New Relic (within 2 minutes)
- [ ] Verify error tracking (if errors occur)
- [ ] Check database query tracking (if applicable)
- [ ] Verify distributed tracing (if using Nginx)

## Monitoring Setup

- [ ] Dashboards created in New Relic
- [ ] Alerts configured for critical metrics
- [ ] Notification channels set up (email/Slack)
- [ ] SLOs defined (if applicable)

## Troubleshooting

If any step fails:

1. Check logs:
   ```bash
   sudo journalctl -u woms -f
   sudo journalctl -u newrelic-infra -f
   ```

2. Verify environment variables:
   ```bash
   sudo systemctl show woms | grep NEW_RELIC
   ```

3. Test license key:
   ```bash
   grep NEW_RELIC_LICENSE_KEY /home/ec2-user/woms/.env.production
   ```

4. Review troubleshooting guide:
   ```bash
   cat terraform/ec2/TROUBLESHOOTING.md
   ```

## Common Issues

- [ ] License key invalid → Get fresh key from New Relic dashboard
- [ ] Agent not initializing → Check `server.js` loads New Relic first
- [ ] No Infrastructure data → Verify Infrastructure Agent is running
- [ ] Nginx not showing → Enable status module and configure plugin
- [ ] Distributed tracing not working → Verify Nginx forwards headers

## Success Criteria

✅ Application appears in New Relic APM dashboard  
✅ Infrastructure host visible in New Relic  
✅ Transaction traces are being recorded  
✅ Error tracking is working  
✅ Custom events appear (if implemented)  
✅ Nginx metrics visible (if configured)  

---

**Last Updated**: 2025-01-XX  
**Version**: 1.0

