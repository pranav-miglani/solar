/**
 * Disable Inactive Plants Cron Service
 * Standalone cron service that calls the API endpoint to trigger disable inactive plants function
 * This avoids TypeScript compilation issues by using HTTP requests
 */

let cronJob = null

function startDisableInactivePlantsCron() {
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

  // Schedule cron job to run daily at 2 AM IST (20:30 UTC)
  // IST is UTC+5:30, so 2 AM IST = 20:30 UTC (previous day)
  const cronSchedule = '30 20 * * *' // Daily at 20:30 UTC (2:00 AM IST)

  cronJob = cron.schedule(cronSchedule, async () => {
    return MDC.runAsync(
      {
        source: 'cron',
        operation: 'disable-inactive-plants-cron-trigger',
      },
      async () => {
        try {
          // Log trigger time in IST for consistency with other cron logs
          const now = new Date()
          const ist = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).formatToParts(now)

          const hour = parseInt(ist.find((p) => p.type === 'hour')?.value || '0')
          const minute = parseInt(ist.find((p) => p.type === 'minute')?.value || '0')
          logger.info(`🕐 Disable inactive plants cron triggered at ${hour}:${minute.toString().padStart(2, '0')} IST (daily at 2 AM IST)`)

          const port = process.env.PORT || 3000
          logger.info(`[Disable Inactive Plants Cron] Calling API endpoint: http://localhost:${port}/api/cron/disable-inactive-plants`)

          const options = {
            hostname: 'localhost',
            port,
            path: '/api/cron/disable-inactive-plants',
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
                    `✅ Disabled ${result.disabled_count || 0} inactive plants. IDs: ${result.disabled_plant_ids?.join(', ') || 'none'}`
                  )
                } else {
                  logger.error('❌ Disable inactive plants failed:', result.error || result.message)
                }
              } catch (e) {
                logger.error('❌ Failed to parse disable inactive plants response:', e instanceof Error ? e : new Error(String(e)))
              }
            })
          })

          req.on('error', (error) => {
            logger.error('❌ Disable inactive plants cron request error:', error)
          })

          req.end()
        } catch (error) {
          logger.error('❌ Disable inactive plants cron error:', error instanceof Error ? error : new Error(String(error)))
        }
      }
    )
  })

  logger.info('✅ Disable inactive plants cron job initialized - running daily at 2 AM IST (20:30 UTC)')
}

function stopDisableInactivePlantsCron() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
  }
}

module.exports = {
  startDisableInactivePlantsCron,
  stopDisableInactivePlantsCron,
}

