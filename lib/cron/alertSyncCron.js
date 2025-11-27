/**
 * Alert Sync Cron Service
 * Standalone cron service that calls the API endpoint to trigger alert sync.
 * Mirrors the plant sync cron behaviour (every 15 minutes).
 */

let cronJob = null

function startAlertSyncCron() {
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

  // Schedule cron job to run every 15 minutes
  const cronSchedule = '*/15 * * * *' // Every 15 minutes

  cronJob = cron.schedule(cronSchedule, async () => {
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
      console.log(`🕐 Alert sync cron triggered at ${hour}:${minute.toString().padStart(2, '0')} IST`)

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
              console.log(
                `✅ Alert sync complete: ${result.summary?.successful || 0}/${result.summary?.totalVendors || 0} vendors successful`
              )
            } else {
              console.error('❌ Alert sync failed:', result.error || result.message)
            }
          } catch (e) {
            console.error('❌ Failed to parse alert sync response:', e.message)
          }
        })
      })

      req.on('error', (error) => {
        console.error('❌ Alert sync cron error:', error.message)
      })

      req.end()
    } catch (error) {
      console.error('❌ Alert sync cron error:', error.message)
    }
  })

  console.log('✅ Alert sync cron job initialized - running every 15 minutes')
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


