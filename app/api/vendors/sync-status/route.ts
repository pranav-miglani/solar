import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import { logApiRequest, logApiResponse, withMDCContext } from "@/lib/api-logger"
import { logger } from "@/lib/context/logger"

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  return withMDCContext(request, async () => {
    try {
      // Log request with MDC context (includes user info automatically)
      logApiRequest(request)
      
      const session = request.cookies.get("session")?.value

      if (!session) {
        logger.warn("Unauthorized access attempt to vendor sync status")
        const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        logApiResponse(request, 401, Date.now() - startTime)
        return response
      }

      let sessionData
      try {
        sessionData = JSON.parse(Buffer.from(session, "base64").toString())
      } catch {
        logger.warn("Invalid session format in vendor sync status request")
        const response = NextResponse.json({ error: "Invalid session" }, { status: 401 })
        logApiResponse(request, 401, Date.now() - startTime)
        return response
      }

      const accountType = sessionData.accountType as string
      const userId = sessionData.accountId
      const userEmail = sessionData.email

      // Log who is making the request (MDC context already includes this, but explicit log for audit)
      logger.info("Fetching vendor sync status", {
        accountType,
        userId,
        userEmail,
        trigger: "user-request", // Indicates this is a user-initiated request (not cron/system)
      })

      // Only SUPERADMIN can view vendor sync status
      requirePermission(accountType as any, "vendors", "read")

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

      const supabase = getMainClient()

      // Fetch all vendors with their organization and sync status
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

      logger.info("Successfully fetched vendor sync status", {
        vendorCount: vendors?.length || 0,
        userId,
        accountType,
        trigger: "user-request",
      })

      const response = NextResponse.json({ vendors: vendors || [] })
      logApiResponse(request, 200, Date.now() - startTime)
      return response
    } catch (error: any) {
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

