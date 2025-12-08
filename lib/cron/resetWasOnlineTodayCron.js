/**
 * Reset was_online_today Cron Job
 * 
 * Resets was_online_today flag for all plants at start of each day (IST)
 * This is a backup mechanism - the flag is also reset during analytics snapshot
 * 
 * Schedule: Daily at 12:05 AM IST (5 minutes after midnight to ensure it runs after day change)
 * Cron: 5 18 * * * (18:05 UTC = 12:05 AM IST next day)
 */

const cron = require("node-cron")

// Schedule: Daily at 12:05 AM IST (18:05 UTC previous day)
// Using 5 minutes after midnight to ensure timezone calculations are correct
const CRON_SCHEDULE = process.env.RESET_WAS_ONLINE_TODAY_CRON_SCHEDULE || "5 18 * * *"

const RESET_ENDPOINT = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/reset-was-online-today`
  : "http://localhost:3000/api/cron/reset-was-online-today"

const CRON_SECRET = process.env.CRON_SECRET

function resetWasOnlineToday() {
  console.log(`[ResetWasOnlineToday] Triggering reset at ${new Date().toISOString()}`)

  fetch(RESET_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(CRON_SECRET && { Authorization: `Bearer ${CRON_SECRET}` }),
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }
      return response.json()
    })
    .then((data) => {
      console.log(`[ResetWasOnlineToday] Reset completed successfully:`, data)
    })
    .catch((error) => {
      console.error(`[ResetWasOnlineToday] Reset failed:`, error.message)
    })
}

function startResetWasOnlineTodayCron() {
  if (process.env.ENABLE_RESET_WAS_ONLINE_TODAY_CRON === "false") {
    console.log("[ResetWasOnlineToday] Cron disabled via ENABLE_RESET_WAS_ONLINE_TODAY_CRON=false")
    return
  }

  console.log(`[ResetWasOnlineToday] Starting cron with schedule: ${CRON_SCHEDULE}`)
  console.log(`[ResetWasOnlineToday] Endpoint: ${RESET_ENDPOINT}`)

  // Schedule the cron job
  cron.schedule(CRON_SCHEDULE, () => {
    resetWasOnlineToday()
  })

  console.log("[ResetWasOnlineToday] Cron scheduled successfully")
}

module.exports = {
  startResetWasOnlineTodayCron,
}

