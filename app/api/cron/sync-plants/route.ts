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
            return NextResponse.json(
              { error: "Unauthorized" },
              { status: 401 }
            )
          }
        }

        // Check if cron is enabled
        const cronEnabled = process.env.ENABLE_PLANT_SYNC_CRON !== "false"
        if (!cronEnabled) {
          return NextResponse.json({
            success: false,
            message: "Plant sync cron is disabled",
          })
        }

        logger.info("🕐 Plant sync cron triggered")

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
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        let sessionData
        try {
          sessionData = JSON.parse(Buffer.from(session, "base64").toString())
        } catch {
          return NextResponse.json({ error: "Invalid session" }, { status: 401 })
        }

        // Only SUPERADMIN can manually trigger sync
        const accountType = sessionData.accountType as string
        if (accountType !== "SUPERADMIN") {
          return NextResponse.json(
            { error: "Forbidden - SUPERADMIN only" },
            { status: 403 }
          )
        }

        // Update MDC context with user info
        MDC.withContext({
          userId: sessionData.accountId,
          accountType: sessionData.accountType,
          orgId: sessionData.orgId,
        }, () => {
          logger.info("🔄 Manual plant sync triggered", { userId: sessionData.accountId })
        })

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

