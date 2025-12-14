/**
 * Dashboard Service
 * 
 * Phase 21: Dashboard API Refactoring
 * 
 * Provides dashboard metrics using the repository pattern.
 * Handles role-based data aggregation for SUPERADMIN, DEVELOPER, GOVT, and ORG users.
 * 
 * Feature Toggle: USE_DASHBOARD_SERVICE
 * - 'true' (default): Uses this service
 * - 'false': Falls back to legacy direct queries
 */

import type { AccountType } from "@/lib/rbac"
import { logger } from "@/lib/context/logger"

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface DashboardMetrics {
  totalPlants?: number
  unmappedPlants?: number
  mappedPlants?: number
  totalAlerts?: number
  activeAlerts?: number
  totalWorkOrders?: number
  totalEnergyMwh?: number
  dailyEnergyMwh?: number
  monthlyEnergyMwh?: number
  yearlyEnergyMwh?: number
  currentPowerKw?: number
  installedCapacityKw?: number
}

export interface DashboardWidgets {
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

export interface DashboardData {
  role: AccountType
  metrics: DashboardMetrics
  widgets: DashboardWidgets
}

export interface DashboardContext {
  accountType: AccountType
  orgId?: number
}

// =============================================================================
// Service Interface
// =============================================================================

export interface IDashboardService {
  getDashboardData(context: DashboardContext): Promise<DashboardData>
}

// =============================================================================
// Dashboard Service Implementation
// =============================================================================

import type { IPlantsRepository } from "@/lib/repositories/main/plantsRepository"
import type { IAlertsRepository } from "@/lib/repositories/main/alertsRepository"
import type { IWorkOrdersRepository } from "@/lib/repositories/main/workOrdersRepository"
import type { IWorkOrderPlantsRepository } from "@/lib/repositories/main/workOrderPlantsRepository"

export class DashboardService implements IDashboardService {
  constructor(
    private readonly plantsRepo: IPlantsRepository,
    private readonly alertsRepo: IAlertsRepository,
    private readonly workOrdersRepo: IWorkOrdersRepository,
    private readonly workOrderPlantsRepo: IWorkOrderPlantsRepository
  ) {}

