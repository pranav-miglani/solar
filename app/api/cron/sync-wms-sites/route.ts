import { NextRequest, NextResponse } from "next/server"
import { syncAllWmsSites } from "@/lib/services/wmsSyncService"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { randomUUID } from "crypto"

/**
 * Cron endpoint for syncing WMS sites and devices
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestId = randomUUID()
  
  return MDC.runAsync(
    {
      source: "cron",
      requestId,
      operation: "sync-wms-sites",
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

        logger.info("[WMS Site Sync Cron] Starting WMS site sync")

        const summary = await syncAllWmsSites()

        return NextResponse.json({
          success: true,
          summary,
        })
      } catch (error: any) {
        logger.error(`[WMS Site Sync Cron] Error: ${error.message}`, { error })
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

