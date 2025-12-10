/**
 * WMS Site Sync Cron Service
 * Runs twice daily to check for new sites and devices
 */

let cronJob = null

function startWmsSiteSyncCron() {
  // Only run on server-side
  if (typeof window !== 'undefined') {
    return
  }

  const cron = require('node-cron')
  const http = require('http')
  const MDC = require('../context/mdc').default
  const { logger } = require('../context/logger')

  // Stop existing cron if any
  if (cronJob) {
    cronJob.stop()
  }

  // Schedule cron job to run twice daily (morning and evening)
  // Morning: 6:00 AM IST
  // Evening: 10:00 PM IST
  const cronSchedule = '0 6,22 * * *' // 6 AM and 10 PM IST

  cronJob = cron.schedule(cronSchedule, async () => {
    return MDC.runAsync(
      {
        source: 'cron',
        operation: 'wms-site-sync-cron-trigger',
      },
      async () => {
        try {
          const now = new Date()
          const ist = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).formatToParts(now)

          const hour = parseInt(ist.find((p) => p.type === 'hour')?.value || '0')
          const minute = parseInt(ist.find((p) => p.type === 'minute')?.value || '0')
          logger.info(`🕐 WMS site sync cron triggered at ${hour}:${minute.toString().padStart(2, '0')} IST`)

          const port = process.env.PORT || 3000
          const hostname = 'localhost'
          const cronSecret = process.env.CRON_SECRET

          logger.info(`[WMS Site Sync Cron] Calling API endpoint: http://${hostname}:${port}/api/cron/sync-wms-sites`)

          const options = {
            hostname,
            port,
            path: '/api/cron/sync-wms-sites',
            method: 'GET',
            headers: cronSecret ? {
              'Authorization': `Bearer ${cronSecret}`
            } : {},
            timeout: 300000, // 5 minutes timeout
          }

          const req = http.request(options, (res) => {
            let data = ''
            res.on('data', (chunk) => {
              data += chunk
            })
            res.on('end', () => {
              try {
                const result = JSON.parse(data)
                if (res.statusCode === 200 && result.success) {
                  logger.info(`✅ WMS site sync complete: ${result.summary?.successful || 0}/${result.summary?.totalVendors || 0} vendors successful, ${result.summary?.totalSitesSynced || 0} sites synced`)
                } else {
                  logger.error(`❌ WMS site sync failed: ${res.statusCode} ${result.error || result.message || data}`)
                }
              } catch (e) {
                if (res.statusCode === 200) {
                  logger.info(`✅ WMS site sync response: ${data}`)
                } else {
                  logger.error(`❌ WMS site sync failed: ${res.statusCode} ${data}`)
                }
              }
            })
          })

          req.on('error', (error) => {
            logger.error(`❌ WMS site sync cron request error:`, error)
          })

          req.on('timeout', () => {
            req.destroy()
            logger.error('[WMS Site Sync Cron] Request timeout after 5 minutes')
          })

          req.end()
        } catch (error) {
          logger.error(`❌ WMS site sync cron error:`, error instanceof Error ? error : new Error(String(error)))
        }
      }
    )
  })

  logger.info('[WMS Site Sync Cron] Started - runs twice daily at 6 AM and 10 PM IST')
}

function stopWmsSiteSyncCron() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
    logger.info('[WMS Site Sync Cron] Stopped')
  }
}

module.exports = {
  startWmsSiteSyncCron,
  stopWmsSiteSyncCron,
}

