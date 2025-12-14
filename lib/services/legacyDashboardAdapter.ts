/**
 * Legacy Dashboard Adapter
 * 
 * Phase 21 - Feature Toggle Support
 * 
 * Implements IDashboardService using direct Supabase queries (original implementation).
 * Used when USE_DASHBOARD_SERVICE=false for instant rollback.
 */

import { SupabaseClient } from "@supabase/supabase-js"
import type { AccountType } from "@/lib/rbac"
import { logger } from "@/lib/context/logger"
import type { IDashboardService, DashboardData, DashboardContext } from "./dashboardService"

export class LegacyDashboardAdapter implements IDashboardService {
  constructor(private readonly client: SupabaseClient) {}

  async getDashboardData(context: DashboardContext): Promise<DashboardData> {
    const { accountType, orgId } = context
    
    logger.info(`[LegacyDashboardAdapter] Loading dashboard for accountType: ${accountType}, orgId: ${orgId || 'null'}`)

    const dashboardData: DashboardData = {
      role: accountType,
      metrics: {},
      widgets: {},
    }

    if (accountType === "SUPERADMIN" || accountType === "DEVELOPER") {
      return this.getSuperAdminDashboard(dashboardData)
    } else if (accountType === "GOVT") {
      return this.getGovtDashboard(dashboardData)
    } else if (accountType === "ORG" && orgId) {
      return this.getOrgDashboard(dashboardData, orgId)
    }

    return dashboardData
  }

  private async getSuperAdminDashboard(dashboardData: DashboardData): Promise<DashboardData> {
    logger.info(`[LegacyDashboardAdapter] Processing SUPERADMIN/DEVELOPER dashboard`)

    const [plantsResult, activeAlertsResult, workOrdersResult] = await Promise.all([
      this.client.from("plants").select("id", { count: "exact", head: true }),
      this.client.from("alerts").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
      this.client.from("work_orders").select("id", { count: "exact", head: true }),
    ])

    const { data: mappedPlantsData } = await this.client
      .from("work_order_plants")
      .select("plant_id")
      .eq("is_active", true)

    const mappedPlants = mappedPlantsData ? new Set(mappedPlantsData.map((wop) => wop.plant_id)).size : 0
    const totalPlants = plantsResult.count || 0
    const unmappedPlants = totalPlants - mappedPlants

    const { data: allPlants } = await this.client.from("plants").select("total_energy_mwh")
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

    return dashboardData
  }

  private async getGovtDashboard(dashboardData: DashboardData): Promise<DashboardData> {
    logger.info(`[LegacyDashboardAdapter] Processing GOVT dashboard`)

    const { data: workOrders } = await this.client.from("work_orders").select("id")
    const workOrderIds = workOrders?.map((wo) => wo.id) || []

    const { data: workOrderPlants } = workOrderIds.length > 0
      ? await this.client
          .from("work_order_plants")
          .select(`plant_id, plants (*)`)
          .in("work_order_id", workOrderIds)
          .eq("is_active", true)
      : { data: null }

    const plants = workOrderPlants ? workOrderPlants.map((wop: any) => wop.plants).filter(Boolean) : []
    const mappedPlants = plants.length
    const totalPlants = mappedPlants
    const unmappedPlants = 0

    const totalEnergyMwh = plants.reduce((sum: number, p: any) => sum + (p.total_energy_mwh || 0), 0)
    const dailyEnergyMwh = plants.reduce((sum: number, p: any) => sum + ((p.daily_energy_kwh || 0) / 1000), 0)
    const monthlyEnergyMwh = plants.reduce((sum: number, p: any) => sum + (p.monthly_energy_mwh || 0), 0)
    const yearlyEnergyMwh = plants.reduce((sum: number, p: any) => sum + (p.yearly_energy_mwh || 0), 0)
    const currentPowerKw = plants.reduce((sum: number, p: any) => sum + (p.current_power_kw || 0), 0)
    const installedCapacityKw = plants.reduce((sum: number, p: any) => sum + (p.capacity_kw || 0), 0)

    dashboardData.metrics = {
      totalPlants,
      unmappedPlants,
      mappedPlants,
      activeAlerts: 0,
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
      showAlertsFeed: false,
      showWorkOrdersSummary: true,
      showOrgBreakdown: true,
      showExportCSV: true,
    }

    return dashboardData
  }

  private async getOrgDashboard(dashboardData: DashboardData, orgId: number): Promise<DashboardData> {
    logger.info(`[LegacyDashboardAdapter] Processing ORG dashboard for orgId: ${orgId}`)

    const plantsResult = await this.client
      .from("plants")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)

    const { data: orgPlants } = await this.client.from("plants").select("id").eq("org_id", orgId)
    const plantIds = orgPlants?.map((p) => p.id) || []

    const { data: mappedPlantsData } = await this.client
      .from("work_order_plants")
      .select("plant_id")
      .eq("is_active", true)
      .in("plant_id", plantIds.length > 0 ? plantIds : [-1])

    const mappedPlants = mappedPlantsData ? new Set(mappedPlantsData.map((wop) => wop.plant_id)).size : 0
    const totalPlants = plantsResult.count || 0
    const unmappedPlants = totalPlants - mappedPlants

    const activeAlertsResult = await this.client
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE")
      .in("plant_id", plantIds)

    const { data: workOrderPlants } = await this.client
      .from("work_order_plants")
      .select("work_order_id")
      .in("plant_id", plantIds)

    const workOrderIds = [...new Set(workOrderPlants?.map((wop) => wop.work_order_id) || [])]

    const workOrdersResult = await this.client
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .in("id", workOrderIds.length > 0 ? workOrderIds : [-1])

    const { data: orgPlantsData } = await this.client.from("plants").select("total_energy_mwh").eq("org_id", orgId)
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

    return dashboardData
  }
}

