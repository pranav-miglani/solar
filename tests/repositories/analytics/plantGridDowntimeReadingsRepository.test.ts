/**
 * Plant Grid Downtime Readings Repository Tests - Phase 16
 */

import { PlantGridDowntimeReadingsRepository } from "@/lib/repositories/analytics/plantGridDowntimeReadingsRepository"

describe("PlantGridDowntimeReadingsRepository", () => {
  const mockClient: any = {
    from: jest.fn(() => mockClient),
    select: jest.fn(() => mockClient),
    upsert: jest.fn(() => mockClient),
    eq: jest.fn(() => mockClient),
    gte: jest.fn(() => mockClient),
    lte: jest.fn(() => mockClient),
    lt: jest.fn(() => mockClient),
    not: jest.fn(() => mockClient),
    order: jest.fn(() => mockClient),
    limit: jest.fn(() => mockClient),
    single: jest.fn(),
  }

  let repository: PlantGridDowntimeReadingsRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repository = new PlantGridDowntimeReadingsRepository(mockClient)
  })

  describe("findByPlantId", () => {
    it("returns readings for plant", async () => {
      const mockReadings = [{ id: 1, plant_id: 1, reading_date: "2024-01-01", grid_down_minutes: 30 }]
      mockClient.order.mockResolvedValueOnce({ data: mockReadings, error: null })

      const result = await repository.findByPlantId(1)
      
      expect(result).toEqual(mockReadings)
    })
  })

  describe("getLatestBaseline", () => {
    it("returns latest baseline for plant", async () => {
      const mockBaseline = { baseline_grid_down_minutes: 100 }
      mockClient.single.mockResolvedValueOnce({ data: mockBaseline, error: null })

      const result = await repository.getLatestBaseline(1, "2024-01-15")
      
      expect(result).toEqual(mockBaseline)
      expect(mockClient.lt).toHaveBeenCalledWith("reading_date", "2024-01-15")
      expect(mockClient.not).toHaveBeenCalledWith("baseline_grid_down_minutes", "is", null)
    })

    it("returns null when no baseline exists", async () => {
      mockClient.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } })

      const result = await repository.getLatestBaseline(1, "2024-01-01")
      
      expect(result).toBeNull()
    })
  })

  describe("save", () => {
    it("upserts reading", async () => {
      const readingData = { plant_id: 1, reading_date: "2024-01-01", grid_down_minutes: 30, grid_down_count: 2 }
      mockClient.single.mockResolvedValueOnce({ data: { id: 1, ...readingData }, error: null })

      const result = await repository.save(readingData)
      
      expect(result.id).toBe(1)
    })
  })

  describe("saveAll", () => {
    it("batch upserts readings with large batch size", async () => {
      const readingsData = [
        { plant_id: 1, reading_date: "2024-01-01", grid_down_minutes: 30, grid_down_count: 2 },
        { plant_id: 1, reading_date: "2024-01-02", grid_down_minutes: 15, grid_down_count: 1 },
      ]
      mockClient.select.mockResolvedValueOnce({ data: readingsData.map((r, i) => ({ id: i + 1, ...r })), error: null })

      const result = await repository.saveAll(readingsData)
      
      expect(result.length).toBe(2)
    })
  })
})

