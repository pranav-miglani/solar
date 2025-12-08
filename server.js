/**
 * Custom Next.js Server with Cron Job
 * This file starts both Next.js and the plant sync cron job.
 */

'use strict'

// Load New Relic APM early when enabled so it can instrument HTTP, cron jobs, etc.
if (process.env.NEW_RELIC_ENABLED === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('newrelic')
}

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = process.env.PORT || 3000

// Create Next.js app
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // Create HTTP server first
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  }).listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
    
    // Start the cron jobs after server is ready.
    // Use setTimeout to ensure Next.js compilation is complete.
    setTimeout(() => {
      try {
        // moving below to github actions
        // // Plant sync cron
        // const enablePlantCron = process.env.ENABLE_PLANT_SYNC_CRON !== 'false'
        // if (enablePlantCron) {
        //   const { startPlantSyncCron } = require('./lib/cron/plantSyncCron')
        //   startPlantSyncCron()
        // } else {
        //   console.log('⏸️ Plant sync cron is disabled (ENABLE_PLANT_SYNC_CRON=false)')
        // }

        // Alert sync cron (can be toggled independently)
        const enableAlertCron = process.env.ENABLE_ALERT_SYNC_CRON !== 'false'
        if (enableAlertCron) {
          const { startAlertSyncCron } = require('./lib/cron/alertSyncCron')
          startAlertSyncCron()
        } else {
          console.log('⏸️ Alert sync cron is disabled (ENABLE_ALERT_SYNC_CRON=false)')
        }

        // Live telemetry sync cron (updates current_power_kw, daily_energy_kwh, etc.)
        const enableLiveTelemetryCron = process.env.ENABLE_LIVE_TELEMETRY_SYNC_CRON !== 'false'
        if (enableLiveTelemetryCron) {
          const { startLiveTelemetrySyncCron } = require('./lib/cron/liveTelemetrySyncCron')
          startLiveTelemetrySyncCron()
        } else {
          console.log('⏸️ Live telemetry sync cron is disabled (ENABLE_LIVE_TELEMETRY_SYNC_CRON=false)')
        }

        // Disable inactive plants cron (runs daily at 2 AM IST)
        const enableDisableInactivePlantsCron = process.env.ENABLE_DISABLE_INACTIVE_PLANTS_CRON !== 'false'
        if (enableDisableInactivePlantsCron) {
          const { startDisableInactivePlantsCron } = require('./lib/cron/disableInactivePlantsCron')
          startDisableInactivePlantsCron()
        } else {
          console.log('⏸️ Disable inactive plants cron is disabled (ENABLE_DISABLE_INACTIVE_PLANTS_CRON=false)')
        }

        // WMS site sync cron (runs twice daily at 6 AM and 10 PM IST)
        const enableWmsSiteSyncCron = process.env.ENABLE_WMS_SITE_SYNC_CRON !== 'false'
        if (enableWmsSiteSyncCron) {
          const { startWmsSiteSyncCron } = require('./lib/cron/wmsSiteSyncCron')
          startWmsSiteSyncCron()
        } else {
          console.log('⏸️ WMS site sync cron is disabled (ENABLE_WMS_SITE_SYNC_CRON=false)')
        }

        // WMS insolation sync morning cron (runs daily at 6 AM IST - syncs yesterday's data)
        // Note: End-of-day cron removed - only morning sync for all vendors
        const enableWmsInsolationSyncMorningCron = process.env.ENABLE_WMS_INSOLATION_SYNC_MORNING_CRON !== 'false'
        if (enableWmsInsolationSyncMorningCron) {
          const { startWmsInsolationSyncMorningCron } = require('./lib/cron/wmsInsolationSyncMorningCron')
          startWmsInsolationSyncMorningCron()
        } else {
          console.log('⏸️ WMS insolation sync morning cron is disabled (ENABLE_WMS_INSOLATION_SYNC_MORNING_CRON=false)')
        }

        // Analytics config mirror cron
        const enableAnalyticsConfigCron = process.env.ENABLE_ANALYTICS_CONFIG_CRON !== 'false'
        if (enableAnalyticsConfigCron) {
          const { startAnalyticsConfigMirrorCron } = require('./lib/cron/analyticsConfigMirrorCron')
          startAnalyticsConfigMirrorCron()
        } else {
          console.log('⏸️ Analytics config mirror cron is disabled (ENABLE_ANALYTICS_CONFIG_CRON=false)')
        }

        // Analytics snapshot cron
        const enableAnalyticsSnapshotCron = process.env.ENABLE_ANALYTICS_SNAPSHOT_CRON !== 'false'
        if (enableAnalyticsSnapshotCron) {
          const { startAnalyticsSnapshotCron } = require('./lib/cron/analyticsSnapshotCron')
          startAnalyticsSnapshotCron()
        } else {
          console.log('⏸️ Analytics snapshot cron is disabled (ENABLE_ANALYTICS_SNAPSHOT_CRON=false)')
        }

        // Reset was_online_today cron (runs daily at 12:05 AM IST to reset flag for new day)
        const enableResetWasOnlineTodayCron = process.env.ENABLE_RESET_WAS_ONLINE_TODAY_CRON !== 'false'
        if (enableResetWasOnlineTodayCron) {
          const { startResetWasOnlineTodayCron } = require('./lib/cron/resetWasOnlineTodayCron')
          startResetWasOnlineTodayCron()
        } else {
          console.log('⏸️ Reset was_online_today cron is disabled (ENABLE_RESET_WAS_ONLINE_TODAY_CRON=false)')
        }
      } catch (error) {
        console.error('Failed to start cron job(s):', error)
      }
    }, 2000) // Wait 2 seconds for Next.js to finish compilation
  })
})

