import { NextRequest, NextResponse } from "next/server"
import type { AccountType } from "@/lib/rbac"
import { getDashboardService } from "@/lib/services"
import { logApiRequest, logApiResponse, withMDCContext, jsonResponse } from "@/lib/api-logger"
import { logger } from "@/lib/context/logger"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  return withMDCContext(request, async () => {
    logApiRequest(request)
    
    try {
      const session = request.cookies.get("session")?.value

      if (!session) {
        logApiResponse(request, 401, Date.now() - startTime)
        return jsonResponse({ error: "Unauthorized" }, { status: 401 })
      }

      // Decode session
      let sessionData
      try {
        sessionData = JSON.parse(Buffer.from(session, "base64").toString())
      } catch {
        logApiResponse(request, 401, Date.now() - startTime)
        return jsonResponse({ error: "Invalid session" }, { status: 401 })
      }

      const accountType = sessionData.accountType as AccountType
      const orgId = sessionData.orgId

      logger.info(`[Dashboard API] Loading dashboard for accountType: ${accountType}, orgId: ${orgId || 'null'}`)

      // Use dashboard service (with feature toggle support)
      const dashboardService = getDashboardService()
      const dashboardData = await dashboardService.getDashboardData({
        accountType,
        orgId,
      })

      logger.info(`[Dashboard API] Dashboard data loaded successfully in ${Date.now() - startTime}ms`)
      logApiResponse(request, 200, Date.now() - startTime)
      return jsonResponse(dashboardData)
    } catch (error) {
      logger.error(`[Dashboard API] Error loading dashboard:`, error)
      logApiResponse(request, 500, Date.now() - startTime, error)
      return jsonResponse(
        { error: "Internal server error" },
        { status: 500 }
      )
    }
  })
}
