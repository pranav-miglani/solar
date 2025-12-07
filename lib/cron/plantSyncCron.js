/**
 * Plant Sync Cron Service
 * Standalone cron service that calls the API endpoint to trigger sync
 * This avoids TypeScript compilation issues by using HTTP requests
 */

let cronJob = null

function startPlantSyncCron() {
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
  // Plant sync runs once daily at vendor-configured time (default: 02:00 IST)
  // Cron runs every 15 min to check if it's time to sync based on vendor's configured time
  // Note: Plant sync is NOT restricted by the sync window (can run at 2 AM)
  const cronSchedule = '*/15 * * * *' // Every 15 minutes

  cronJob = cron.schedule(cronSchedule, async () => {
    try {
      // Log current IST time for debugging
      const now = new Date()
      const kolkataTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(now)
      
      const istHour = parseInt(kolkataTime.find((part) => part.type === 'hour')?.value || '0')
      const istMin = parseInt(kolkataTime.find((part) => part.type === 'minute')?.value || '0')
      console.log(`🕐 Plant sync cron triggered at ${istHour}:${istMin.toString().padStart(2, '0')} IST`)

      // Call the API endpoint to trigger sync
      const port = process.env.PORT || 3000
      const options = {
        hostname: 'localhost',
        port: port,
        path: '/api/cron/sync-plants',
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
              console.log(`✅ Sync complete: ${result.summary?.successful || 0}/${result.summary?.totalVendors || 0} vendors successful`)
            } else {
              console.error('❌ Sync failed:', result.error || result.message)
            }
          } catch (e) {
            console.error('❌ Failed to parse sync response:', e.message)
          }
        })
      })

      req.on('error', (error) => {
        console.error('❌ Plant sync cron error:', error.message)
      })

      req.end()
    } catch (error) {
      console.error('❌ Plant sync cron error:', error.message)
    }
  })

  console.log('✅ Plant sync cron job initialized - running every 15 minutes')
}

function stopPlantSyncCron() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
  }
}

module.exports = {
  startPlantSyncCron,
  stopPlantSyncCron,
}

