import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"
import { logger } from "@/lib/context/logger"
import MDC from "@/lib/context/mdc"
import { randomUUID } from "crypto"

export const dynamic = "force-dynamic"

function checkAuth(request: NextRequest): { authorized: boolean; error?: string; source?: string; accountType?: string; accountId?: string } {
  // Check CRON_SECRET first (for cron jobs)
  const secret = process.env.CRON_SECRET_V2
  if (secret) {
    const authHeader = request.headers.get("authorization") || ""
    const token = authHeader.replace("Bearer ", "")
    if (token === secret) {
      logger.info("[Auth Check] Reset Was Online Today: Authorized via CRON_SECRET", {
        hasAuthHeader: !!authHeader,
        tokenLength: token.length,
        authHeaderPrefix: authHeader?.substring(0, 10),
      })
      return { authorized: true, source: "cron" }
    } else {
      logger.warn("[Auth Check] Reset Was Online Today: CRON_SECRET mismatch", {
        hasAuthHeader: !!authHeader,
        tokenLength: token.length,
        authHeaderPrefix: authHeader?.substring(0, 10),
      })
    }
  } else {
    logger.debug("[Auth Check] Reset Was Online Today: CRON_SECRET not configured, checking session")
  }

  // Check session (for manual triggers)
  const session = request.cookies.get("session")?.value
  if (!session) {
    logger.warn("[Auth Check] Reset Was Online Today: No session cookie found")
    return { authorized: false, error: "Unauthorized" }
  }

  let sessionData
  try {
    sessionData = JSON.parse(Buffer.from(session, "base64").toString())
  } catch (error) {
    logger.error("[Auth Check] Reset Was Online Today: Failed to parse session cookie", { error })
    return { authorized: false, error: "Invalid session" }
  }

  const accountType = sessionData.accountType as string
  // Only SUPERADMIN and DEVELOPER can trigger
  if (accountType !== "SUPERADMIN" && accountType !== "DEVELOPER") {
    logger.warn("[Auth Check] Reset Was Online Today: Insufficient permissions", {
      accountType,
      accountId: sessionData.accountId,
    })
    return { authorized: false, error: "Forbidden" }
  }

  logger.info("[Auth Check] Reset Was Online Today: Authorized via session", {
    accountType,
    accountId: sessionData.accountId,
    email: sessionData.email,
  })
  return { 
    authorized: true, 
    source: "user",
    accountType,
    accountId: sessionData.accountId,
  }
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID()
  
  // Determine source: if called via CRON_SECRET, it's "cron", otherwise "user" (UI trigger)
  const authHeader = request.headers.get("authorization") || ""
  const secret = process.env.CRON_SECRET_V2
  const isCronCall = secret && authHeader.replace("Bearer ", "") === secret
  const source = isCronCall ? "cron" : "user"
  
  // Get user info for context if available (before auth check)
  let accountType: string | undefined
  let userId: string | undefined
  if (source === "user") {
    const session = request.cookies.get("session")?.value
    if (session) {
      try {
        const sessionData = JSON.parse(Buffer.from(session, "base64").toString())
        accountType = sessionData.accountType
        userId = sessionData.accountId
      } catch {
        // Ignore parse errors, will be caught in checkAuth
      }
    }
  }
  
  return MDC.runAsync(
    {
      source,
      requestId,
      operation: "reset-was-online-today",
      accountType,
      userId,
    },
    async () => {
      try {
        logger.info("[ResetWasOnlineToday] API request received", {
          method: request.method,
          url: request.url,
          timestamp: new Date().toISOString(),
        })

        const authCheck = checkAuth(request)
        if (!authCheck.authorized) {
          return NextResponse.json(
            { 
              error: authCheck.error || "Unauthorized",
              requestId,
              traceId: requestId,
            }, 
            { status: 401 }
          )
        }

        logger.info("[ResetWasOnlineToday] Starting reset of was_online_today flag for all plants", {
          source: authCheck.source,
          accountType: authCheck.accountType,
          accountId: authCheck.accountId,
        })

        const main = getMainClient()
        const resetStartTime = Date.now()

        logger.info("[ResetWasOnlineToday] Calling reset_was_online_today database function")
        const { data: resetResult, error: resetError } = await main.rpc("reset_was_online_today")

        if (resetError) {
          logger.error("[ResetWasOnlineToday] Reset failed", { 
            error: resetError.message,
            errorCode: resetError.code,
            errorDetails: resetError.details,
            duration: `${Date.now() - resetStartTime}ms`,
          })
          return NextResponse.json(
            { 
              success: false, 
              error: resetError.message,
              requestId,
              traceId: requestId,
            },
            { status: 500 }
          )
        }

        const resetDuration = Date.now() - resetStartTime
        const plantsReset = resetResult || 0

        logger.info("[ResetWasOnlineToday] Reset completed successfully", {
          plantsReset,
          duration: `${resetDuration}ms`,
          timestamp: new Date().toISOString(),
        })

        return NextResponse.json({
          success: true,
          plantsReset,
          duration: `${resetDuration}ms`,
          requestId,
          traceId: requestId,
        })
      } catch (error: any) {
        logger.error("[ResetWasOnlineToday] Exception during reset", { 
          error: error.message,
          stack: error.stack,
        })
        return NextResponse.json(
          { 
            success: false, 
            error: error.message,
            requestId,
            traceId: requestId,
          },
          { status: 500 }
        )
      }
    }
  )
}

export async function GET(request: NextRequest) {
  return POST(request)
}

