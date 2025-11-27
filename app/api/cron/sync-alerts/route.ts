import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { syncAllAlerts } from "@/lib/services/alertSyncService"

// Alerts cron is always dynamic
export const dynamic = "force-dynamic"

/**
 * GET: cron-style trigger for alert sync
 *
 * Can be called by:
 * - Vercel cron
 * - External cron services
 *
 * Protected by CRON_SECRET (if configured), same as plant sync.
 */
export async function GET(request: NextRequest) {
  const requestId = randomUUID()

  return MDC.runAsync(
    {
      source: "cron",
      requestId,
      operation: "sync-alerts",
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

        logger.info("🕐 Alert sync cron triggered")

        const summary = await syncAllAlerts()

        return NextResponse.json({
          success: true,
          message: "Alert sync completed",
          summary,
        })
      } catch (error: any) {
        logger.error("❌ Alert sync cron error", error)
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
 * POST: manual trigger for SUPERADMIN users (session cookie-based)
 */
export async function POST(request: NextRequest) {
  const requestId = randomUUID()

  return MDC.runAsync(
    {
      source: "user",
      requestId,
      operation: "sync-alerts-manual",
    },
    async () => {
      try {
        const session = request.cookies.get("session")?.value
        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        let sessionData: any
        try {
          sessionData = JSON.parse(Buffer.from(session, "base64").toString())
        } catch {
          return NextResponse.json({ error: "Invalid session" }, { status: 401 })
        }

        if (sessionData.accountType !== "SUPERADMIN") {
          return NextResponse.json(
            { error: "Forbidden - SUPERADMIN only" },
            { status: 403 }
          )
        }

        return MDC.withContextAsync(
          {
            userId: sessionData.accountId,
            accountType: sessionData.accountType,
            orgId: sessionData.orgId,
          },
          async () => {
            logger.info("🔄 Manual alert sync triggered", {
              userId: sessionData.accountId,
            })

            const summary = await syncAllAlerts()

            return NextResponse.json({
              success: true,
              message: "Alert sync completed",
              summary,
            })
          }
        )
      } catch (error: any) {
        logger.error("❌ Manual alert sync error", error)
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


