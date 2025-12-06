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

  // Stop existing cron if any
  if (cronJob) {
    cronJob.stop()
  }

  // Schedule cron job to run twice daily (morning and evening)
  // Morning: 6:00 AM IST
  // Evening: 10:00 PM IST
  const cronSchedule = '0 6,22 * * *' // 6 AM and 10 PM IST

  cronJob = cron.schedule(cronSchedule, async () => {
    try {
      const port = process.env.PORT || 3000
      const hostname = 'localhost'
      const cronSecret = process.env.CRON_SECRET

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
          if (res.statusCode === 200) {
            console.log(`[WMS Site Sync Cron] Success: ${data}`)
          } else {
            console.error(`[WMS Site Sync Cron] Failed: ${res.statusCode} ${data}`)
          }
        })
      })

      req.on('error', (error) => {
        console.error(`[WMS Site Sync Cron] Request error: ${error.message}`)
      })

      req.on('timeout', () => {
        req.destroy()
        console.error('[WMS Site Sync Cron] Request timeout')
      })

      req.end()
    } catch (error) {
      console.error(`[WMS Site Sync Cron] Error: ${error.message}`)
    }
  })

  console.log('[WMS Site Sync Cron] Started - runs twice daily at 6 AM and 10 PM IST')
}

function stopWmsSiteSyncCron() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
    console.log('[WMS Site Sync Cron] Stopped')
  }
}

module.exports = {
  startWmsSiteSyncCron,
  stopWmsSiteSyncCron,
}

