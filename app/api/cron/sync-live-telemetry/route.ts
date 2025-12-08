import { NextRequest, NextResponse } from "next/server"
import { syncAllLiveTelemetry } from "@/lib/services/liveTelemetrySyncService"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { randomUUID } from "crypto"

/**
 * Cron endpoint for syncing live telemetry data for all plants
 * 
 * This endpoint updates the following fields in the plants table:
 * - current_power_kw
 * - daily_energy_kwh
 * - monthly_energy_mwh
 * - yearly_energy_mwh
 * - total_energy_mwh
 * - network_status
 * 
 * This is separate from historical telemetry (graphs) which are stored in the telemetry database.
 * Live telemetry is updated at regular intervals via cron to provide real-time metrics.
 * 
 * This endpoint can be triggered by:
 * 1. Vercel Cron Jobs (if deployed on Vercel)
 * 2. External cron services (GitHub Actions, cron-job.org, etc.)
 * 3. Manual trigger via API call
 * 
 * Security: Should be protected with a secret token
 */

// Mark route as dynamic (cron endpoints are always dynamic)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestId = randomUUID()
  
  return MDC.runAsync(
    {
      source: "cron",
      requestId,
      operation: "sync-live-telemetry",
    },
    async () => {
      try {
        // Verify cron secret (if configured)
        const cronSecret = process.env.CRON_SECRET
        const authHeader = request.headers.get("authorization")

        if (cronSecret) {
          if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
              { error: "Unauthorized" },
              { status: 401 }
            )
          }
        }

        // Check if we're in the restricted time window (8 PM IST to 5 AM IST)
        const restrictedWindowStart = process.env.RESTRICTED_WINDOW_START || "20:00" // 8 PM IST default
        const restrictedWindowEnd = process.env.RESTRICTED_WINDOW_END || "05:00" // 5 AM IST default
        
        // Get current time in Asia/Kolkata timezone using Intl API
        const now = new Date()
        const kolkataTime = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).formatToParts(now)
        
        const currentHour = parseInt(kolkataTime.find((part) => part.type === "hour")?.value || "0")
        const currentMinute = parseInt(kolkataTime.find((part) => part.type === "minute")?.value || "0")
        const currentTimeMinutes = currentHour * 60 + currentMinute
        
        // Parse window times
        const [startHour, startMin] = restrictedWindowStart.split(":").map(Number)
        const [endHour, endMin] = restrictedWindowEnd.split(":").map(Number)
        const startTimeMinutes = startHour * 60 + startMin
        const endTimeMinutes = endHour * 60 + endMin
        
        // Check if current time is in the restricted window
        // Handle case where window spans midnight (e.g., 20:00 to 05:00)
        let inRestrictedWindow = false
        if (startTimeMinutes > endTimeMinutes) {
          // Window spans midnight
          inRestrictedWindow = currentTimeMinutes >= startTimeMinutes || currentTimeMinutes < endTimeMinutes
        } else {
          // Normal window
          inRestrictedWindow = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes
        }
        
        if (inRestrictedWindow) {
          logger.info(`⏸️ Live telemetry sync skipped - in restricted time window (${restrictedWindowStart} - ${restrictedWindowEnd} IST)`)
          return NextResponse.json({
            success: false,
            message: `Sync skipped - in restricted time window (${restrictedWindowStart} - ${restrictedWindowEnd} IST)`,
          })
        }

        logger.info("🔄 Starting live telemetry sync for all vendors...")

        const summary = await syncAllLiveTelemetry()

        return NextResponse.json({
          success: summary.failed === 0,
          summary,
          message: `Live telemetry sync complete: ${summary.successful}/${summary.totalVendors} vendors successful, ${summary.totalPlantsSynced} plants synced`,
        })
      } catch (error: any) {
        logger.error("❌ Fatal error in live telemetry sync:", error)
        return NextResponse.json(
          {
            success: false,
            error: error.message || "Unknown error",
          },
          { status: 500 }
        )
      }
    }
  )
}

