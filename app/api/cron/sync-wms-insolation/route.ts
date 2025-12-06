import { NextRequest, NextResponse } from "next/server"
import { syncAllWmsInsolation } from "@/lib/services/wmsSyncService"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { randomUUID } from "crypto"

/**
 * Cron endpoint for syncing WMS insolation data
 * Runs end of day to sync current day's insolation
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestId = randomUUID()
  
  return MDC.runAsync(
    {
      source: "cron",
      requestId,
      operation: "sync-wms-insolation",
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

        // Sync today's insolation (current date)
        const today = new Date().toISOString().split("T")[0]
        logger.info(`[WMS Insolation Sync Cron] Starting insolation sync for ${today}`)

        const results = await syncAllWmsInsolation(today)

        return NextResponse.json({
          success: true,
          date: today,
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
    }
  )
}