  async getDashboardData(context: DashboardContext): Promise<DashboardData> {
    const { accountType, orgId } = context
    
    logger.info(`[DashboardService] Loading dashboard for accountType: ${accountType}, orgId: ${orgId || 'null'}`)

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

  // ---------------------------------------------------------------------------
  // SUPERADMIN / DEVELOPER Dashboard
  // ---------------------------------------------------------------------------
  private async getSuperAdminDashboard(dashboardData: DashboardData): Promise<DashboardData> {
    logger.info(`[DashboardService] Processing SUPERADMIN/DEVELOPER dashboard`)

    // Fetch all required data in parallel
    const [allPlants, activeAlerts, allWorkOrders, activeMappedPlantIds] = await Promise.all([
      this.plantsRepo.findAllWithRelations(),
      this.alertsRepo.findWithPlants({ status: 'ACTIVE' }),
      this.workOrdersRepo.findAllWithPlants(),
      this.workOrderPlantsRepo.getActivePlantIds()
    ])

    const totalPlants = allPlants.length
    const mappedPlants = new Set(activeMappedPlantIds).size
    const unmappedPlants = totalPlants - mappedPlants

    // Calculate total energy
    const totalEnergyMwh = allPlants.reduce((sum, p) => sum + (p.total_energy_mwh || 0), 0)

    logger.info(`[DashboardService] SUPERADMIN metrics - Plants: ${totalPlants}, Mapped: ${mappedPlants}, Unmapped: ${unmappedPlants}, Active Alerts: ${activeAlerts.length}, Work Orders: ${allWorkOrders.length}, Total Energy: ${totalEnergyMwh} MWh`)

    dashboardData.metrics = {
      totalPlants,
      unmappedPlants,
      mappedPlants,
      activeAlerts: activeAlerts.length,
      totalWorkOrders: allWorkOrders.length,
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

  // ---------------------------------------------------------------------------
  // GOVT Dashboard
  // ---------------------------------------------------------------------------
  private async getGovtDashboard(dashboardData: DashboardData): Promise<DashboardData> {
    logger.info(`[DashboardService] Processing GOVT dashboard`)

    // Get all work orders with their plants
    const workOrders = await this.workOrdersRepo.findAllWithPlants()
    
    logger.info(`[DashboardService] Found ${workOrders.length} work orders for GOVT dashboard`)

    // Get all active plant IDs from work orders
    const activePlantIds = await this.workOrderPlantsRepo.getActivePlantIds()
    
    // Fetch full plant data for mapped plants
    const plants = activePlantIds.length > 0 
      ? await this.plantsRepo.findByIdsWithRelations(activePlantIds)
      : []

    logger.info(`[DashboardService] Extracted ${plants.length} plants from work orders`)

    const mappedPlants = plants.length
    const totalPlants = mappedPlants
    const unmappedPlants = 0 // GOVT users don't see unmapped plants

    // Note: GOVT users don't see alerts on the dashboard
    const activeAlertsCount = 0

    // Calculate aggregated metrics from plants
    const totalEnergyMwh = plants.reduce((sum, p) => sum + (p.total_energy_mwh || 0), 0)
    const dailyEnergyMwh = plants.reduce((sum, p) => sum + ((p.daily_energy_kwh || 0) / 1000), 0)
    const monthlyEnergyMwh = plants.reduce((sum, p) => sum + (p.monthly_energy_mwh || 0), 0)
    const yearlyEnergyMwh = plants.reduce((sum, p) => sum + (p.yearly_energy_mwh || 0), 0)
    const currentPowerKw = plants.reduce((sum, p) => sum + (p.current_power_kw || 0), 0)
    const installedCapacityKw = plants.reduce((sum, p) => sum + (p.capacity_kw || 0), 0)

    logger.info(`[DashboardService] GOVT metrics - Total Energy: ${totalEnergyMwh} MWh, Daily: ${dailyEnergyMwh} MWh, Monthly: ${monthlyEnergyMwh} MWh, Current Power: ${currentPowerKw} kW`)

    dashboardData.metrics = {
      totalPlants,
      unmappedPlants,
      mappedPlants,
      activeAlerts: activeAlertsCount,
      totalWorkOrders: workOrders.length,
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

    logger.info(`[DashboardService] GOVT dashboard data prepared successfully`)
    return dashboardData
  }

  // ---------------------------------------------------------------------------
  // ORG Dashboard
  // ---------------------------------------------------------------------------
  private async getOrgDashboard(dashboardData: DashboardData, orgId: number): Promise<DashboardData> {
    logger.info(`[DashboardService] Processing ORG dashboard for orgId: ${orgId}`)

    // Fetch org-specific plants
    const orgPlants = await this.plantsRepo.findByOrgIdWithRelations(orgId)
    const plantIds = orgPlants.map(p => p.id)
    const totalPlants = orgPlants.length

    // Get mapped plants for this org
    const activeMappedPlantIds = await this.workOrderPlantsRepo.getActivePlantIds()
    const orgMappedPlantIds = activeMappedPlantIds.filter(id => plantIds.includes(id))
    const mappedPlants = new Set(orgMappedPlantIds).size
    const unmappedPlants = totalPlants - mappedPlants

    // Get active alerts for org plants
    const activeAlerts = plantIds.length > 0
      ? await this.alertsRepo.findWithPlants({ plantIds, status: 'ACTIVE' })
      : []

    // Get work orders for org plants
    const workOrderIds = await this.workOrderPlantsRepo.getWorkOrderIdsByPlantIds(plantIds)
    const totalWorkOrders = new Set(workOrderIds).size

    // Calculate total energy
    const totalEnergyMwh = orgPlants.reduce((sum, p) => sum + (p.total_energy_mwh || 0), 0)

    logger.info(`[DashboardService] ORG metrics - Plants: ${totalPlants}, Mapped: ${mappedPlants}, Active Alerts: ${activeAlerts.length}, Work Orders: ${totalWorkOrders}`)

    dashboardData.metrics = {
      totalPlants,
      unmappedPlants,
      mappedPlants,
      activeAlerts: activeAlerts.length,
      totalWorkOrders,
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

