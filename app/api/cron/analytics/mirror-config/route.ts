import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { mirrorOrgVendorConfig } from "@/lib/services/analyticsMirrorService"
import { logger } from "@/lib/context/logger"
import MDC from "@/lib/context/mdc"
import { randomUUID } from "crypto"
import { logApiRequestResponse } from "@/lib/middleware/api-logging"

export const dynamic = "force-dynamic"
// Increase timeout for long-running mirror operations (up to 60 seconds)
export const maxDuration = 60

function checkAuth(request: NextRequest): { authorized: boolean; error?: string } {
  // Check CRON_SECRET first (for cron jobs)
  const secret = process.env.CRON_SECRET_V2
  if (secret) {
    const authHeader = request.headers.get("authorization") || ""
    const token = authHeader.replace("Bearer ", "")
    if (token === secret) {
      logger.info("[Auth Check] Analytics Mirror Config: Authorized via CRON_SECRET")
      return { authorized: true }
    } else {
      logger.warn("[Auth Check] Analytics Mirror Config: CRON_SECRET mismatch", {
        hasAuthHeader: !!authHeader,
        tokenLength: token.length,
      })
    }
  } else {
    logger.debug("[Auth Check] Analytics Mirror Config: CRON_SECRET not configured, checking session")
  }

  // Check session (for UI triggers)
  const session = request.cookies.get("session")?.value
  if (!session) {
    logger.warn("[Auth Check] Analytics Mirror Config: No session cookie found")
    return { authorized: false, error: "Unauthorized" }
  }

  let sessionData
  try {
    sessionData = JSON.parse(Buffer.from(session, "base64").toString())
  } catch (error) {
    logger.error("[Auth Check] Analytics Mirror Config: Failed to parse session cookie", { error })
    return { authorized: false, error: "Invalid session" }
  }

  const accountType = sessionData.accountType as string
  // Only SUPERADMIN and DEVELOPER can trigger
  if (accountType !== "SUPERADMIN" && accountType !== "DEVELOPER") {
    logger.warn("[Auth Check] Analytics Mirror Config: Insufficient permissions", {
      accountType,
      accountId: sessionData.accountId,
    })
    return { authorized: false, error: "Forbidden" }
  }

  logger.info("[Auth Check] Analytics Mirror Config: Authorized via session", {
    accountType,
    accountId: sessionData.accountId,
  })
  return { authorized: true }
}

export async function GET(request: NextRequest) {
  return logApiRequestResponse(request, async () => {
    const requestId = randomUUID()
    
    // Determine source: if called via CRON_SECRET, it's "cron", otherwise "user" (UI trigger)
    const authHeader = request.headers.get("authorization") || ""
    const secret = process.env.CRON_SECRET_V2
    const isCronCall = secret && authHeader.replace("Bearer ", "") === secret
    const source = isCronCall ? "cron" : "user"
    
    return MDC.runAsync(
    {
      source,
      requestId,
      operation: "analytics-mirror-config",
    },
    async () => {
      try {
        const authCheck = checkAuth(request)
        if (!authCheck.authorized) {
          logger.warn("[Analytics Mirror Config] Authorization failed", { error: authCheck.error })
          return NextResponse.json({ error: authCheck.error || "Unauthorized" }, { status: 401 })
        }

        logger.info("[Analytics Mirror Config] Starting mirror operation")
        const startTime = Date.now()
        
        const summary = await mirrorOrgVendorConfig()
        
        const duration = Date.now() - startTime
        logger.info("[Analytics Mirror Config] Mirror operation completed successfully", {
          summary,
          duration: `${duration}ms`,
        })
        
        const response = NextResponse.json({ success: true, summary })
        logger.info("[Analytics Mirror Config] Response sent successfully")
        return response
      } catch (error: any) {
        logger.error("[Analytics Mirror Config] Mirror operation failed", {
          error: error.message,
          stack: error.stack,
        })
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }
    })
  })
}

export async function POST(request: NextRequest) {
  return GET(request)
}

