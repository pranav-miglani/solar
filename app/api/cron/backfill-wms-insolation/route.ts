import { NextRequest, NextResponse } from "next/server"
import { backfillAllWmsInsolation } from "@/lib/services/wmsSyncService"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { randomUUID } from "crypto"

/**
 * Cron/Manual endpoint for backfilling WMS insolation data (last 100 days)
 * Can be triggered manually or via cron for initial setup
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestId = randomUUID()
  
  return MDC.runAsync(
    {
      source: "cron",
      requestId,
      operation: "backfill-wms-insolation",
    },
    async () => {
      try {
        // Verify cron secret (if configured) - but also allow manual triggers with proper auth
        const cronSecret = process.env.CRON_SECRET
        const authHeader = request.headers.get("authorization")

        // If CRON_SECRET is configured, require it
        if (cronSecret) {
          if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
            // Check if it's a user request (session-based auth)
            const session = request.cookies.get("session")?.value
            if (!session) {
              return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
              )
            }

            // Verify session and check permissions
            let sessionData
            try {
              sessionData = JSON.parse(Buffer.from(session, "base64").toString())
            } catch {
              return NextResponse.json(
                { error: "Invalid session" },
                { status: 401 }
              )
            }

            // Only SUPERADMIN and DEVELOPER can trigger backfill manually
            const accountType = sessionData.accountType as string
            if (accountType !== "SUPERADMIN" && accountType !== "DEVELOPER") {
              return NextResponse.json(
                { error: "Forbidden - Only SUPERADMIN and DEVELOPER can trigger backfill" },
                { status: 403 }
              )
            }
          }
        }

        logger.info(`[WMS Insolation Backfill] Starting 100-day insolation backfill`)

        const results = await backfillAllWmsInsolation()

        const successful = results.filter((r) => r.success).length
        const totalReadings = results.reduce((sum, r) => sum + r.readingsCreated + r.readingsUpdated, 0)

        return NextResponse.json({
          success: true,
          message: `Backfill complete: ${successful}/${results.length} vendors successful, ${totalReadings} total readings`,
          summary: {
            totalVendors: results.length,
            successful,
            failed: results.length - successful,
            totalReadings,
          },
          results,
        })
      } catch (error: any) {
        logger.error(`[WMS Insolation Backfill] Error: ${error.message}`, { error })
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 500 }
        )
      }
    }
  )
}

