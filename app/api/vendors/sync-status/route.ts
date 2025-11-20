/**
 * Vendor Sync Status API Route
 * 
 * This endpoint provides the sync status of all vendors in the system.
 * It returns vendor information including their last sync time, organization settings,
 * and auto-sync configuration.
 * 
 * Purpose:
 * - Display vendor sync status in the Vendor Sync Dashboard
 * - Show which vendors have been synced recently
 * - Display organization-level auto-sync settings
 * 
 * Security:
 * - Requires valid session cookie
 * - Only SUPERADMIN users can access this endpoint
 * - All requests are logged with MDC context for audit trail
 */

import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import { logApiRequest, logApiResponse, withMDCContext } from "@/lib/api-logger"
import { logger } from "@/lib/context/logger"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

/**
 * GET /api/vendors/sync-status
 * 
 * Returns a list of all vendors with their sync status and organization settings.
 * 
 * Response Format:
 * {
 *   vendors: [
 *     {
 *       id: number,
 *       name: string,
 *       vendor_type: string,
 *       is_active: boolean,
 *       last_synced_at: string | null,
 *       created_at: string,
 *       organizations: {
 *         id: number,
 *         name: string,
 *         auto_sync_enabled: boolean | null,
 *         sync_interval_minutes: number | null
 *       } | null
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  // Track request duration for performance monitoring
  const startTime = Date.now()
  
  /**
   * Wrap the entire handler in MDC context
   * 
   * MDC (Mapped Diagnostic Context) automatically:
   * - Extracts user information from the session
   * - Creates a unique request ID for tracing
   * - Sets up logging context (source, operation, user email, etc.)
   * - Ensures all logs within this handler include the context
   * 
   * This allows us to trace all logs related to a single request
   * even across async operations.
   */
  return withMDCContext(request, async () => {
    try {
      /**
       * Log the incoming API request
       * 
       * This logs:
       * - HTTP method and path
       * - User information (from MDC context)
       * - Request ID for tracing
       * - Timestamp in IST
       * 
       * The log will automatically include MDC context prefix like:
       * [2025-11-19 20:15:48.705 IST] [API] [User:admin@woms.com] [View sync-status for vendors] [Req:ce878c49] [INFO] ...
       */
      logApiRequest(request)
      
      /**
       * Extract session cookie from request
       * 
       * The session cookie contains base64-encoded JSON with:
       * - accountId: User's unique identifier
       * - accountType: User's role (SUPERADMIN, ORG, ENGINEER, etc.)
       * - orgId: Organization ID (if applicable)
       * - email: User's email address
       * 
       * This is a custom session implementation (not using NextAuth)
       */
      const session = request.cookies.get("session")?.value

      // Validate session exists
      if (!session) {
        logger.warn("Unauthorized access attempt to vendor sync status")
        const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        logApiResponse(request, 401, Date.now() - startTime)
        return response
      }

      /**
       * Decode and parse session data
       * 
       * Session is stored as base64-encoded JSON string in cookie.
       * We decode it to get the actual session data.
       * 
       * If decoding fails, the session is invalid/corrupted.
       */
      let sessionData
      try {
        sessionData = JSON.parse(Buffer.from(session, "base64").toString())
      } catch {
        logger.warn("Invalid session format in vendor sync status request")
        const response = NextResponse.json({ error: "Invalid session" }, { status: 401 })
        logApiResponse(request, 401, Date.now() - startTime)
        return response
      }

      // Extract user information from session for logging and authorization
      const accountType = sessionData.accountType as string
      const userId = sessionData.accountId
      const userEmail = sessionData.email

      /**
       * Log who is making the request
       * 
       * This explicit log helps with debugging and audit trails.
       * The "trigger: user-request" field distinguishes this from:
       * - Cron-triggered requests (trigger: "cron")
       * - System-triggered requests (trigger: "system")
       * 
       * This helps identify the source of API calls when investigating issues.
       */
      logger.info("Fetching vendor sync status", {
        accountType,
        userId,
        userEmail,
        trigger: "user-request", // Indicates this is a user-initiated request (not cron/system)
      })

      /**
       * Check if user has permission to view vendors
       * 
       * requirePermission checks the user's accountType against the RBAC (Role-Based Access Control) rules.
       * This is a general permission check for "vendors" resource with "read" action.
       * 
       * If the user doesn't have permission, this will throw an error.
       */
      requirePermission(accountType as any, "vendors", "read")

      /**
       * Additional SUPERADMIN-only check
       * 
       * Even though requirePermission was called, we add an explicit check here
       * because vendor sync status is sensitive information that should only be
       * visible to SUPERADMIN users.
       * 
       * This provides defense-in-depth security.
       */
      if (accountType !== "SUPERADMIN") {
        logger.warn("Non-SUPERADMIN attempted to access vendor sync status", {
          accountType,
          userId,
        })
        const response = NextResponse.json(
          { error: "Forbidden - SUPERADMIN only" },
          { status: 403 }
        )
        logApiResponse(request, 403, Date.now() - startTime)
        return response
      }

      /**
       * Get Supabase client for database queries
       * 
       * getMainClient() returns a singleton Supabase client configured with:
       * - Service role key (bypasses Row Level Security)
       * - Connection to the main database
       * - Connection pooling for performance
       * 
       * We use the service role key because we need to read vendor data
       * regardless of RLS policies.
       */
      const supabase = getMainClient()

      /**
       * Fetch all vendors with their organization and sync status
       * 
       * This query:
       * 1. Selects all vendors from the "vendors" table
       * 2. Includes related organization data (nested query)
       * 3. Orders results alphabetically by vendor name
       * 
       * The nested query for "organizations" uses Supabase's relationship syntax
       * to automatically join and fetch related organization data.
       * 
       * Fields selected:
       * - Vendor info: id, name, vendor_type, is_active, last_synced_at, created_at
       * - Organization info: id, name, auto_sync_enabled, sync_interval_minutes
       * 
       * The sync_interval_minutes tells us how often the organization's vendors
       * should be synced (e.g., 15 = every 15 minutes at :00, :15, :30, :45)
       */
      const { data: vendors, error } = await supabase
        .from("vendors")
        .select(`
          id,
          name,
          vendor_type,
          is_active,
          last_synced_at,
          created_at,
          organizations (
            id,
            name,
            auto_sync_enabled,
            sync_interval_minutes
          )
        `)
        .order("name")

      // Handle database query errors
      if (error) {
        logger.error("Vendor sync status query error", error, {
          userId,
          accountType,
        })
        const response = NextResponse.json(
          { error: "Failed to fetch vendor sync status" },
          { status: 500 }
        )
        logApiResponse(request, 500, Date.now() - startTime, error)
        return response
      }

      /**
       * Log successful fetch
       * 
       * This log includes:
       * - Number of vendors fetched (for monitoring)
       * - User who made the request (for audit)
       * - Trigger type (for debugging)
       * 
       * This helps track usage patterns and identify issues.
       */
      logger.info("Successfully fetched vendor sync status", {
        vendorCount: vendors?.length || 0,
        userId,
        accountType,
        trigger: "user-request",
      })

      /**
       * Return successful response
       * 
       * The response contains:
       * - vendors: Array of vendor objects with sync status
       * 
       * The frontend uses this data to:
       * - Display vendor sync status badges (Synced Today, Stale, Never Synced)
       * - Show last sync timestamps
       * - Display auto-sync settings
       * - Calculate summary statistics (Total, Active, Synced Recently, Never Synced)
       */
      const response = NextResponse.json({ vendors: vendors || [] })
      
      /**
       * Log the API response
       * 
       * This logs:
       * - HTTP status code (200 for success)
       * - Request duration (for performance monitoring)
       * - All logs include MDC context for tracing
       * 
       * The duration helps identify slow queries or performance issues.
       */
      logApiResponse(request, 200, Date.now() - startTime)
      return response
    } catch (error: any) {
      /**
       * Handle unexpected errors
       * 
       * This catch block handles:
       * - Permission errors (from requirePermission)
       * - Unexpected database errors
       * - Any other runtime errors
       * 
       * We check if the error message contains "permission" to return
       * a 403 status, otherwise return 500 (internal server error).
       * 
       * All errors are logged with full context for debugging.
       */
      logger.error("Vendor sync status error", error)
      const response = NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: error.message?.includes("permission") ? 403 : 500 }
      )
      logApiResponse(request, response.status, Date.now() - startTime, error)
      return response
    }
  })
}

