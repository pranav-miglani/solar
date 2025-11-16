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
  const cronSchedule = '*/15 * * * *' // Every 15 minutes

  cronJob = cron.schedule(cronSchedule, async () => {
    try {
      // Check if we're in the restricted time window (7 PM IST to 6 AM IST)
      const syncWindowStart = process.env.SYNC_WINDOW_START || '19:00' // 7 PM IST default
      const syncWindowEnd = process.env.SYNC_WINDOW_END || '06:00' // 6 AM IST default
      
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
      const [startHour, startMin] = syncWindowStart.split(':').map(Number)
      const [endHour, endMin] = syncWindowEnd.split(':').map(Number)
      const startTimeMinutes = startHour * 60 + startMin
      const endTimeMinutes = endHour * 60 + endMin
      
      // Check if current time is in the restricted window
      // Handle case where window spans midnight (e.g., 19:00 to 06:00)
      let inRestrictedWindow = false
      if (startTimeMinutes > endTimeMinutes) {
        // Window spans midnight
        inRestrictedWindow = currentTimeMinutes >= startTimeMinutes || currentTimeMinutes < endTimeMinutes
      } else {
        // Normal window
        inRestrictedWindow = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes
      }
      
      if (inRestrictedWindow) {
        console.log(`⏸️ Plant sync skipped - in restricted time window (${syncWindowStart} - ${syncWindowEnd} IST)`)
        return
      }

      // Log current IST time for debugging
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

