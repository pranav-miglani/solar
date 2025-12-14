/**
 * Dashboard Service Tests
 * 
 * Phase 21: Dashboard API Refactoring
 * 
 * Tests the DashboardService with mocked repositories
 */

import { DashboardService, DashboardContext, DashboardData } from "@/lib/services/dashboardService"
import type { IPlantsRepository } from "@/lib/repositories/main/plantsRepository"
import type { IAlertsRepository } from "@/lib/repositories/main/alertsRepository"
import type { IWorkOrdersRepository } from "@/lib/repositories/main/workOrdersRepository"
import type { IWorkOrderPlantsRepository } from "@/lib/repositories/main/workOrderPlantsRepository"

// =============================================================================
// Mock Factories
// =============================================================================

const createMockPlant = (id: number, overrides: Partial<any> = {}) => ({
  id,
  name: `Plant ${id}`,
  org_id: 1,
  vendor_id: 1,
  capacity_kw: 1000,
  current_power_kw: 500,
  daily_energy_kwh: 5000,
  monthly_energy_mwh: 150,
  yearly_energy_mwh: 1800,
  total_energy_mwh: 10000,
  ...overrides,
})

const createMockWorkOrder = (id: number, overrides: Partial<any> = {}) => ({
  id,
  status: "ACTIVE",
  created_at: new Date().toISOString(),
  work_order_plants: [],
  ...overrides,
})

const createMockAlert = (id: number, overrides: Partial<any> = {}) => ({
  id,
  plant_id: 1,
  status: "ACTIVE",
  alert_type: "WARNING",
  alert_time: new Date().toISOString(),
  plants: { id: 1, name: "Plant 1", org_id: 1 },
  ...overrides,
})

// =============================================================================
// Mock Repository Implementations
// =============================================================================

const createMockPlantsRepository = (plants: any[] = []): IPlantsRepository => ({
  findAllWithRelations: jest.fn().mockResolvedValue(plants),
  findByOrgIdWithRelations: jest.fn().mockImplementation((orgId: number) => 
    Promise.resolve(plants.filter(p => p.org_id === orgId))
  ),
  findByIdsWithRelations: jest.fn().mockImplementation((ids: number[]) => 
    Promise.resolve(plants.filter(p => ids.includes(p.id)))
  ),
  findByIdWithRelations: jest.fn().mockResolvedValue(null),
  findById: jest.fn().mockResolvedValue(null),
  findByOrgId: jest.fn().mockResolvedValue([]),
  getPlantIdsByOrgId: jest.fn().mockResolvedValue([]),
  save: jest.fn().mockResolvedValue(plants[0]),
  update: jest.fn().mockResolvedValue(plants[0]),
  deleteById: jest.fn().mockResolvedValue(undefined),
})

const createMockAlertsRepository = (alerts: any[] = []): IAlertsRepository => ({
  findWithPlants: jest.fn().mockImplementation((filters?: { status?: string; plantIds?: number[] }) => {
    let result = [...alerts]
    if (filters?.status) result = result.filter(a => a.status === filters.status)
    if (filters?.plantIds) result = result.filter(a => filters.plantIds!.includes(a.plant_id))
    return Promise.resolve(result)
  }),
  findById: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockResolvedValue(alerts[0]),
  saveAll: jest.fn().mockResolvedValue(alerts),
  countActive: jest.fn().mockResolvedValue(alerts.filter(a => a.status === "ACTIVE").length),
})

const createMockWorkOrdersRepository = (workOrders: any[] = []): IWorkOrdersRepository => ({
  findAllWithPlants: jest.fn().mockResolvedValue(workOrders),
  findByIdWithPlants: jest.fn().mockResolvedValue(null),
  findById: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockResolvedValue(workOrders[0]),
  update: jest.fn().mockResolvedValue(workOrders[0]),
  deleteById: jest.fn().mockResolvedValue(undefined),
  validatePlantsForOrg: jest.fn().mockResolvedValue({ isValid: true, orgId: 1 }),
})

const createMockWorkOrderPlantsRepository = (mappedPlantIds: number[] = [], workOrderIdsByPlantId: Map<number, number[]> = new Map()): IWorkOrderPlantsRepository => ({
  findByWorkOrderId: jest.fn().mockResolvedValue([]),
  findActiveByPlantIds: jest.fn().mockResolvedValue([]),
  getActivePlantIds: jest.fn().mockResolvedValue(mappedPlantIds),
  getWorkOrderIdsByPlantIds: jest.fn().mockImplementation((plantIds: number[]) => {
    const result: number[] = []
    plantIds.forEach(pid => {
      const woIds = workOrderIdsByPlantId.get(pid) || []
      result.push(...woIds)
    })
    return Promise.resolve(result)
  }),
  deactivateByPlantIds: jest.fn().mockResolvedValue(undefined),
  deactivateByWorkOrderAndPlantIds: jest.fn().mockResolvedValue(undefined),
  activateByWorkOrderAndPlantIds: jest.fn().mockResolvedValue(undefined),
  saveAll: jest.fn().mockResolvedValue([]),
})

