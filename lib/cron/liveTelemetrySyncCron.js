/**
 * Live Telemetry Sync Cron Service
 * Standalone cron service that calls the API endpoint to trigger live telemetry sync
 * This updates current_power_kw, daily_energy_kwh, monthly_energy_mwh, yearly_energy_mwh, total_energy_mwh, network_status
 */

let cronJob = null

function startLiveTelemetrySyncCron() {
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

  // Schedule cron job to run every 15 minutes (same as plant sync)
  // This ensures live telemetry is updated regularly
  // Runs at: :00, :15, :30, :45 of every hour
  const cronSchedule = '*/15 * * * *' // Every 15 minutes
  
  logger.info(`[Live Telemetry Sync Cron] Initializing cron with schedule: ${cronSchedule}`)
  logger.info(`[Live Telemetry Sync Cron] Cron will trigger at: :00, :15, :30, :45 of every hour`)

  cronJob = cron.schedule(cronSchedule, async () => {
    return MDC.runAsync(
      {
        source: 'cron',
        operation: 'live-telemetry-sync-cron-trigger',
      },
      async () => {
        try {
          // Check if we're in the restricted time window (8 PM IST to 5 AM IST)
          const restrictedWindowStart = process.env.RESTRICTED_WINDOW_START || '20:00' // 8 PM IST default
          const restrictedWindowEnd = process.env.RESTRICTED_WINDOW_END || '05:00' // 5 AM IST default
          
          // Get current time in Asia/Kolkata timezone using Intl API
          const now = new Date()
          const kolkataTime = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).formatToParts(now)
          
          const currentHour = parseInt(kolkataTime.find((part) => part.type === 'hour')?.value || '0')
          const currentMinute = parseInt(kolkataTime.find((part) => part.type === 'minute')?.value || '0')
          const currentTimeMinutes = currentHour * 60 + currentMinute
          
          // Parse window times
          const [startHour, startMin] = restrictedWindowStart.split(':').map(Number)
          const [endHour, endMin] = restrictedWindowEnd.split(':').map(Number)
          const startTimeMinutes = startHour * 60 + startMin
          const endTimeMinutes = endHour * 60 + endMin
          
          // Check if current time is in the restricted window
          // Handle case where window spans midnight (e.g., 20:00 to 05:00)
          let inRestrictedWindow = false
          if (startTimeMinutes > endTimeMinutes) {
            // Window spans midnight
            inRestrictedWindow = currentTimeMinutes >= startTimeMinutes || currentTimeMinutes < endTimeMinutes
          } else {
            // Normal window
            inRestrictedWindow = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes
          }
          
          if (inRestrictedWindow) {
            logger.info(`⏸️ Live telemetry sync skipped - in restricted time window (${restrictedWindowStart} - ${restrictedWindowEnd} IST)`)
            return
          }

          // Log current IST time for debugging
          const istHour = parseInt(kolkataTime.find((part) => part.type === 'hour')?.value || '0')
          const istMin = parseInt(kolkataTime.find((part) => part.type === 'minute')?.value || '0')
          logger.info(
            `🕐 [Live Telemetry Sync Cron] Cron triggered at ${istHour}:${istMin.toString().padStart(2, '0')} IST ` +
            `(UTC: ${now.toISOString()})`
          )

          // Call the API endpoint to trigger sync
          const port = process.env.PORT || 3000
          logger.info(`[Live Telemetry Sync Cron] Calling API endpoint: http://localhost:${port}/api/cron/sync-live-telemetry`)

          const options = {
            hostname: 'localhost',
            port: port,
            path: '/api/cron/sync-live-telemetry',
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }

          // Add CRON_SECRET to headers if configured
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
                  logger.info(`✅ Live telemetry sync complete: ${result.summary?.successful || 0}/${result.summary?.totalVendors || 0} vendors successful, ${result.summary?.totalPlantsSynced || 0} plants synced`)
                } else {
                  logger.error('❌ Live telemetry sync failed:', result.error || result.message)
                }
              } catch (e) {
                logger.error('❌ Failed to parse live telemetry sync response:', e instanceof Error ? e : new Error(String(e)))
              }
            })
          })

          req.on('error', (error) => {
            logger.error('❌ Live telemetry sync cron request error:', error)
          })

          req.end()
        } catch (error) {
          logger.error('❌ Live telemetry sync cron error:', error instanceof Error ? error : new Error(String(error)))
        }
      }
    )
  })

  logger.info(`✅ Live telemetry sync cron job initialized - running every 15 minutes (schedule: ${cronSchedule})`)
  
  // Log next scheduled run time
  const now = new Date()
  const kolkataTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  
  const currentHour = parseInt(kolkataTime.find((part) => part.type === 'hour')?.value || '0')
  const currentMinute = parseInt(kolkataTime.find((part) => part.type === 'minute')?.value || '0')
  
  // Calculate next run time (next 15-minute boundary)
  const currentInterval = Math.floor(currentMinute / 15)
  const nextMinute = (currentInterval + 1) * 15
  const nextHour = nextMinute >= 60 ? (currentHour + 1) % 24 : currentHour
  const nextMinuteAdjusted = nextMinute >= 60 ? 0 : nextMinute
  
  logger.info(
    `[Live Telemetry Sync Cron] Current IST time: ${currentHour}:${currentMinute.toString().padStart(2, '0')}, ` +
    `Next scheduled run: ${nextHour}:${nextMinuteAdjusted.toString().padStart(2, '0')} IST`
  )
}

function stopLiveTelemetrySyncCron() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
  }
}

module.exports = {
  startLiveTelemetrySyncCron,
  stopLiveTelemetrySyncCron,
}

