import { NextRequest, NextResponse } from "next/server"
import { syncAllPlants } from "@/lib/services/plantSyncService"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { randomUUID } from "crypto"

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

// Mark route as dynamic (cron endpoints are always dynamic)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestId = randomUUID()
  
  return MDC.runAsync(
    {
      source: "cron",
      requestId,
      operation: "sync-plants",
    },
    async () => {
      try {
        // Verify cron secret (if configured)
        const cronSecret = process.env.CRON_SECRET
        const authHeader = request.headers.get("authorization")

        if (cronSecret) {
          if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
            logger.warn("[Auth Check] Sync Plants: CRON_SECRET mismatch or missing", {
              hasAuthHeader: !!authHeader,
              authHeaderPrefix: authHeader?.substring(0, 10),
            })
            return NextResponse.json(
              { error: "Unauthorized" },
              { status: 401 }
            )
          }
          logger.info("[Auth Check] Sync Plants: Authorized via CRON_SECRET")
        } else {
          logger.debug("[Auth Check] Sync Plants: CRON_SECRET not configured, allowing request")
        }

        // Log current IST time for debugging
        // Note: Plant sync is NOT restricted by the sync window (can run at 2 AM)
        const now = new Date()
        const kolkataTime = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).formatToParts(now)
        
        const istHour = parseInt(kolkataTime.find((part) => part.type === "hour")?.value || "0")
        const istMin = parseInt(kolkataTime.find((part) => part.type === "minute")?.value || "0")
        logger.info(`🕐 Plant sync cron triggered at ${istHour}:${istMin.toString().padStart(2, "0")} IST`)

        // Execute sync (context automatically propagated)
        const summary = await syncAllPlants()

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
  const requestId = randomUUID()
  
  return MDC.runAsync(
    {
      source: "user",
      requestId,
      operation: "sync-plants-manual",
    },
    async () => {
      try {
        // Verify authentication
        const session = request.cookies.get("session")?.value
        if (!session) {
          logger.warn("[Auth Check] Sync Plants (Manual): No session cookie found")
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        let sessionData
        try {
          sessionData = JSON.parse(Buffer.from(session, "base64").toString())
        } catch (error) {
          logger.error("[Auth Check] Sync Plants (Manual): Failed to parse session cookie", { error })
          return NextResponse.json({ error: "Invalid session" }, { status: 401 })
        }

        // SUPERADMIN and DEVELOPER can manually trigger sync
        const accountType = sessionData.accountType as string
        if (accountType !== "SUPERADMIN" && accountType !== "DEVELOPER") {
          logger.warn("[Auth Check] Sync Plants (Manual): Insufficient permissions", {
            accountType,
            accountId: sessionData.accountId,
          })
          return NextResponse.json(
            { error: "Forbidden - SUPERADMIN and DEVELOPER only" },
            { status: 403 }
          )
        }
        logger.info("[Auth Check] Sync Plants (Manual): Authorized via session", {
          accountType,
          accountId: sessionData.accountId,
        })

        // Update MDC context with user info and execute sync
        return MDC.withContextAsync(
          {
            userId: sessionData.accountId,
            accountType: sessionData.accountType,
            orgId: sessionData.orgId,
          },
          async () => {
            logger.info("🔄 Manual plant sync triggered", { userId: sessionData.accountId })

            // Execute sync (context automatically propagated)
            const summary = await syncAllPlants()

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
          }
        )
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

