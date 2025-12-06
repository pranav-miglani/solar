/**
 * WMS Vendor Sync Status API Route
 * 
 * This endpoint provides the sync status of all WMS vendors in the system.
 * It returns vendor information including their last sync time and organization settings.
 * 
 * Purpose:
 * - Display WMS vendor sync status in the WMS dashboard
 * - Show which vendors have been synced recently
 * - Display organization-level information
 * 
 * Security:
 * - Requires valid session cookie
 * - Only SUPERADMIN and DEVELOPER can access this endpoint
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
 * GET /api/wms-vendors/sync-status
 * 
 * Returns a list of all WMS vendors with their sync status and organization settings.
 * 
 * Response Format:
 * {
 *   vendors: [
 *     {
 *       id: number,
 *       name: string,
 *       vendor_type: string,
 *       is_active: boolean,
 *       last_sites_synced_at: string | null,
 *       last_insolation_synced_at: string | null,
 *       created_at: string,
 *       organizations: {
 *         id: number,
 *         name: string
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
       * [2025-11-19 20:15:48.705 IST] [API] [User:admin@woms.com] [View sync-status for wms-vendors] [Req:ce878c49] [INFO] ...
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
        logger.warn("Unauthorized access attempt to WMS vendor sync status")
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
        logger.warn("Invalid session format in WMS vendor sync status request")
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
      logger.info("Fetching WMS vendor sync status", {
        accountType,
        userId,
        userEmail,
        trigger: "user-request", // Indicates this is a user-initiated request (not cron/system)
      })

      /**
       * Check if user has permission to view WMS vendors
       * 
       * requirePermission checks the user's accountType against the RBAC (Role-Based Access Control) rules.
       * This is a general permission check for "wms_vendors" resource with "read" action.
       * 
       * Only SUPERADMIN and DEVELOPER can view sync status.
       */
      requirePermission(accountType as any, "wms_vendors", "read")

      /**
       * Use service role client to bypass RLS
       * 
       * Since we're using the service role key, RLS (Row Level Security) policies are bypassed.
       * This allows us to fetch all vendors regardless of organization.
       * 
       * We still enforce application-level permissions via RBAC above.
       */
      const supabase = getMainClient()

      /**
       * Fetch all WMS vendors with their organization information
       * 
       * We select:
       * - Basic vendor info (id, name, vendor_type, is_active)
       * - Sync timestamps (last_sites_synced_at, last_insolation_synced_at)
       * - Created timestamp
       * - Organization information (id, name)
       * 
       * We order by name for consistent results.
       */
      const { data: vendors, error: vendorsError } = await supabase
        .from("wms_vendors")
        .select(`
          id,
          name,
          vendor_type,
          is_active,
          last_sites_synced_at,
          last_insolation_synced_at,
          created_at,
          organizations (
            id,
            name
          )
        `)
        .order("name")

      /**
       * Handle database query errors
       * 
       * If the query fails, we log the error and return a 500 response.
       * This helps identify database connectivity or query issues.
       */
      if (vendorsError) {
        logger.error("Failed to fetch WMS vendors for sync status", {
          error: vendorsError.message,
          code: vendorsError.code,
        })
        const response = NextResponse.json(
          { error: "Failed to fetch WMS vendors" },
          { status: 500 }
        )
        logApiResponse(request, 500, Date.now() - startTime, vendorsError)
        return response
      }

      /**
       * Log successful response
       * 
       * We log the number of vendors returned to help with monitoring and debugging.
       */
      logger.info("WMS vendor sync status fetched successfully", {
        vendorCount: vendors?.length || 0,
      })

      /**
       * Return successful response with vendor data
       * 
       * The response includes:
       * - All vendors with their sync status
       * - Organization information for each vendor
       * - Last sync timestamps for sites and insolation
       * 
       * This data is used by the frontend to display sync status in the dashboard.
       */
      const response = NextResponse.json({
        vendors: vendors || [],
      })

      // Log successful API response
      logApiResponse(request, 200, Date.now() - startTime)

      return response
    } catch (error: any) {
      /**
       * Handle unexpected errors
       * 
       * If any unexpected error occurs (e.g., permission check throws, etc.),
       * we catch it here and return a 500 response.
       * 
       * We log the error for debugging purposes.
       */
      logger.error("Unexpected error in WMS vendor sync status endpoint", {
        error: error.message,
        stack: error.stack,
      })

      const response = NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      )

      logApiResponse(request, 500, Date.now() - startTime, error)
      return response
    }
  })
}

