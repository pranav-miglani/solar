import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { syncAllAlerts } from "@/lib/services/alertSyncService"
import { logApiRequestResponse } from "@/lib/middleware/api-logging"

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
  return logApiRequestResponse(request, async () => {
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
            logger.warn("[Auth Check] Sync Alerts: CRON_SECRET mismatch or missing", {
              hasAuthHeader: !!authHeader,
              authHeaderPrefix: authHeader?.substring(0, 10),
            })
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
          }
          logger.info("[Auth Check] Sync Alerts: Authorized via CRON_SECRET")
        } else {
          logger.debug("[Auth Check] Sync Alerts: CRON_SECRET not configured, allowing request")
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
  return logApiRequestResponse(request, async () => {
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
          logger.warn("[Auth Check] Sync Alerts (Manual): No session cookie found")
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        let sessionData: any
        try {
          sessionData = JSON.parse(Buffer.from(session, "base64").toString())
        } catch (error) {
          logger.error("[Auth Check] Sync Alerts (Manual): Failed to parse session cookie", { error })
          return NextResponse.json({ error: "Invalid session" }, { status: 401 })
        }

        if (sessionData.accountType !== "SUPERADMIN" && sessionData.accountType !== "DEVELOPER") {
          logger.warn("[Auth Check] Sync Alerts (Manual): Insufficient permissions", {
            accountType: sessionData.accountType,
            accountId: sessionData.accountId,
          })
          return NextResponse.json(
            { error: "Forbidden - SUPERADMIN and DEVELOPER only" },
            { status: 403 }
          )
        }
        logger.info("[Auth Check] Sync Alerts (Manual): Authorized via session", {
          accountType: sessionData.accountType,
          accountId: sessionData.accountId,
        })

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
    })
  })
}


