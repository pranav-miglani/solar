/**
 * WMS Insolation Sync Cron Service
 * Runs end of day (10 PM IST) to sync insolation data for the current day
 */

let cronJob = null

function startWmsInsolationSyncCron() {
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

  // Schedule cron job to run daily at 10:00 PM IST
  const cronSchedule = '0 22 * * *' // 10 PM IST

  cronJob = cron.schedule(cronSchedule, async () => {
    try {
      const port = process.env.PORT || 3000
      const hostname = 'localhost'
      const cronSecret = process.env.CRON_SECRET

      const options = {
        hostname,
        port,
        path: '/api/cron/sync-wms-insolation',
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
            console.log(`[WMS Insolation Sync Cron] Success: ${data}`)
          } else {
            console.error(`[WMS Insolation Sync Cron] Failed: ${res.statusCode} ${data}`)
          }
        })
      })

      req.on('error', (error) => {
        console.error(`[WMS Insolation Sync Cron] Request error: ${error.message}`)
      })

      req.on('timeout', () => {
        req.destroy()
        console.error('[WMS Insolation Sync Cron] Request timeout')
      })

      req.end()
    } catch (error) {
      console.error(`[WMS Insolation Sync Cron] Error: ${error.message}`)
    }
  })

  console.log('[WMS Insolation Sync Cron] Started - runs daily at 10 PM IST')
}

function stopWmsInsolationSyncCron() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
    console.log('[WMS Insolation Sync Cron] Stopped')
  }
}

module.exports = {
  startWmsInsolationSyncCron,
  stopWmsInsolationSyncCron,
}

