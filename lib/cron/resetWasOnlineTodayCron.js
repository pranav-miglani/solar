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
const MDC = require("../context/mdc").default
const { logger } = require("../context/logger")

// Schedule: Daily at 12:05 AM IST (18:05 UTC previous day)
// Using 5 minutes after midnight to ensure timezone calculations are correct
const CRON_SCHEDULE = process.env.RESET_WAS_ONLINE_TODAY_CRON_SCHEDULE || "5 18 * * *"

const RESET_ENDPOINT = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/reset-was-online-today`
  : "http://localhost:3000/api/cron/reset-was-online-today"

const CRON_SECRET = process.env.CRON_SECRET_V2 || process.env.CRON_SECRET

function resetWasOnlineToday() {
  return MDC.runAsync(
    {
      source: "cron",
      operation: "reset-was-online-today-cron-trigger",
    },
    async () => {
      const triggerTime = new Date()
      logger.info("[ResetWasOnlineToday] Cron triggered", {
        timestamp: triggerTime.toISOString(),
        schedule: CRON_SCHEDULE,
        endpoint: RESET_ENDPOINT,
        hasCronSecret: !!CRON_SECRET,
      })

      try {
        const fetchStartTime = Date.now()
        const response = await fetch(RESET_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(CRON_SECRET && { Authorization: `Bearer ${CRON_SECRET}` }),
          },
        })

        const fetchDuration = Date.now() - fetchStartTime

        if (!response.ok) {
          const errorText = await response.text()
          logger.error("[ResetWasOnlineToday] API call failed", {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
            duration: `${fetchDuration}ms`,
          })
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        const data = await response.json()
        logger.info("[ResetWasOnlineToday] Reset completed successfully", {
          plantsReset: data.plantsReset || 0,
          duration: data.duration || `${fetchDuration}ms`,
          totalDuration: `${Date.now() - triggerTime.getTime()}ms`,
          requestId: data.requestId || data.traceId,
        })
      } catch (error) {
        logger.error("[ResetWasOnlineToday] Reset failed", {
          error: error.message,
          stack: error.stack,
          endpoint: RESET_ENDPOINT,
        })
      }
    }
  )
}

function startResetWasOnlineTodayCron() {
  if (process.env.ENABLE_RESET_WAS_ONLINE_TODAY_CRON === "false") {
    logger.info("[ResetWasOnlineToday] Cron disabled via ENABLE_RESET_WAS_ONLINE_TODAY_CRON=false")
    return
  }

  logger.info("[ResetWasOnlineToday] Starting cron", {
    schedule: CRON_SCHEDULE,
    endpoint: RESET_ENDPOINT,
  })

  // Schedule the cron job
  cron.schedule(CRON_SCHEDULE, () => {
    resetWasOnlineToday()
  })

  logger.info("[ResetWasOnlineToday] Cron scheduled successfully", {
    schedule: CRON_SCHEDULE,
  })
}

module.exports = {
  startResetWasOnlineTodayCron,
}

