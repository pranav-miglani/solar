import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { runGridDowntimeAnalytics } from "@/lib/services/gridDowntimeAnalyticsService"

export const dynamic = "force-dynamic"

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
        const cronSecret = process.env.CRON_SECRET
        const authHeader = request.headers.get("authorization")

        if (cronSecret) {
          if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
          }
        }

        const summary = await runGridDowntimeAnalytics()

        return NextResponse.json({
          success: true,
          summary,
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

