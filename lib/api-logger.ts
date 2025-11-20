/**
 * API Request Logger
 * Logs all API calls with user information and actions
 * Uses MDC context for consistent logging across the application
 */

import { NextRequest, NextResponse } from "next/server"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { randomUUID } from "crypto"

interface SessionData {
  accountId?: string
  accountType?: string
  orgId?: number | null
  email?: string
}

interface ApiLogEntry {
  timestamp: string
  method: string
  path: string
  user?: {
    email?: string
  }
  action: string
}

/**
 * Extract user information from request session
 */
function getUserFromRequest(request: NextRequest): SessionData | null {
  try {
    const session = request.cookies.get("session")?.value
    if (!session) {
      return null
    }

    const sessionData = JSON.parse(
      Buffer.from(session, "base64").toString()
    ) as SessionData

    return sessionData
  } catch {
    return null
  }
}

/**
 * Format action description from method and path
 */
function formatAction(method: string, path: string): string {
  // Extract resource and action from path
  const pathParts = path.split("/").filter(Boolean)
  
  // Skip "api" prefix
  if (pathParts[0] === "api") {
    pathParts.shift()
  }

  // Format action based on method and path
  const resource = pathParts[0] || "unknown"
  const resourceId = pathParts[1]?.match(/^\d+$/) ? pathParts[1] : null
  const subResource = pathParts[1]?.match(/^\d+$/) ? pathParts[2] : pathParts[1]

  let action = ""
  
  switch (method) {
    case "GET":
      if (subResource) {
        action = `View ${subResource} for ${resource}${resourceId ? ` #${resourceId}` : ""}`
      } else if (resourceId) {
        action = `View ${resource} #${resourceId}`
      } else {
        action = `List ${resource}`
      }
      break
    case "POST":
      if (subResource) {
        action = `Create ${subResource} for ${resource}${resourceId ? ` #${resourceId}` : ""}`
      } else {
        action = `Create ${resource}`
      }
      break
    case "PUT":
    case "PATCH":
      action = `Update ${resource}${resourceId ? ` #${resourceId}` : ""}`
      break
    case "DELETE":
      action = `Delete ${resource}${resourceId ? ` #${resourceId}` : ""}`
      break
    default:
      action = `${method} ${resource}`
  }

  return action
}

/**
 * Helper to get initial MDC context for API request
 */
function getApiMDCContext(request: NextRequest): Partial<import("@/lib/context/mdc").MDCContext> {
  const user = getUserFromRequest(request)
  const method = request.method
  const path = request.nextUrl.pathname
  const action = formatAction(method, path)
  const requestId = randomUUID()

  // Determine source based on path
  let source: "user" | "cron" | "system" | "api" = "user"
  if (path.includes("/cron/")) {
    source = "cron"
  } else if (path.includes("/api/")) {
    source = "api"
  }

  return {
    source,
    requestId,
    operation: action,
    userEmail: user?.email,
    userId: user?.accountId,
    accountType: user?.accountType,
    orgId: user?.orgId ?? undefined,
  }
}

/**
 * Log API request with user information
 * Note: This should be called within an MDC context
 */
export function logApiRequest(
  request: NextRequest,
  additionalInfo?: Record<string, any>
): void {
  const method = request.method
  const path = request.nextUrl.pathname
  const action = formatAction(method, path)

  // Only log additional info if provided (avoid duplicating info already in MDC prefix)
  // The prefix already includes: timestamp, user email, action, method, path
  const hasAdditionalInfo = additionalInfo && Object.keys(additionalInfo).length > 0

  // Use context-aware logger which automatically includes MDC context
  if (hasAdditionalInfo) {
    logger.info(
      `API Request: ${method} ${path} | Action: ${action}`,
      JSON.stringify(additionalInfo, null, 2)
    )
  } else {
    logger.info(`API Request: ${method} ${path} | Action: ${action}`)
  }
}

/**
 * Log API response (success or error)
 * Note: This should be called within an MDC context
 */
export function logApiResponse(
  request: NextRequest,
  status: number,
  duration?: number,
  error?: any
): void {
  const method = request.method
  const path = request.nextUrl.pathname
  const durationStr = duration ? ` | Duration: ${duration}ms` : ""

  // Use context-aware logger which automatically includes MDC context
  if (error) {
    logger.error(
      `API Response: ${method} ${path} | Status: ${status}${durationStr}`,
      error
    )
  } else {
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info"
    
    if (level === "error") {
      logger.error(`API Response: ${method} ${path} | Status: ${status}${durationStr}`)
    } else if (level === "warn") {
      logger.warn(`API Response: ${method} ${path} | Status: ${status}${durationStr}`)
    } else {
      logger.info(`API Response: ${method} ${path} | Status: ${status}${durationStr}`)
    }
  }
}

/**
 * Helper wrapper to add MDC context and logging to API route handlers
 * Usage: export const GET = withApiLogging(async (request) => { ... })
 * This automatically sets MDC context and logs requests/responses
 */
export function withApiLogging<T extends NextRequest>(
  handler: (request: T, ...args: any[]) => Promise<NextResponse>
) {
  return async (request: T, ...args: any[]): Promise<NextResponse> => {
    const startTime = Date.now()
    const mdcContext = getApiMDCContext(request)
    
    return MDC.runAsync(mdcContext, async () => {
      logApiRequest(request)
      
      try {
        const response = await handler(request, ...args)
        const status = response.status
        logApiResponse(request, status, Date.now() - startTime)
        return response
      } catch (error) {
        logApiResponse(request, 500, Date.now() - startTime, error)
        throw error
      }
    })
  }
}

/**
 * Helper to wrap API route handler with MDC context
 * This is a simpler alternative that sets MDC context and updates it with user info
 */
export async function withMDCContext<T>(
  request: NextRequest,
  handler: () => Promise<T>
): Promise<T> {
  const mdcContext = getApiMDCContext(request)
  
  return MDC.runAsync(mdcContext, async () => {
    // Update context with user info if available
    const user = getUserFromRequest(request)
    if (user) {
      return MDC.withContextAsync(
        {
          userEmail: user.email,
          userId: user.accountId,
          accountType: user.accountType,
          orgId: user.orgId ?? undefined,
        },
        handler
      )
    }
    
    return handler()
  })
}
