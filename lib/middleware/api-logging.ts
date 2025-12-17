/**
 * API Request/Response Logging Middleware
 * Automatically logs all API requests and responses with full details
 * This ensures every request and response is logged to New Relic
 */

import { NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/context/logger"
import MDC from "@/lib/context/mdc"
import { randomUUID } from "crypto"

/**
 * Extract request body for logging (safely, without blocking)
 */
async function getRequestBody(request: NextRequest): Promise<any> {
  try {
    const clonedRequest = request.clone()
    const contentType = clonedRequest.headers.get("content-type") || ""
    
    // Only parse JSON bodies
    if (contentType.includes("application/json")) {
      const body = await clonedRequest.json()
      // Sanitize sensitive fields
      return sanitizeBody(body)
    }
    
    // For form data, just log that it exists
    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      return { _type: "form-data", _note: "Body not logged for form data" }
    }
    
    return null
  } catch (error) {
    return { _error: "Could not parse request body" }
  }
}

/**
 * Sanitize sensitive fields from request body
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== "object") {
    return body
  }
  
  const sensitiveFields = ["password", "token", "secret", "apiKey", "authorization", "accessToken", "refreshToken"]
  const sanitized = { ...body }
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = "***REDACTED***"
    }
  }
  
  return sanitized
}

/**
 * Extract response body for logging (safely)
 */
async function getResponseBody(response: NextResponse): Promise<any> {
  try {
    const clonedResponse = response.clone()
    const contentType = clonedResponse.headers.get("content-type") || ""
    
    if (contentType.includes("application/json")) {
      const body = await clonedResponse.json()
      // Limit response body size for logging (prevent huge responses)
      return limitObjectSize(body, 10000) // 10KB limit
    }
    
    return { _type: "non-json", _contentType: contentType }
  } catch (error) {
    return { _error: "Could not parse response body" }
  }
}

/**
 * Limit object size for logging (prevent huge logs)
 */
function limitObjectSize(obj: any, maxSize: number): any {
  const json = JSON.stringify(obj)
  if (json.length <= maxSize) {
    return obj
  }
  
  // If too large, return truncated version
  return {
    _truncated: true,
    _originalSize: json.length,
    _preview: JSON.parse(json.substring(0, maxSize)),
    _note: `Response body truncated (original size: ${json.length} bytes)`
  }
}

/**
 * Get user info from request
 */
function getUserInfo(request: NextRequest): { email?: string; accountId?: string; accountType?: string; orgId?: number } | null {
  try {
    const session = request.cookies.get("session")?.value
    if (!session) {
      return null
    }
    
    const sessionData = JSON.parse(Buffer.from(session, "base64").toString())
    return {
      email: sessionData.email,
      accountId: sessionData.accountId,
      accountType: sessionData.accountType,
      orgId: sessionData.orgId,
    }
  } catch {
    return null
  }
}

/**
 * Detect request source (GitHub Actions, cron, user, etc.)
 */
function detectRequestSource(request: NextRequest): "github-actions" | "cron" | "user" | "system" | "api" {
  const userAgent = request.headers.get("user-agent") || ""
  const path = request.nextUrl.pathname
  
  // Check for GitHub Actions user agent
  if (userAgent.includes("GitHub Actions") || userAgent.includes("actions/checkout")) {
    return "github-actions"
  }
  
  // Check for cron endpoints
  if (path.includes("/cron/")) {
    return "cron"
  }
  
  // Check for API routes
  if (path.startsWith("/api/")) {
    return "api"
  }
  
  // Default to user
  return "user"
}

/**
 * Enhanced API logging middleware
 * Logs full request and response details
 */
export async function logApiRequestResponse(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const startTime = Date.now()
  const requestId = randomUUID()
  const method = request.method
  const path = request.nextUrl.pathname
  const url = request.url
  const source = detectRequestSource(request)
  const userInfo = getUserInfo(request)
  
  // Get request headers (sanitize sensitive ones)
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase()
    if (lowerKey.includes("authorization") || lowerKey.includes("cookie")) {
      headers[key] = "***REDACTED***"
    } else {
      headers[key] = value
    }
  })
  
  // Get query parameters
  const queryParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  
  // Get request body (async)
  const requestBody = await getRequestBody(request)
  
  // Set up MDC context
  const mdcContext = {
    source,
    requestId,
    operation: `${method} ${path}`,
    userEmail: userInfo?.email,
    userId: userInfo?.accountId,
    accountType: userInfo?.accountType,
    orgId: userInfo?.orgId,
    timestamp: new Date().toISOString(),
  }
  
  // Log request within MDC context
  return MDC.runAsync(mdcContext, async () => {
    logger.info("📥 API Request", {
      method,
      path,
      url,
      source,
      requestId,
      headers,
      queryParams,
      body: requestBody,
      user: userInfo,
      timestamp: new Date().toISOString(),
    })
    
    try {
      // Execute handler
      const response = await handler()
      const duration = Date.now() - startTime
      const status = response.status
      
      // Get response body (async)
      const responseBody = await getResponseBody(response)
      
      // Get response headers
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })
      
      // Log response
      const logLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info"
      
      if (logLevel === "error") {
        logger.error("📤 API Response", {
          method,
          path,
          status,
          duration: `${duration}ms`,
          requestId,
          headers: responseHeaders,
          body: responseBody,
          timestamp: new Date().toISOString(),
        })
      } else if (logLevel === "warn") {
        logger.warn("📤 API Response", {
          method,
          path,
          status,
          duration: `${duration}ms`,
          requestId,
          headers: responseHeaders,
          body: responseBody,
          timestamp: new Date().toISOString(),
        })
      } else {
        logger.info("📤 API Response", {
          method,
          path,
          status,
          duration: `${duration}ms`,
          requestId,
          headers: responseHeaders,
          body: responseBody,
          timestamp: new Date().toISOString(),
        })
      }
      
      return response
    } catch (error: any) {
      const duration = Date.now() - startTime
      
      logger.error("📤 API Response Error", {
        method,
        path,
        status: 500,
        duration: `${duration}ms`,
        requestId,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      })
      
      throw error
    }
  })
}

