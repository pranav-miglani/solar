import { NextRequest, NextResponse } from "next/server"
import type { AccountType } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import { logApiRequest, logApiResponse, withMDCContext, jsonResponse } from "@/lib/api-logger"
import { logger } from "@/lib/context/logger"

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

      logger.info(`[Dashboard] Loading dashboard for accountType: ${accountType}, orgId: ${orgId || 'null'}`)

    // Use service role client to bypass RLS
    const supabase = getMainClient()

    const dashboardData: DashboardData = {
      role: accountType,
      metrics: {},
      widgets: {},
    }

    if (accountType === "SUPERADMIN" || accountType === "DEVELOPER") {
      logger.info(`[Dashboard] Processing SUPERADMIN/DEVELOPER dashboard`)
      
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

      logger.info(`[Dashboard] Query results - Plants: ${plantsResult.count || 0}, Active Alerts: ${activeAlertsResult.count || 0}, Work Orders: ${workOrdersResult.count || 0}`)

      // Get mapped plants (plants in active work orders)
      const { data: mappedPlantsData, error: mappedPlantsError } = await supabase
        .from("work_order_plants")
        .select("plant_id")
        .eq("is_active", true)

      if (mappedPlantsError) {
        logger.error(`[Dashboard] Error fetching mapped plants:`, mappedPlantsError)
      }

      const mappedPlants = mappedPlantsData
        ? new Set(mappedPlantsData.map((wop) => wop.plant_id)).size
        : 0
      const totalPlants = plantsResult.count || 0
      const unmappedPlants = totalPlants - mappedPlants

      logger.info(`[Dashboard] Plant mapping - Total: ${totalPlants}, Mapped: ${mappedPlants}, Unmapped: ${unmappedPlants}`)

      // Calculate total energy generation (sum of total_energy_mwh from all plants)
      const { data: allPlants, error: plantsError } = await supabase
        .from("plants")
        .select("total_energy_mwh")

      if (plantsError) {
        logger.error(`[Dashboard] Error fetching plant energy data:`, plantsError)
      }

      const totalEnergyMwh = allPlants?.reduce((sum, p) => sum + (p.total_energy_mwh || 0), 0) || 0
      logger.info(`[Dashboard] Total energy calculated: ${totalEnergyMwh} MWh from ${allPlants?.length || 0} plants`)

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
      logger.info(`[Dashboard] Processing GOVT dashboard`)
      
      // GOVT sees metrics based ONLY on plants mapped to work orders:
      // - Only count plants that are in active work orders
      // - Alerts are NOT queried or displayed for GOVT users (Active Alerts card is hidden in UI)
      // - No total alerts metric is exposed on the dashboard.
      
      // Get all work orders
      const { data: workOrders, error: woError } = await supabase
        .from("work_orders")
        .select("id")

      if (woError) {
        logger.error(`[Dashboard] Error fetching work orders for GOVT:`, woError)
      }

      const workOrderIds = workOrders?.map((wo) => wo.id) || []
      logger.info(`[Dashboard] Found ${workOrderIds.length} work orders for GOVT dashboard`)

      // Get all active plants for all work orders using a join (similar to org production route)
      const { data: workOrderPlants, error: wopError } = workOrderIds.length > 0
        ? await supabase
            .from("work_order_plants")
            .select(`
              plant_id,
              plants (*)
            `)
            .in("work_order_id", workOrderIds)
            .eq("is_active", true)
        : { data: null, error: null }

      if (wopError) {
        logger.error(`[Dashboard] Error fetching work order plants for GOVT dashboard:`, wopError)
      }

      // Extract plants from the join result
      const plants = workOrderPlants
        ? workOrderPlants.map((wop: any) => wop.plants).filter(Boolean)
        : []

      logger.info(`[Dashboard] Extracted ${plants.length} plants from work orders`)

      const mappedPlants = plants.length
      const totalPlants = mappedPlants
      const unmappedPlants = 0 // GOVT users don't see unmapped plants

      // Note: GOVT users don't see alerts on the dashboard (Active Alerts card is filtered out in DashboardMetrics component)
      // So we skip the alert query entirely to avoid unnecessary database load and header overflow issues
      const activeAlertsCount = 0

      // Calculate aggregated metrics from plants
      const totalEnergyMwh = plants.reduce((sum: number, p: any) => sum + (p.total_energy_mwh || 0), 0)
      // Convert daily_energy_kwh to MWh (divide by 1000)
      const dailyEnergyMwh = plants.reduce((sum: number, p: any) => sum + ((p.daily_energy_kwh || 0) / 1000), 0)
      const monthlyEnergyMwh = plants.reduce((sum: number, p: any) => sum + (p.monthly_energy_mwh || 0), 0)
      const yearlyEnergyMwh = plants.reduce((sum: number, p: any) => sum + (p.yearly_energy_mwh || 0), 0)
      const currentPowerKw = plants.reduce((sum: number, p: any) => sum + (p.current_power_kw || 0), 0)
      const installedCapacityKw = plants.reduce((sum: number, p: any) => sum + (p.capacity_kw || 0), 0)

      logger.info(`[Dashboard] GOVT metrics calculated - Total Energy: ${totalEnergyMwh} MWh, Daily: ${dailyEnergyMwh} MWh, Monthly: ${monthlyEnergyMwh} MWh, Yearly: ${yearlyEnergyMwh} MWh, Current Power: ${currentPowerKw} kW, Capacity: ${installedCapacityKw} kW`)

      dashboardData.metrics = {
        totalPlants,
        unmappedPlants,
        mappedPlants,
        activeAlerts: activeAlertsCount,
        totalWorkOrders: workOrderIds.length,
        totalEnergyMwh,
        dailyEnergyMwh,
        monthlyEnergyMwh,
        yearlyEnergyMwh,
        currentPowerKw,
        installedCapacityKw,
      }

      dashboardData.widgets = {
        showTelemetryChart: false,
        showAlertsFeed: false, // Hide alerts feed for GOVT users on dashboard
        showWorkOrdersSummary: true,
        showOrgBreakdown: true,
        showExportCSV: true,
      }
      
      logger.info(`[Dashboard] GOVT dashboard data prepared successfully`)
    } else if (accountType === "ORG" && orgId) {
      logger.info(`[Dashboard] Processing ORG dashboard for orgId: ${orgId}`)
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
      }
    }

      logger.info(`[Dashboard] Dashboard data loaded successfully in ${Date.now() - startTime}ms`)
      logApiResponse(request, 200, Date.now() - startTime)
      return jsonResponse(dashboardData)
    } catch (error) {
      logger.error(`[Dashboard] Error loading dashboard:`, error)
      logApiResponse(request, 500, Date.now() - startTime, error)
      return jsonResponse(
        { error: "Internal server error" },
        { status: 500 }
      )
    }
  })
}

