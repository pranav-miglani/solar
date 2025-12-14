/**
 * Plant Energy Readings Repository Tests - Phase 15
 */

import { PlantEnergyReadingsRepository } from "@/lib/repositories/analytics/plantEnergyReadingsRepository"

describe("PlantEnergyReadingsRepository", () => {
  const mockClient: any = {
    from: jest.fn(() => mockClient),
    select: jest.fn(() => mockClient),
    upsert: jest.fn(() => mockClient),
    eq: jest.fn(() => mockClient),
    gte: jest.fn(() => mockClient),
    lte: jest.fn(() => mockClient),
    order: jest.fn(() => mockClient),
    limit: jest.fn(() => mockClient),
    single: jest.fn(),
  }

  let repository: PlantEnergyReadingsRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repository = new PlantEnergyReadingsRepository(mockClient)
  })

  describe("findByPlantId", () => {
    it("returns readings for plant", async () => {
      const mockReadings = [{ id: 1, plant_id: 1, reading_date: "2024-01-01", today_energy_kwh: 100 }]
      mockClient.order.mockResolvedValueOnce({ data: mockReadings, error: null })

      const result = await repository.findByPlantId(1)
      
      expect(result).toEqual(mockReadings)
      expect(mockClient.eq).toHaveBeenCalledWith("plant_id", 1)
    })

    it("applies date filters", async () => {
      mockClient.limit.mockResolvedValueOnce({ data: [], error: null })

      await repository.findByPlantId(1, { startDate: "2024-01-01", endDate: "2024-01-31", limit: 10 })
      
      expect(mockClient.gte).toHaveBeenCalledWith("reading_date", "2024-01-01")
      expect(mockClient.lte).toHaveBeenCalledWith("reading_date", "2024-01-31")
    })
  })

  describe("findByVendorId", () => {
    it("returns readings for vendor", async () => {
      mockClient.order.mockResolvedValueOnce({ data: [], error: null })

      await repository.findByVendorId(5)
      
      expect(mockClient.eq).toHaveBeenCalledWith("vendor_id", 5)
    })
  })

  describe("findByPlantAndDate", () => {
    it("returns reading for specific plant and date", async () => {
      const mockReading = { id: 1, plant_id: 1, reading_date: "2024-01-01" }
      mockClient.single.mockResolvedValueOnce({ data: mockReading, error: null })

      const result = await repository.findByPlantAndDate(1, "2024-01-01")
      
      expect(result).toEqual(mockReading)
    })
  })

  describe("save", () => {
    it("upserts reading", async () => {
      const readingData = { plant_id: 1, vendor_id: 1, reading_date: "2024-01-01", today_energy_kwh: 100 }
      mockClient.single.mockResolvedValueOnce({ data: { id: 1, ...readingData }, error: null })

      const result = await repository.save(readingData)
      
      expect(result.id).toBe(1)
    })
  })

  describe("saveAll", () => {
    it("batch upserts readings", async () => {
      const readingsData = [
        { plant_id: 1, vendor_id: 1, reading_date: "2024-01-01", today_energy_kwh: 100 },
        { plant_id: 1, vendor_id: 1, reading_date: "2024-01-02", today_energy_kwh: 110 },
      ]
      mockClient.select.mockResolvedValueOnce({ data: readingsData.map((r, i) => ({ id: i + 1, ...r })), error: null })

      const result = await repository.saveAll(readingsData)
      
      expect(result.length).toBe(2)
    })
  })
})

