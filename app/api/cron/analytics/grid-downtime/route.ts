import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { runGridDowntimeAnalytics } from "@/lib/services/gridDowntimeAnalyticsService"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes for processing 8000+ plants

export async function POST(request: NextRequest) {
  const requestId = randomUUID()

  return MDC.runAsync(
    {
      source: "cron",
      requestId,
      operation: "analytics-grid-downtime",
    },
    async () => {
      try {
        const cronSecret = process.env.CRON_SECRET_V2
        const authHeader = request.headers.get("authorization")

        if (cronSecret) {
          if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
            logger.warn("[Auth Check] Analytics Grid Downtime: CRON_SECRET mismatch or missing", {
              hasAuthHeader: !!authHeader,
              authHeaderPrefix: authHeader?.substring(0, 10),
            })
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
          }
          logger.info("[Auth Check] Analytics Grid Downtime: Authorized via CRON_SECRET")
        } else {
          logger.debug("[Auth Check] Analytics Grid Downtime: CRON_SECRET not configured, allowing request")
        }

        logger.info("[Analytics Grid Downtime] Starting grid downtime analytics computation")
        const computationStartTime = Date.now()
        
        const summary = await runGridDowntimeAnalytics()

        const computationDuration = Date.now() - computationStartTime
        logger.info("[Analytics Grid Downtime] Computation completed", {
          summary,
          duration: `${computationDuration}ms`,
          durationSeconds: `${(computationDuration / 1000).toFixed(2)}s`,
        })

        return NextResponse.json({
          success: true,
          summary,
          duration: `${computationDuration}ms`,
        })
      } catch (error: any) {
        logger.error("[Analytics Grid Downtime] Failed", { error: error?.message })
        return NextResponse.json(
          { success: false, error: error?.message || "Internal server error" },
          { status: 500 }
        )
      }
    }
  )
}

