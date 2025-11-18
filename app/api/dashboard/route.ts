import { NextRequest, NextResponse } from "next/server"
import type { AccountType } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import { logApiRequest, logApiResponse, withMDCContext } from "@/lib/api-logger"

interface DashboardData {
  role: AccountType
  metrics: {
    totalPlants?: number
    unmappedPlants?: number
    mappedPlants?: number
    totalAlerts?: number
    activeAlerts?: number
    totalWorkOrders?: number
    totalGeneration24h?: number
  }
  widgets: {
    showOrganizations?: boolean
    showVendors?: boolean
    showPlants?: boolean
    showCreateWorkOrder?: boolean
    showTelemetryChart?: boolean
    showAlertsFeed?: boolean
    showWorkOrdersSummary?: boolean
    showOrgBreakdown?: boolean
    showExportCSV?: boolean
    showEfficiencySummary?: boolean
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  return withMDCContext(request, async () => {
    logApiRequest(request)
    
    try {
      const session = request.cookies.get("session")?.value

      if (!session) {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      // Decode session
      let sessionData
      try {
        sessionData = JSON.parse(Buffer.from(session, "base64").toString())
      } catch {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Invalid session" }, { status: 401 })
      }

      const accountType = sessionData.accountType as AccountType
      const orgId = sessionData.orgId

    // Use service role client to bypass RLS
    const supabase = getMainClient()

    const dashboardData: DashboardData = {
      role: accountType,
      metrics: {},
      widgets: {},
    }

    if (accountType === "SUPERADMIN") {
      // Get all metrics
      const [plantsResult, alertsResult, workOrdersResult] = await Promise.all([
        supabase.from("plants").select("id", { count: "exact", head: true }),
        supabase.from("alerts").select("id", { count: "exact", head: true }),
        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true }),
      ])

      const activeAlertsResult = await supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("status", "ACTIVE")

      // Get mapped plants (plants in active work orders)
      const { data: mappedPlantsData } = await supabase
        .from("work_order_plants")
        .select("plant_id")
        .eq("is_active", true)

      const mappedPlants = mappedPlantsData
        ? new Set(mappedPlantsData.map((wop) => wop.plant_id)).size
        : 0
      const totalPlants = plantsResult.count || 0
      const unmappedPlants = totalPlants - mappedPlants

      dashboardData.metrics = {
        totalPlants,
        unmappedPlants,
        mappedPlants,
        totalAlerts: alertsResult.count || 0,
        activeAlerts: activeAlertsResult.count || 0,
        totalWorkOrders: workOrdersResult.count || 0,
      }

      dashboardData.widgets = {
        showOrganizations: true,
        showVendors: true,
        showPlants: true,
        showCreateWorkOrder: true,
        showTelemetryChart: true,
        showAlertsFeed: true,
        showWorkOrdersSummary: true,
      }
    } else if (accountType === "GOVT") {
      // Get global metrics
      const [plantsResult, alertsResult, workOrdersResult] = await Promise.all([
        supabase.from("plants").select("id", { count: "exact", head: true }),
        supabase.from("alerts").select("id", { count: "exact", head: true }),
        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true }),
      ])

      // Get mapped plants (plants in active work orders)
      const { data: mappedPlantsData } = await supabase
        .from("work_order_plants")
        .select("plant_id")
        .eq("is_active", true)

      const mappedPlants = mappedPlantsData
        ? new Set(mappedPlantsData.map((wop) => wop.plant_id)).size
        : 0
      const totalPlants = plantsResult.count || 0
      const unmappedPlants = totalPlants - mappedPlants

      dashboardData.metrics = {
        totalPlants,
        unmappedPlants,
        mappedPlants,
        totalAlerts: alertsResult.count || 0,
        totalWorkOrders: workOrdersResult.count || 0,
      }

      dashboardData.widgets = {
        showTelemetryChart: true,
        showAlertsFeed: true,
        showWorkOrdersSummary: true,
        showOrgBreakdown: true,
        showExportCSV: true,
      }
    } else if (accountType === "ORG" && orgId) {
      // Get org-specific metrics
      const plantsResult = await supabase
        .from("plants")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId)

      // Get plant IDs for this org
      const { data: orgPlants } = await supabase
        .from("plants")
        .select("id")
        .eq("org_id", orgId)

      const plantIds = orgPlants?.map((p) => p.id) || []

      // Get mapped plants (plants in active work orders for this org)
      const { data: mappedPlantsData } = await supabase
        .from("work_order_plants")
        .select("plant_id")
        .eq("is_active", true)
        .in("plant_id", plantIds.length > 0 ? plantIds : [-1])

      const mappedPlants = mappedPlantsData
        ? new Set(mappedPlantsData.map((wop) => wop.plant_id)).size
        : 0
      const totalPlants = plantsResult.count || 0
      const unmappedPlants = totalPlants - mappedPlants

      // Get alerts for org plants
      const alertsResult = await supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .in("plant_id", plantIds)

      // Get work orders for org plants
      const { data: workOrderPlants } = await supabase
        .from("work_order_plants")
        .select("work_order_id")
        .in("plant_id", plantIds)

      const workOrderIds = [
        ...new Set(workOrderPlants?.map((wop) => wop.work_order_id) || []),
      ]

      const workOrdersResult = await supabase
        .from("work_orders")
        .select("id", { count: "exact", head: true })
        .in("id", workOrderIds.length > 0 ? workOrderIds : [-1]) // Use -1 to return empty if no work orders

      dashboardData.metrics = {
        totalPlants,
        unmappedPlants,
        mappedPlants,
        totalAlerts: alertsResult.count || 0,
        totalWorkOrders: workOrdersResult.count || 0,
      }

      dashboardData.widgets = {
        showTelemetryChart: true,
        showAlertsFeed: true,
        showWorkOrdersSummary: true,
        showEfficiencySummary: true,
      }
    }

    logApiResponse(request, 200, Date.now() - startTime)
    return NextResponse.json(dashboardData)
  } catch (error) {
    console.error("Dashboard error:", error)
    logApiResponse(request, 500, Date.now() - startTime, error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
  })
}

