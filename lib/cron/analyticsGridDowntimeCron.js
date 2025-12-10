/**
 * Analytics Grid Downtime Cron
 * Triggers the grid downtime analytics endpoint to compute daily + total counters.
 */

let cronJob = null

function startAnalyticsGridDowntimeCron() {
  if (typeof window !== "undefined") return

  const cron = require("node-cron")
  const http = require("http")

  if (cronJob) {
    cronJob.stop()
  }

  // Run daily at 10:15 PM IST (16:45 UTC) after the 9-4 window is complete
  const cronSchedule = "45 16 * * *"

  cronJob = cron.schedule(cronSchedule, async () => {
    try {
      const port = process.env.PORT || 3000
      const options = {
        hostname: "localhost",
        port,
        path: "/api/cron/analytics/grid-downtime",
        method: "POST",
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
            const result = JSON.parse(data || "{}")
            if (result.success) {
              console.log("✅ Grid downtime analytics completed", result.summary || "")
            } else {
              console.error("❌ Grid downtime analytics failed:", result.error || result.message)
            }
          } catch (e) {
            console.error("❌ Failed to parse grid downtime response:", e.message)
          }
        })
      })

      req.on("error", (error) => {
        console.error("❌ Grid downtime cron error:", error.message)
      })

      req.end()
    } catch (error) {
      console.error("❌ Grid downtime cron error:", error.message)
    }
  })

  console.log("✅ Analytics grid downtime cron initialized - running daily at 10:15 PM IST")
}

function stopAnalyticsGridDowntimeCron() {
  if (cronJob) {
    cronJob.stop()
    cronJob = null
  }
}

module.exports = {
  startAnalyticsGridDowntimeCron,
  stopAnalyticsGridDowntimeCron,
}

