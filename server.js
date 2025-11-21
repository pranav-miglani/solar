/**
 * Custom Next.js Server with Cron Job
 * This file starts both Next.js and the plant sync cron job
 */

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
        // Plant sync cron
        const enablePlantCron = process.env.ENABLE_PLANT_SYNC_CRON !== 'false'
        if (enablePlantCron) {
          const { startPlantSyncCron } = require('./lib/cron/plantSyncCron')
          startPlantSyncCron()
        } else {
          console.log('⏸️ Plant sync cron is disabled (ENABLE_PLANT_SYNC_CRON=false)')
        }

        // Alert sync cron (can be toggled independently)
        const enableAlertCron = process.env.ENABLE_ALERT_SYNC_CRON !== 'false'
        if (enableAlertCron) {
          const { startAlertSyncCron } = require('./lib/cron/alertSyncCron')
          startAlertSyncCron()
        } else {
          console.log('⏸️ Alert sync cron is disabled (ENABLE_ALERT_SYNC_CRON=false)')
        }
      } catch (error) {
        console.error('Failed to start cron job(s):', error)
      }
    }, 2000) // Wait 2 seconds for Next.js to finish compilation
  })
})

