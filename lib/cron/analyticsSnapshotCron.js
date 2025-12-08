/**
 * Analytics Snapshot Cron
 * Captures end-of-day plant energy snapshots into analytics DB.
 */

let cronJob = null

function startAnalyticsSnapshotCron() {
  if (typeof window !== "undefined") return

  const cron = require("node-cron")
  const http = require("http")

  if (cronJob) cronJob.stop()

  // Default: 16:30 UTC = 22:00 IST
  const cronSchedule = process.env.ANALYTICS_SNAPSHOT_CRON_SCHEDULE || "30 16 * * *"

  cronJob = cron.schedule(cronSchedule, async () => {
    try {
      console.log("🕐 Analytics snapshot cron triggered")

      const port = process.env.PORT || 3000
      const options = {
        hostname: "localhost",
        port,
        path: "/api/cron/analytics/snapshot-energy",
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
                `✅ Analytics snapshot complete: vendors ${result.summary?.vendorsProcessed || 0} processed, rows ${result.summary?.rowsUpserted || 0}`
              )
            } else {
              console.error("❌ Analytics snapshot failed:", result.error || result.message)
            }
          } catch (e) {
            console.error("❌ Failed to parse analytics snapshot response:", e.message)
          }
        })
      })

      req.on("error", (error) => {
        console.error("❌ Analytics snapshot cron error:", error.message)
      })

      req.end()
    } catch (error) {
      console.error("❌ Analytics snapshot cron error:", error.message)
    }
  })

  console.log(`✅ Analytics snapshot cron initialized - schedule: ${cronSchedule}`)
}

function stopAnalyticsSnapshotCron() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
  }
}

module.exports = { startAnalyticsSnapshotCron, stopAnalyticsSnapshotCron }

