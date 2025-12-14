/**
 * Insolation Readings Repository Tests - Phase 14
 */

import { InsolationReadingsRepository } from "@/lib/repositories/main/insolationReadingsRepository"

describe("InsolationReadingsRepository", () => {
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

  let repository: InsolationReadingsRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repository = new InsolationReadingsRepository(mockClient)
  })

  describe("findByDeviceId", () => {
    it("returns readings for device", async () => {
      const mockReadings = [
        { id: 1, wms_device_id: 1, reading_date: "2024-01-01", insolation_kwh_m2: 5.5 },
      ]
      mockClient.order.mockResolvedValueOnce({ data: mockReadings, error: null })

      const result = await repository.findByDeviceId(1)
      
      expect(result).toEqual(mockReadings)
      expect(mockClient.eq).toHaveBeenCalledWith("wms_device_id", 1)
    })

    it("applies date filters when provided", async () => {
      mockClient.limit.mockResolvedValueOnce({ data: [], error: null })

      await repository.findByDeviceId(1, { startDate: "2024-01-01", endDate: "2024-01-31", limit: 10 })
      
      expect(mockClient.gte).toHaveBeenCalledWith("reading_date", "2024-01-01")
      expect(mockClient.lte).toHaveBeenCalledWith("reading_date", "2024-01-31")
      expect(mockClient.limit).toHaveBeenCalledWith(10)
    })
  })

  describe("findByDeviceAndDate", () => {
    it("returns reading for specific device and date", async () => {
      const mockReading = { id: 1, wms_device_id: 1, reading_date: "2024-01-01" }
      mockClient.single.mockResolvedValueOnce({ data: mockReading, error: null })

      const result = await repository.findByDeviceAndDate(1, "2024-01-01")
      
      expect(result).toEqual(mockReading)
      expect(mockClient.eq).toHaveBeenCalledWith("wms_device_id", 1)
      expect(mockClient.eq).toHaveBeenCalledWith("reading_date", "2024-01-01")
    })

    it("returns null when not found", async () => {
      mockClient.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } })

      const result = await repository.findByDeviceAndDate(1, "2024-01-01")
      
      expect(result).toBeNull()
    })
  })

  describe("save", () => {
    it("upserts reading", async () => {
      const readingData = { wms_device_id: 1, reading_date: "2024-01-01", insolation_kwh_m2: 5.5 }
      const savedReading = { id: 1, ...readingData }
      mockClient.single.mockResolvedValueOnce({ data: savedReading, error: null })

      const result = await repository.save(readingData)
      
      expect(result.id).toBe(1)
      expect(mockClient.upsert).toHaveBeenCalled()
    })
  })

  describe("saveAll", () => {
    it("batch upserts readings", async () => {
      const readingsData = [
        { wms_device_id: 1, reading_date: "2024-01-01", insolation_kwh_m2: 5.5 },
        { wms_device_id: 1, reading_date: "2024-01-02", insolation_kwh_m2: 6.0 },
      ]
      mockClient.select.mockResolvedValueOnce({ data: readingsData.map((r, i) => ({ id: i + 1, ...r })), error: null })

      const result = await repository.saveAll(readingsData)
      
      expect(result.length).toBe(2)
    })

    it("returns empty array for empty input", async () => {
      const result = await repository.saveAll([])
      
      expect(result).toEqual([])
    })
  })
})

