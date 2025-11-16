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
      
      // Log current IST time for debugging (always log, even if skipped)
      const istHour = parseInt(kolkataTime.find((part) => part.type === 'hour')?.value || '0')
      const istMin = parseInt(kolkataTime.find((part) => part.type === 'minute')?.value || '0')
      console.log(`🕐 [CRON] Cron job triggered at ${istHour}:${istMin.toString().padStart(2, '0')} IST`)
      
      // Check if we're in the restricted time window (7 PM IST to 6 AM IST)
      const syncWindowStart = process.env.SYNC_WINDOW_START || '19:00' // 7 PM IST default
      const syncWindowEnd = process.env.SYNC_WINDOW_END || '06:00' // 6 AM IST default
      
      // Parse window times
      const [startHour, startMin] = syncWindowStart.split(':').map(Number)
      const [endHour, endMin] = syncWindowEnd.split(':').map(Number)
      const startTimeMinutes = startHour * 60 + startMin
      const endTimeMinutes = endHour * 60 + endMin
      
      // Check if current time is in the restricted window
      // Handle case where window spans midnight (e.g., 19:00 to 06:00)
      let inRestrictedWindow = false
      if (startTimeMinutes > endTimeMinutes) {
        // Window spans midnight (e.g., 19:00 to 06:00)
        inRestrictedWindow = currentTimeMinutes >= startTimeMinutes || currentTimeMinutes < endTimeMinutes
      } else {
        // Normal window (doesn't span midnight)
        inRestrictedWindow = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes
      }
      
      if (inRestrictedWindow) {
        console.log(`⏸️ [CRON] Plant sync skipped - in restricted time window (${syncWindowStart} - ${syncWindowEnd} IST)`)
        console.log(`   Current time: ${istHour}:${istMin.toString().padStart(2, '0')} IST`)
        return
      }

      console.log(`✅ [CRON] Proceeding with sync - outside restricted window`)

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
  console.log(`   Schedule: ${cronSchedule}`)
  console.log(`   Restricted window: ${process.env.SYNC_WINDOW_START || '19:00'} - ${process.env.SYNC_WINDOW_END || '06:00'} IST`)
  console.log(`   Sync will be skipped during restricted hours (7 PM - 6 AM IST)`)
  
  // Log current IST time and next few scheduled times for debugging
  const now = new Date()
  const kolkataTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const currentHour = parseInt(kolkataTime.find(p => p.type === 'hour')?.value || '0')
  const currentMinute = parseInt(kolkataTime.find(p => p.type === 'minute')?.value || '0')
  console.log(`   Current IST time: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`)
  
  // Calculate next few scheduled runs
  const nextRuns = []
  for (let i = 1; i <= 4; i++) {
    const nextRun = new Date(now.getTime() + (i * 15 * 60 * 1000))
    const nextKolkataTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(nextRun)
    const hour = parseInt(nextKolkataTime.find(p => p.type === 'hour')?.value || '0')
    const minute = parseInt(nextKolkataTime.find(p => p.type === 'minute')?.value || '0')
    const timeStr = `${hour}:${minute.toString().padStart(2, '0')}`
    
    // Check if this time is in restricted window
    const timeMinutes = hour * 60 + minute
    const startTimeMinutes = 19 * 60 // 19:00
    const endTimeMinutes = 6 * 60 // 06:00
    const inRestricted = timeMinutes >= startTimeMinutes || timeMinutes < endTimeMinutes
    const status = inRestricted ? '(will skip)' : '(will run)'
    
    nextRuns.push(`${timeStr} ${status}`)
  }
  console.log(`   Next scheduled runs (IST): ${nextRuns.join(', ')}`)
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

