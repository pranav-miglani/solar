import { NextRequest, NextResponse } from "next/server"
import { syncAllWmsInsolation } from "@/lib/services/wmsSyncService"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { randomUUID } from "crypto"
import { logApiRequestResponse } from "@/lib/middleware/api-logging"

/**
 * Cron endpoint for syncing WMS insolation data (morning sync)
 * Runs in the morning to sync yesterday's insolation (safety check, overrides end-of-day cron)
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return logApiRequestResponse(request, async () => {
    const requestId = randomUUID()
    
    return MDC.runAsync(
    {
      source: "cron",
      requestId,
      operation: "sync-wms-insolation-morning",
    },
    async () => {
      try {
        // Verify cron secret (if configured)
        const cronSecret = process.env.CRON_SECRET_V2
        const authHeader = request.headers.get("authorization")

        if (cronSecret) {
          if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
            logger.warn("[Auth Check] Sync WMS Insolation Morning: CRON_SECRET mismatch or missing", {
              hasAuthHeader: !!authHeader,
              authHeaderPrefix: authHeader?.substring(0, 10),
            })
            return NextResponse.json(
              { error: "Unauthorized" },
              { status: 401 }
            )
          }
          logger.info("[Auth Check] Sync WMS Insolation Morning: Authorized via CRON_SECRET")
        } else {
          logger.debug("[Auth Check] Sync WMS Insolation Morning: CRON_SECRET not configured, allowing request")
        }

        // Sync yesterday's insolation (morning sync - safety check)
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split("T")[0]
        logger.info(`[WMS Insolation Sync Cron] Starting morning insolation sync for ${yesterdayStr} (yesterday)`)

        const results = await syncAllWmsInsolation(yesterdayStr)

        return NextResponse.json({
          success: true,
          date: yesterdayStr,
          message: "Morning sync completed (yesterday's data)",
          results,
        })
      } catch (error: any) {
        logger.error(`[WMS Insolation Sync Cron] Error: ${error.message}`, { error })
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 500 }
        )
      }
    })
  })
}

