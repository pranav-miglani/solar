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

  // Stop existing cron if any
  if (cronJob) {
    cronJob.stop()
  }

  // Schedule cron job to run daily at 6:00 AM IST (morning sync for yesterday)
  const cronSchedule = '0 6 * * *' // 6 AM IST

  cronJob = cron.schedule(cronSchedule, async () => {
    try {
      const port = process.env.PORT || 3000
      const hostname = 'localhost'
      const cronSecret = process.env.CRON_SECRET

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
          if (res.statusCode === 200) {
            console.log(`[WMS Insolation Sync Morning Cron] Success: ${data}`)
          } else {
            console.error(`[WMS Insolation Sync Morning Cron] Failed: ${res.statusCode} ${data}`)
          }
        })
      })

      req.on('error', (error) => {
        console.error(`[WMS Insolation Sync Morning Cron] Request error: ${error.message}`)
      })

      req.on('timeout', () => {
        req.destroy()
        console.error('[WMS Insolation Sync Morning Cron] Request timeout')
      })

      req.end()
    } catch (error) {
      console.error(`[WMS Insolation Sync Morning Cron] Error: ${error.message}`)
    }
  })

  console.log('[WMS Insolation Sync Morning Cron] Started - runs daily at 6 AM IST (syncs yesterday\'s data)')
}

function stopWmsInsolationSyncMorningCron() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
    console.log('[WMS Insolation Sync Morning Cron] Stopped')
  }
}

module.exports = {
  startWmsInsolationSyncMorningCron,
  stopWmsInsolationSyncMorningCron,
}

