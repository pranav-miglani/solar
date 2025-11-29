import { NextRequest, NextResponse } from "next/server"
import type { AccountType } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import { logApiRequest, logApiResponse, withMDCContext } from "@/lib/api-logger"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

interface DashboardData {
  role: AccountType
  metrics: {
    totalPlants?: number
    unmappedPlants?: number
    mappedPlants?: number
    totalAlerts?: number
    activeAlerts?: number
    totalWorkOrders?: number
    totalEnergyMwh?: number
    // Additional energy metrics for GOVT users
    dailyEnergyMwh?: number
    monthlyEnergyMwh?: number
    yearlyEnergyMwh?: number
    currentPowerKw?: number
    installedCapacityKw?: number
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
      // For SUPERADMIN, compute counts for:
      // - Plants
      // - Active alerts only (status = 'ACTIVE')
      // - Work orders
      const [plantsResult, activeAlertsResult, workOrdersResult] = await Promise.all([
        supabase.from("plants").select("id", { count: "exact", head: true }),
        supabase
          .from("alerts")
          .select("id", { count: "exact", head: true })
          .eq("status", "ACTIVE"),
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

      // Calculate total energy generation (sum of total_energy_mwh from all plants)
      const { data: allPlants } = await supabase
        .from("plants")
        .select("total_energy_mwh")

      const totalEnergyMwh = allPlants?.reduce((sum, p) => sum + (p.total_energy_mwh || 0), 0) || 0

      dashboardData.metrics = {
        totalPlants,
        unmappedPlants,
        mappedPlants,
        activeAlerts: activeAlertsResult.count || 0,
        totalWorkOrders: workOrdersResult.count || 0,
        totalEnergyMwh,
      }

      dashboardData.widgets = {
        showOrganizations: true,
        showVendors: true,
        showPlants: true,
        showCreateWorkOrder: true,
        showTelemetryChart: false,
        showAlertsFeed: true,
        showWorkOrdersSummary: true,
      }
    } else if (accountType === "GOVT") {
      // GOVT sees metrics based ONLY on plants mapped to work orders:
      // - Only count plants that are in active work orders
      // - `activeAlerts` is the count of alerts where status = 'ACTIVE' for those plants
      // - No total alerts metric is exposed on the dashboard.
      
      // Get plant IDs from active work orders
      const { data: workOrderPlantsData } = await supabase
        .from("work_order_plants")
        .select("plant_id")
        .eq("is_active", true)

      const mappedPlantIds = workOrderPlantsData
        ? workOrderPlantsData.map((wop) => wop.plant_id)
        : []

      const mappedPlants = mappedPlantIds.length

      // Get metrics only for plants in work orders
      const [plantsResult, activeAlertsResult, workOrdersResult] = await Promise.all([
        mappedPlantIds.length > 0
          ? supabase
              .from("plants")
              .select("id", { count: "exact", head: true })
              .in("id", mappedPlantIds)
          : { count: 0, data: null, error: null },
        mappedPlantIds.length > 0
          ? supabase
              .from("alerts")
              .select("id", { count: "exact", head: true })
              .eq("status", "ACTIVE")
              .in("plant_id", mappedPlantIds)
          : { count: 0, data: null, error: null },
        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true }),
      ])
      const totalPlants = plantsResult.count || 0
      const unmappedPlants = 0 // GOVT users don't see unmapped plants

      // Fetch all plant attributes for plants in work orders
      const { data: allPlants } = mappedPlantIds.length > 0
        ? await supabase
            .from("plants")
            .select("daily_energy_kwh, monthly_energy_mwh, yearly_energy_mwh, total_energy_mwh, current_power_kw, capacity_kw")
            .in("id", mappedPlantIds)
        : { data: [] as any[] }

      // Calculate aggregated metrics
      const totalEnergyMwh = allPlants?.reduce((sum, p) => sum + (p.total_energy_mwh || 0), 0) || 0
      // Convert daily_energy_kwh to MWh (divide by 1000)
      const dailyEnergyMwh = allPlants?.reduce((sum, p) => sum + ((p.daily_energy_kwh || 0) / 1000), 0) || 0
      const monthlyEnergyMwh = allPlants?.reduce((sum, p) => sum + (p.monthly_energy_mwh || 0), 0) || 0
      const yearlyEnergyMwh = allPlants?.reduce((sum, p) => sum + (p.yearly_energy_mwh || 0), 0) || 0
      const currentPowerKw = allPlants?.reduce((sum, p) => sum + (p.current_power_kw || 0), 0) || 0
      const installedCapacityKw = allPlants?.reduce((sum, p) => sum + (p.capacity_kw || 0), 0) || 0

      dashboardData.metrics = {
        totalPlants,
        unmappedPlants,
        mappedPlants,
        activeAlerts: activeAlertsResult.count || 0,
        totalWorkOrders: workOrdersResult.count || 0,
        totalEnergyMwh,
        dailyEnergyMwh,
        monthlyEnergyMwh,
        yearlyEnergyMwh,
        currentPowerKw,
        installedCapacityKw,
      }

      dashboardData.widgets = {
        showTelemetryChart: false,
        showAlertsFeed: true,
        showWorkOrdersSummary: true,
        showOrgBreakdown: true,
        showExportCSV: true,
      }
    } else if (accountType === "ORG" && orgId) {
      // ORG users see org-specific metrics based ONLY on active alerts
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

      // Get ACTIVE alerts for org plants only
      const activeAlertsResult = await supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("status", "ACTIVE")
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

      // Calculate total energy generation (sum of total_energy_mwh from org plants)
      const { data: orgPlantsData } = await supabase
        .from("plants")
        .select("total_energy_mwh")
        .eq("org_id", orgId)

      const totalEnergyMwh = orgPlantsData?.reduce((sum, p) => sum + (p.total_energy_mwh || 0), 0) || 0

      dashboardData.metrics = {
        totalPlants,
        unmappedPlants,
        mappedPlants,
        activeAlerts: activeAlertsResult.count || 0,
        totalWorkOrders: workOrdersResult.count || 0,
        totalEnergyMwh,
      }

      dashboardData.widgets = {
        showTelemetryChart: false,
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

