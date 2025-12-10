import { NextRequest, NextResponse } from "next/server"
import { runAnalyticsSnapshot } from "@/lib/services/analyticsSnapshotService"
import { logger } from "@/lib/context/logger"

export const dynamic = "force-dynamic"

function checkAuth(request: NextRequest): { authorized: boolean; error?: string } {
  // Check CRON_SECRET first (for cron jobs)
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authHeader = request.headers.get("authorization") || ""
    const token = authHeader.replace("Bearer ", "")
    if (token === secret) {
      logger.info("[Auth Check] Analytics Snapshot Energy: Authorized via CRON_SECRET")
      return { authorized: true }
    } else {
      logger.warn("[Auth Check] Analytics Snapshot Energy: CRON_SECRET mismatch", {
        hasAuthHeader: !!authHeader,
        tokenLength: token.length,
      })
    }
  } else {
    logger.debug("[Auth Check] Analytics Snapshot Energy: CRON_SECRET not configured, checking session")
  }

  // Check session (for UI triggers)
  const session = request.cookies.get("session")?.value
  if (!session) {
    logger.warn("[Auth Check] Analytics Snapshot Energy: No session cookie found")
    return { authorized: false, error: "Unauthorized" }
  }

  let sessionData
  try {
    sessionData = JSON.parse(Buffer.from(session, "base64").toString())
  } catch (error) {
    logger.error("[Auth Check] Analytics Snapshot Energy: Failed to parse session cookie", { error })
    return { authorized: false, error: "Invalid session" }
  }

  const accountType = sessionData.accountType as string
  // Only SUPERADMIN and DEVELOPER can trigger
  if (accountType !== "SUPERADMIN" && accountType !== "DEVELOPER") {
    logger.warn("[Auth Check] Analytics Snapshot Energy: Insufficient permissions", {
      accountType,
      accountId: sessionData.accountId,
    })
    return { authorized: false, error: "Forbidden" }
  }

  logger.info("[Auth Check] Analytics Snapshot Energy: Authorized via session", {
    accountType,
    accountId: sessionData.accountId,
  })
  return { authorized: true }
}

export async function GET(request: NextRequest) {
  try {
    const authCheck = checkAuth(request)
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error || "Unauthorized" }, { status: 401 })
    }

    const summary = await runAnalyticsSnapshot()
    return NextResponse.json({ success: true, summary })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}

