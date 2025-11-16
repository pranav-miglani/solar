import { NextRequest, NextResponse } from "next/server"
import { syncAllPlants } from "@/lib/services/plantSyncService"
import { logger } from "@/lib/context/logger"
import { withMDCContextCron, withMDCContext } from "@/lib/api/mdcHelper"

/**
 * Cron endpoint for syncing plant data from all vendors
 * 
 * This endpoint can be triggered by:
 * 1. Vercel Cron Jobs (if deployed on Vercel)
 * 2. External cron services (GitHub Actions, cron-job.org, etc.)
 * 3. Manual trigger via API call
 * 
 * Security: Should be protected with a secret token
 */
export async function GET(request: NextRequest) {
  return withMDCContextCron("sync-plants", async () => {
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

        // Check if we're in the restricted time window (7 PM IST to 6 AM IST)
        const syncWindowStart = process.env.SYNC_WINDOW_START || "19:00" // 7 PM IST default
        const syncWindowEnd = process.env.SYNC_WINDOW_END || "06:00" // 6 AM IST default
        
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
        const [startHour, startMin] = syncWindowStart.split(":").map(Number)
        const [endHour, endMin] = syncWindowEnd.split(":").map(Number)
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
          logger.info(`⏸️ Plant sync skipped - in restricted time window (${syncWindowStart} - ${syncWindowEnd} IST)`)
          return NextResponse.json({
            success: false,
            message: `Sync skipped - in restricted time window (${syncWindowStart} - ${syncWindowEnd} IST)`,
            skipped: true,
          })
        }

        // Log current IST time for debugging
        const istHour = parseInt(kolkataTime.find((part) => part.type === "hour")?.value || "0")
        const istMin = parseInt(kolkataTime.find((part) => part.type === "minute")?.value || "0")
        logger.info(`🕐 Plant sync cron triggered at ${istHour}:${istMin.toString().padStart(2, "0")} IST`)

        // Execute sync (context automatically propagated)
        // forceSync=false for cron - respects interval boundaries and restricted window
        const summary = await syncAllPlants(false)

        return NextResponse.json({
          success: true,
          message: "Plant sync completed",
          summary: {
            totalVendors: summary.totalVendors,
            successful: summary.successful,
            failed: summary.failed,
            totalPlantsSynced: summary.totalPlantsSynced,
            totalPlantsCreated: summary.totalPlantsCreated,
            totalPlantsUpdated: summary.totalPlantsUpdated,
            duration: summary.duration,
            results: summary.results.map((r) => ({
              vendorId: r.vendorId,
              vendorName: r.vendorName,
              orgId: r.orgId,
              orgName: r.orgName,
              success: r.success,
              synced: r.synced,
              created: r.created,
              updated: r.updated,
              total: r.total,
              error: r.error,
            })),
          },
        })
      } catch (error: any) {
        logger.error("❌ Plant sync cron error", error)
        return NextResponse.json(
          {
            success: false,
            error: error.message || "Internal server error",
          },
          { status: 500 }
        )
      }
    }
  )
}

/**
 * POST endpoint for manual trigger (with authentication)
 */
export async function POST(request: NextRequest) {
  return withMDCContext(
    request,
    "sync-plants-manual",
    async (sessionData, userEmail) => {
      try {
        // Only SUPERADMIN can manually trigger sync
        const accountType = sessionData.accountType as string
        if (accountType !== "SUPERADMIN") {
          logger.warn("Attempted manual sync by non-SUPERADMIN user")
          return NextResponse.json(
            { error: "Forbidden - SUPERADMIN only" },
            { status: 403 }
          )
        }

        logger.info("🔄 Manual plant sync triggered")

        // Execute sync (context automatically propagated)
        // forceSync=true for manual sync - bypasses interval boundaries and restricted window
        const summary = await syncAllPlants(true)

        return NextResponse.json({
          success: true,
          message: "Plant sync completed",
          summary: {
            totalVendors: summary.totalVendors,
            successful: summary.successful,
            failed: summary.failed,
            totalPlantsSynced: summary.totalPlantsSynced,
            totalPlantsCreated: summary.totalPlantsCreated,
            totalPlantsUpdated: summary.totalPlantsUpdated,
            duration: summary.duration,
            results: summary.results.map((r) => ({
              vendorId: r.vendorId,
              vendorName: r.vendorName,
              orgId: r.orgId,
              orgName: r.orgName,
              success: r.success,
              synced: r.synced,
              created: r.created,
              updated: r.updated,
              total: r.total,
              error: r.error,
            })),
          },
        })
      } catch (error: any) {
        logger.error("❌ Manual plant sync error", error)
        return NextResponse.json(
          {
            success: false,
            error: error.message || "Internal server error",
          },
          { status: 500 }
        )
      }
    }
  )
}

