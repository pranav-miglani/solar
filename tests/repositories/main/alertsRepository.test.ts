/**
 * Alerts Repository Tests - Phase 11
 */

import { AlertsRepository } from "@/lib/repositories/main/alertsRepository"

describe("AlertsRepository", () => {
  const mockClient: any = {
    from: jest.fn(() => mockClient),
    select: jest.fn(() => mockClient),
    upsert: jest.fn(() => mockClient),
    eq: jest.fn(() => mockClient),
    in: jest.fn(() => mockClient),
    order: jest.fn(() => mockClient),
    limit: jest.fn(() => mockClient),
    single: jest.fn(),
  }

  let repository: AlertsRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repository = new AlertsRepository(mockClient)
  })

  describe("findWithPlants", () => {
    it("returns alerts with plant relations", async () => {
      const mockAlerts = [
        { id: 1, alert_type: "GRID_DOWN", plants: { id: 1, name: "Plant A" } },
      ]
      mockClient.limit.mockResolvedValueOnce({ data: mockAlerts, error: null })

      const result = await repository.findWithPlants({ limit: 10 })
      
      expect(result).toEqual(mockAlerts)
      expect(mockClient.order).toHaveBeenCalledWith("alert_time", { ascending: false })
    })

    it("filters by plantId when provided", async () => {
      mockClient.limit.mockResolvedValueOnce({ data: [], error: null })

      await repository.findWithPlants({ plantId: 5 })
      
      expect(mockClient.eq).toHaveBeenCalledWith("plant_id", 5)
    })

    it("filters by plantIds when provided", async () => {
      mockClient.limit.mockResolvedValueOnce({ data: [], error: null })

      await repository.findWithPlants({ plantIds: [1, 2, 3] })
      
      expect(mockClient.in).toHaveBeenCalledWith("plant_id", [1, 2, 3])
    })
  })

  describe("findById", () => {
    it("returns alert when found", async () => {
      const mockAlert = { id: 1, alert_type: "GRID_DOWN" }
      mockClient.single.mockResolvedValueOnce({ data: mockAlert, error: null })

      const result = await repository.findById(1)
      
      expect(result).toEqual(mockAlert)
    })

    it("returns null when not found", async () => {
      mockClient.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } })

      const result = await repository.findById(999)
      
      expect(result).toBeNull()
    })
  })

  describe("save", () => {
    it("upserts alert", async () => {
      const alertData = {
        plant_id: 1,
        vendor_id: 1,
        vendor_plant_id: "VP1",
        vendor_alert_id: "ALERT1",
        alert_type: "GRID_DOWN",
        alert_time: new Date().toISOString(),
      }
      const savedAlert = { id: 1, ...alertData }
      mockClient.single.mockResolvedValueOnce({ data: savedAlert, error: null })

      const result = await repository.save(alertData)
      
      expect(result.id).toBe(1)
      expect(mockClient.upsert).toHaveBeenCalled()
    })
  })

  describe("saveAll", () => {
    it("batch upserts alerts", async () => {
      const alertsData = [
        { plant_id: 1, vendor_id: 1, vendor_plant_id: "VP1", vendor_alert_id: "A1", alert_type: "GRID_DOWN", alert_time: new Date().toISOString() },
        { plant_id: 1, vendor_id: 1, vendor_plant_id: "VP1", vendor_alert_id: "A2", alert_type: "LOW_POWER", alert_time: new Date().toISOString() },
      ]
      mockClient.select.mockResolvedValueOnce({ data: alertsData.map((a, i) => ({ id: i + 1, ...a })), error: null })

      const result = await repository.saveAll(alertsData)
      
      expect(result.length).toBe(2)
    })

    it("returns empty array for empty input", async () => {
      const result = await repository.saveAll([])
      
      expect(result).toEqual([])
    })
  })

  describe("countActive", () => {
    it("returns count of active alerts", async () => {
      mockClient.eq.mockResolvedValueOnce({ count: 42, error: null })

      const result = await repository.countActive()
      
      expect(result).toBe(42)
    })
  })
})

