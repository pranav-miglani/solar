/**
 * Analytics Plants Repository Tests - Phase 10
 */

import { AnalyticsPlantsRepository } from "@/lib/repositories/analytics/plantsRepository"

describe("AnalyticsPlantsRepository", () => {
  const mockClient: any = {
    from: jest.fn(() => mockClient),
    select: jest.fn(() => mockClient),
    upsert: jest.fn(() => mockClient),
    eq: jest.fn(() => mockClient),
    order: jest.fn(() => mockClient),
    single: jest.fn(),
  }

  let repository: AnalyticsPlantsRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repository = new AnalyticsPlantsRepository(mockClient)
  })

  describe("findAllWithRelations", () => {
    it("returns plants with org and vendor relations", async () => {
      const mockPlants = [
        { id: 1, plant_name: "Plant A", organizations: { id: 1, name: "Org" }, vendors: { id: 1, name: "Vendor" } },
      ]
      mockClient.order.mockResolvedValueOnce({ data: mockPlants, error: null })

      const result = await repository.findAllWithRelations()
      
      expect(result).toEqual(mockPlants)
    })
  })

  describe("findByOrgIdWithRelations", () => {
    it("filters by org ID", async () => {
      mockClient.order.mockResolvedValueOnce({ data: [], error: null })

      await repository.findByOrgIdWithRelations(5)
      
      expect(mockClient.eq).toHaveBeenCalledWith("org_id", 5)
    })
  })

  describe("findByVendorIdWithRelations", () => {
    it("filters by vendor ID", async () => {
      mockClient.order.mockResolvedValueOnce({ data: [], error: null })

      await repository.findByVendorIdWithRelations(3)
      
      expect(mockClient.eq).toHaveBeenCalledWith("vendor_id", 3)
    })
  })

  describe("findById", () => {
    it("returns plant when found", async () => {
      const mockPlant = { id: 1, plant_name: "Plant A" }
      mockClient.single.mockResolvedValueOnce({ data: mockPlant, error: null })

      const result = await repository.findById(1)
      
      expect(result).toEqual(mockPlant)
    })
  })

  describe("save", () => {
    it("upserts plant", async () => {
      const plantData = { id: 1, org_id: 1, vendor_id: 1, vendor_plant_id: "VP1", plant_name: "Plant A", capacity_kw: 100 }
      mockClient.single.mockResolvedValueOnce({ data: plantData, error: null })

      const result = await repository.save(plantData)
      
      expect(result.id).toBe(1)
    })
  })

  describe("saveAll", () => {
    it("batch upserts plants", async () => {
      const plantsData = [
        { id: 1, org_id: 1, vendor_id: 1, vendor_plant_id: "VP1", plant_name: "Plant A", capacity_kw: 100 },
        { id: 2, org_id: 1, vendor_id: 1, vendor_plant_id: "VP2", plant_name: "Plant B", capacity_kw: 200 },
      ]
      mockClient.select.mockResolvedValueOnce({ data: plantsData, error: null })

      const result = await repository.saveAll(plantsData)
      
      expect(result.length).toBe(2)
    })

    it("returns empty array for empty input", async () => {
      const result = await repository.saveAll([])
      
      expect(result).toEqual([])
    })
  })
})