// =============================================================================
// Tests
// =============================================================================

describe("DashboardService", () => {
  describe("SUPERADMIN Dashboard", () => {
    it("should return correct metrics for SUPERADMIN", async () => {
      const plants = [
        createMockPlant(1, { total_energy_mwh: 100 }),
        createMockPlant(2, { total_energy_mwh: 200 }),
        createMockPlant(3, { total_energy_mwh: 300 }),
      ]
      const alerts = [
        createMockAlert(1, { status: "ACTIVE" }),
        createMockAlert(2, { status: "ACTIVE" }),
      ]
      const workOrders = [createMockWorkOrder(1), createMockWorkOrder(2)]
      const mappedPlantIds = [1, 2] // Plants 1 and 2 are mapped

      const service = new DashboardService(
        createMockPlantsRepository(plants),
        createMockAlertsRepository(alerts),
        createMockWorkOrdersRepository(workOrders),
        createMockWorkOrderPlantsRepository(mappedPlantIds)
      )

      const result = await service.getDashboardData({ accountType: "SUPERADMIN" })

      expect(result.role).toBe("SUPERADMIN")
      expect(result.metrics.totalPlants).toBe(3)
      expect(result.metrics.mappedPlants).toBe(2)
      expect(result.metrics.unmappedPlants).toBe(1)
      expect(result.metrics.activeAlerts).toBe(2)
      expect(result.metrics.totalWorkOrders).toBe(2)
      expect(result.metrics.totalEnergyMwh).toBe(600) // 100 + 200 + 300
    })

    it("should show correct widgets for SUPERADMIN", async () => {
      const service = new DashboardService(
        createMockPlantsRepository([]),
        createMockAlertsRepository([]),
        createMockWorkOrdersRepository([]),
        createMockWorkOrderPlantsRepository([])
      )

      const result = await service.getDashboardData({ accountType: "SUPERADMIN" })

      expect(result.widgets.showOrganizations).toBe(true)
      expect(result.widgets.showVendors).toBe(true)
      expect(result.widgets.showPlants).toBe(true)
      expect(result.widgets.showCreateWorkOrder).toBe(true)
      expect(result.widgets.showAlertsFeed).toBe(true)
      expect(result.widgets.showWorkOrdersSummary).toBe(true)
    })
  })

  describe("DEVELOPER Dashboard", () => {
    it("should return same data as SUPERADMIN", async () => {
      const plants = [createMockPlant(1)]
      const service = new DashboardService(
        createMockPlantsRepository(plants),
        createMockAlertsRepository([]),
        createMockWorkOrdersRepository([]),
        createMockWorkOrderPlantsRepository([])
      )

      const result = await service.getDashboardData({ accountType: "DEVELOPER" })

      expect(result.role).toBe("DEVELOPER")
      expect(result.metrics.totalPlants).toBe(1)
      expect(result.widgets.showOrganizations).toBe(true)
    })
  })

  describe("GOVT Dashboard", () => {
    it("should return metrics only for mapped plants", async () => {
      const plants = [
        createMockPlant(1, { 
          total_energy_mwh: 100,
          daily_energy_kwh: 5000,
          monthly_energy_mwh: 150,
          yearly_energy_mwh: 1800,
          current_power_kw: 500,
          capacity_kw: 1000,
        }),
        createMockPlant(2, { 
          total_energy_mwh: 200,
          daily_energy_kwh: 10000,
          monthly_energy_mwh: 300,
          yearly_energy_mwh: 3600,
          current_power_kw: 800,
          capacity_kw: 2000,
        }),
      ]
      const workOrders = [createMockWorkOrder(1)]
      const mappedPlantIds = [1, 2]

      const plantsRepo = createMockPlantsRepository(plants)
      const service = new DashboardService(
        plantsRepo,
        createMockAlertsRepository([]),
        createMockWorkOrdersRepository(workOrders),
        createMockWorkOrderPlantsRepository(mappedPlantIds)
      )

      const result = await service.getDashboardData({ accountType: "GOVT" })

      expect(result.role).toBe("GOVT")
      expect(result.metrics.totalPlants).toBe(2)
      expect(result.metrics.mappedPlants).toBe(2)
      expect(result.metrics.unmappedPlants).toBe(0)
      expect(result.metrics.activeAlerts).toBe(0) // GOVT doesn't see alerts
      expect(result.metrics.totalWorkOrders).toBe(1)
      expect(result.metrics.totalEnergyMwh).toBe(300)
      expect(result.metrics.dailyEnergyMwh).toBe(15) // (5000 + 10000) / 1000
      expect(result.metrics.monthlyEnergyMwh).toBe(450)
      expect(result.metrics.yearlyEnergyMwh).toBe(5400)
      expect(result.metrics.currentPowerKw).toBe(1300)
      expect(result.metrics.installedCapacityKw).toBe(3000)
    })

    it("should hide alerts feed for GOVT", async () => {
      const service = new DashboardService(
        createMockPlantsRepository([]),
        createMockAlertsRepository([]),
        createMockWorkOrdersRepository([]),
        createMockWorkOrderPlantsRepository([])
      )

      const result = await service.getDashboardData({ accountType: "GOVT" })

      expect(result.widgets.showAlertsFeed).toBe(false)
      expect(result.widgets.showOrgBreakdown).toBe(true)
      expect(result.widgets.showExportCSV).toBe(true)
    })
  })

  describe("ORG Dashboard", () => {
    it("should return metrics only for org plants", async () => {
      const orgId = 1
      const plants = [
        createMockPlant(1, { org_id: orgId, total_energy_mwh: 100 }),
        createMockPlant(2, { org_id: orgId, total_energy_mwh: 200 }),
        createMockPlant(3, { org_id: 2, total_energy_mwh: 500 }), // Different org
      ]
      const alerts = [
        createMockAlert(1, { plant_id: 1, status: "ACTIVE" }),
        createMockAlert(2, { plant_id: 2, status: "ACTIVE" }),
        createMockAlert(3, { plant_id: 3, status: "ACTIVE" }), // Different org
      ]
      const mappedPlantIds = [1]
      const workOrderIdsByPlantId = new Map([[1, [1]], [2, [2]]])

      const service = new DashboardService(
        createMockPlantsRepository(plants),
        createMockAlertsRepository(alerts),
        createMockWorkOrdersRepository([createMockWorkOrder(1), createMockWorkOrder(2)]),
        createMockWorkOrderPlantsRepository(mappedPlantIds, workOrderIdsByPlantId)
      )

      const result = await service.getDashboardData({ accountType: "ORG", orgId })

      expect(result.role).toBe("ORG")
      expect(result.metrics.totalPlants).toBe(2) // Only plants with org_id = 1
      expect(result.metrics.mappedPlants).toBe(1) // Only plant 1 is in both org and mapped
      expect(result.metrics.unmappedPlants).toBe(1)
      expect(result.metrics.activeAlerts).toBe(2) // Alerts for plants 1 and 2
      expect(result.metrics.totalEnergyMwh).toBe(300) // 100 + 200
    })

    it("should show alerts feed for ORG", async () => {
      const service = new DashboardService(
        createMockPlantsRepository([]),
        createMockAlertsRepository([]),
        createMockWorkOrdersRepository([]),
        createMockWorkOrderPlantsRepository([])
      )

      const result = await service.getDashboardData({ accountType: "ORG", orgId: 1 })

      expect(result.widgets.showAlertsFeed).toBe(true)
      expect(result.widgets.showWorkOrdersSummary).toBe(true)
    })

    it("should return empty data if orgId is not provided", async () => {
      const service = new DashboardService(
        createMockPlantsRepository([createMockPlant(1)]),
        createMockAlertsRepository([]),
        createMockWorkOrdersRepository([]),
        createMockWorkOrderPlantsRepository([])
      )

      const result = await service.getDashboardData({ accountType: "ORG" }) // No orgId

      expect(result.role).toBe("ORG")
      expect(result.metrics).toEqual({})
      expect(result.widgets).toEqual({})
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty databases", async () => {
      const service = new DashboardService(
        createMockPlantsRepository([]),
        createMockAlertsRepository([]),
        createMockWorkOrdersRepository([]),
        createMockWorkOrderPlantsRepository([])
      )

      const result = await service.getDashboardData({ accountType: "SUPERADMIN" })

      expect(result.metrics.totalPlants).toBe(0)
      expect(result.metrics.mappedPlants).toBe(0)
      expect(result.metrics.unmappedPlants).toBe(0)
      expect(result.metrics.activeAlerts).toBe(0)
      expect(result.metrics.totalWorkOrders).toBe(0)
      expect(result.metrics.totalEnergyMwh).toBe(0)
    })

    it("should handle plants with null energy values", async () => {
      const plants = [
        createMockPlant(1, { total_energy_mwh: null }),
        createMockPlant(2, { total_energy_mwh: undefined }),
        createMockPlant(3, { total_energy_mwh: 100 }),
      ]

      const service = new DashboardService(
        createMockPlantsRepository(plants),
        createMockAlertsRepository([]),
        createMockWorkOrdersRepository([]),
        createMockWorkOrderPlantsRepository([])
      )

      const result = await service.getDashboardData({ accountType: "SUPERADMIN" })

      expect(result.metrics.totalEnergyMwh).toBe(100)
    })
  })
})

