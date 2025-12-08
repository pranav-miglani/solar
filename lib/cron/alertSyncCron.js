/**
 * Alert Sync Cron Service
 * Standalone cron service that calls the API endpoint to trigger alert sync.
 * Runs every hour at minute 0.
 */

let cronJob = null

function startAlertSyncCron() {
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

  // Schedule cron job to run every hour
  const cronSchedule = '0 * * * *' // Every hour at minute 0

  cronJob = cron.schedule(cronSchedule, async () => {
    return MDC.runAsync(
      {
        source: 'cron',
        operation: 'alert-sync-cron-trigger',
      },
      async () => {
        try {
          // Log trigger time in IST for consistency with plant sync logs
          const now = new Date()
          const ist = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).formatToParts(now)

          const hour = parseInt(ist.find((p) => p.type === 'hour')?.value || '0')
          const minute = parseInt(ist.find((p) => p.type === 'minute')?.value || '0')
          logger.info(`🕐 Alert sync cron triggered at ${hour}:${minute.toString().padStart(2, '0')} IST`)

          const port = process.env.PORT || 3000
          const options = {
            hostname: 'localhost',
            port,
            path: '/api/cron/sync-alerts',
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }

          const cronSecret = process.env.CRON_SECRET
          if (cronSecret) {
            options.headers['Authorization'] = `Bearer ${cronSecret}`
          }

          const req = http.request(options, (res) => {
            let data = ''
            res.on('data', (chunk) => {
              data += chunk
            })
            res.on('end', () => {
              try {
                const result = JSON.parse(data)
                if (result.success) {
                  logger.info(
                    `✅ Alert sync complete: ${result.summary?.successful || 0}/${result.summary?.totalVendors || 0} vendors successful`
                  )
                } else {
                  logger.error('❌ Alert sync failed:', result.error || result.message)
                }
              } catch (e) {
                logger.error('❌ Failed to parse alert sync response:', e instanceof Error ? e : new Error(String(e)))
              }
            })
          })

          req.on('error', (error) => {
            logger.error('❌ Alert sync cron error:', error)
          })

          req.end()
        } catch (error) {
          logger.error('❌ Alert sync cron error:', error instanceof Error ? error : new Error(String(error)))
        }
      }
    )
  })

  logger.info('✅ Alert sync cron job initialized - running every hour')
}

function stopAlertSyncCron() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
  }
}

module.exports = {
  startAlertSyncCron,
  stopAlertSyncCron,
}


