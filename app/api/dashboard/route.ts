import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { AccountType } from "@/lib/rbac"

interface DashboardData {
  role: AccountType
  metrics: {
    totalPlants?: number
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
  try {
    const supabase = await createClient()
    const session = request.cookies.get("session")?.value

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Decode session
    let sessionData
    try {
      sessionData = JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const accountType = sessionData.accountType as AccountType
    const orgId = sessionData.orgId

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

      dashboardData.metrics = {
        totalPlants: plantsResult.count || 0,
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

      dashboardData.metrics = {
        totalPlants: plantsResult.count || 0,
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
        totalPlants: plantsResult.count || 0,
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

    return NextResponse.json(dashboardData)
  } catch (error) {
    console.error("Dashboard error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

