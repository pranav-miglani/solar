/**
 * Analytics Config Mirror Cron
 * Mirrors orgs/vendors from main DB to analytics DB and marks vendors ready.
 */

let cronJob = null

function startAnalyticsConfigMirrorCron() {
  if (typeof window !== "undefined") return

  const cron = require("node-cron")
  const http = require("http")

  if (cronJob) cronJob.stop()

  // Default: 16:00 UTC (~21:30 IST if DST not active; close to 22:00 target)
  const cronSchedule = process.env.ANALYTICS_CONFIG_CRON_SCHEDULE || "0 16 * * *"

  cronJob = cron.schedule(cronSchedule, async () => {
    try {
      console.log("🕐 Analytics config mirror cron triggered")

      const port = process.env.PORT || 3000
      const options = {
        hostname: "localhost",
        port,
        path: "/api/cron/analytics/mirror-config",
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }

      const cronSecret = process.env.CRON_SECRET
      if (cronSecret) {
        options.headers["Authorization"] = `Bearer ${cronSecret}`
      }

      const req = http.request(options, (res) => {
        let data = ""
        res.on("data", (chunk) => {
          data += chunk
        })
        res.on("end", () => {
          try {
            const result = JSON.parse(data)
            if (result.success) {
              console.log(
                `✅ Analytics config mirror complete: orgs ${result.summary?.orgsUpdated || 0}/${result.summary?.orgsProcessed || 0}, vendors ${result.summary?.vendorsUpdated || 0}/${result.summary?.vendorsProcessed || 0}`
              )
            } else {
              console.error("❌ Analytics config mirror failed:", result.error || result.message)
            }
          } catch (e) {
            console.error("❌ Failed to parse analytics config mirror response:", e.message)
          }
        })
      })

      req.on("error", (error) => {
        console.error("❌ Analytics config mirror cron error:", error.message)
      })

      req.end()
    } catch (error) {
      console.error("❌ Analytics config mirror cron error:", error.message)
    }
  })

  console.log(`✅ Analytics config mirror cron initialized - schedule: ${cronSchedule}`)
}

function stopAnalyticsConfigMirrorCron() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
  }
}

module.exports = { startAnalyticsConfigMirrorCron, stopAnalyticsConfigMirrorCron }

