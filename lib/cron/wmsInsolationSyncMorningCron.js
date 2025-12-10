/**
 * WMS Insolation Sync Morning Cron Service
 * Runs in the morning to sync yesterday's insolation data (safety check)
 */

let cronJob = null

function startWmsInsolationSyncMorningCron() {
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

  // Schedule cron job to run daily at 6:00 AM IST (morning sync for yesterday)
  const cronSchedule = '0 6 * * *' // 6 AM IST

  cronJob = cron.schedule(cronSchedule, async () => {
    return MDC.runAsync(
      {
        source: 'cron',
        operation: 'wms-insolation-sync-morning-cron-trigger',
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
          logger.info(`🕐 WMS insolation sync morning cron triggered at ${hour}:${minute.toString().padStart(2, '0')} IST`)

          const port = process.env.PORT || 3000
          const hostname = 'localhost'
          const cronSecret = process.env.CRON_SECRET

          logger.info(`[WMS Insolation Sync Morning Cron] Calling API endpoint: http://${hostname}:${port}/api/cron/sync-wms-insolation-morning`)

          const options = {
            hostname,
            port,
            path: '/api/cron/sync-wms-insolation-morning',
            method: 'GET',
            headers: cronSecret ? {
              'Authorization': `Bearer ${cronSecret}`
            } : {},
            timeout: 600000, // 10 minutes timeout (insolation sync can take longer)
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
                  logger.info(`✅ WMS insolation sync morning complete: ${result.summary?.successful || 0}/${result.summary?.totalVendors || 0} vendors successful`)
                } else {
                  logger.error(`❌ WMS insolation sync morning failed: ${res.statusCode} ${result.error || result.message || data}`)
                }
              } catch (e) {
                if (res.statusCode === 200) {
                  logger.info(`✅ WMS insolation sync morning response: ${data}`)
                } else {
                  logger.error(`❌ WMS insolation sync morning failed: ${res.statusCode} ${data}`)
                }
              }
            })
          })

          req.on('error', (error) => {
            logger.error(`❌ WMS insolation sync morning cron request error:`, error)
          })

          req.on('timeout', () => {
            req.destroy()
            logger.error('[WMS Insolation Sync Morning Cron] Request timeout after 10 minutes')
          })

          req.end()
        } catch (error) {
          logger.error(`❌ WMS insolation sync morning cron error:`, error instanceof Error ? error : new Error(String(error)))
        }
      }
    )
  })

  logger.info('[WMS Insolation Sync Morning Cron] Started - runs daily at 6 AM IST (syncs yesterday\'s data)')
}

function stopWmsInsolationSyncMorningCron() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
    logger.info('[WMS Insolation Sync Morning Cron] Stopped')
  }
}

module.exports = {
  startWmsInsolationSyncMorningCron,
  stopWmsInsolationSyncMorningCron,
}

