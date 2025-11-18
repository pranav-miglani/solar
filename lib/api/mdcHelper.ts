/**
 * MDC Helper for API Routes
 * Provides utilities to set up MDC context with user information from sessions
 */

import { NextRequest } from "next/server"
import MDC from "@/lib/context/mdc"
import { randomUUID } from "crypto"
import { getMainDBClient } from "@/lib/supabase/serviceClient"

interface SessionData {
  accountId: string
  accountType: string
  orgId?: number
}

/**
 * Extract session data from request
 */
export function getSessionData(request: NextRequest): SessionData | null {
  const session = request.cookies.get("session")?.value

  if (!session) {
    return null
  }

  try {
    return JSON.parse(Buffer.from(session, "base64").toString()) as SessionData
  } catch {
    return null
  }
}

/**
 * Get user email from account ID
 */
export async function getUserEmail(accountId: string): Promise<string | null> {
  try {
    const supabase = getMainDBClient()
    const { data: account, error } = await supabase
      .from("accounts")
      .select("email")
      .eq("id", accountId)
      .single()

    if (error || !account) {
      return null
    }

    return account.email || null
  } catch {
    return null
  }
}

/**
 * Run an API route handler with MDC context including user email
 * This should wrap all API route handlers that require user authentication
 */
export async function withMDCContext<T>(
  request: NextRequest,
  operation: string,
  handler: (sessionData: SessionData, userEmail: string | null) => Promise<T>
): Promise<T> {
  const requestId = randomUUID()
  const sessionData = getSessionData(request)

  if (!sessionData) {
    // No session - run without user context
    return MDC.runAsync(
      {
        source: "api",
        requestId,
        operation,
      },
      async () => {
        throw new Error("Unauthorized")
      }
    )
  }

  // Get user email from database
  const userEmail = await getUserEmail(sessionData.accountId)

  // Run with full MDC context including user email
  return MDC.runAsync(
    {
      source: "user",
      requestId,
      operation,
      userId: sessionData.accountId,
      accountType: sessionData.accountType,
      orgId: sessionData.orgId,
      userEmail: userEmail || undefined, // Set userEmail in context
    },
    async () => {
      return handler(sessionData, userEmail)
    }
  )
}

/**
 * Run an API route handler with MDC context (for routes that don't require auth)
 */
export async function withMDCContextPublic<T>(
  request: NextRequest,
  operation: string,
  handler: () => Promise<T>
): Promise<T> {
  const requestId = randomUUID()

  return MDC.runAsync(
    {
      source: "api",
      requestId,
      operation,
    },
    handler
  )
}

/**
 * Run a cron job with MDC context
 */
export async function withMDCContextCron<T>(
  operation: string,
  handler: () => Promise<T>
): Promise<T> {
  const requestId = randomUUID()

  return MDC.runAsync(
    {
      source: "cron",
      requestId,
      operation,
    },
    handler
  )
}

