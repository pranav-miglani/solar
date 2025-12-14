/**
 * Plants Repository Tests - Phase 9
 */

import { PlantsRepository } from "@/lib/repositories/main/plantsRepository"

describe("PlantsRepository", () => {
  const mockClient: any = {
    from: jest.fn(() => mockClient),
    select: jest.fn(() => mockClient),
    insert: jest.fn(() => mockClient),
    update: jest.fn(() => mockClient),
    delete: jest.fn(() => mockClient),
    eq: jest.fn(() => mockClient),
    in: jest.fn(() => mockClient),
    order: jest.fn(() => mockClient),
    single: jest.fn(),
  }

  let repository: PlantsRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repository = new PlantsRepository(mockClient)
  })

  describe("findAllWithRelations", () => {
    it("returns plants with vendor and org relations", async () => {
      const mockPlants = [
        { id: 1, name: "Plant A", vendors: { id: 1, name: "Vendor A" }, organizations: { id: 1, name: "Org A" } },
      ]
      mockClient.order.mockResolvedValueOnce({ data: mockPlants, error: null })

      const result = await repository.findAllWithRelations()
      
      expect(result).toEqual(mockPlants)
      expect(mockClient.from).toHaveBeenCalledWith("plants")
      expect(mockClient.select).toHaveBeenCalled()
    })
  })

  describe("findByIdWithRelations", () => {
    it("returns plant with relations when found", async () => {
      const mockPlant = { id: 1, name: "Plant A", vendors: { id: 1 }, organizations: { id: 1 } }
      mockClient.single.mockResolvedValueOnce({ data: mockPlant, error: null })

      const result = await repository.findByIdWithRelations(1)
      
      expect(result).toEqual(mockPlant)
      expect(mockClient.eq).toHaveBeenCalledWith("id", 1)
    })

    it("returns null when plant not found", async () => {
      mockClient.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } })

      const result = await repository.findByIdWithRelations(999)
      
      expect(result).toBeNull()
    })
  })

  describe("save", () => {
    it("creates new plant", async () => {
      const newPlant = { name: "New Plant", vendor_id: 1, org_id: 1, vendor_plant_id: "VP1", capacity_kw: 100 }
      const savedPlant = { id: 1, ...newPlant }
      mockClient.single.mockResolvedValueOnce({ data: savedPlant, error: null })

      const result = await repository.save(newPlant)
      
      expect(result.id).toBe(1)
      expect(mockClient.insert).toHaveBeenCalled()
    })
  })

  describe("update", () => {
    it("updates plant fields", async () => {
      const updateData = { name: "Updated Name", capacity_kw: 200 }
      const updatedPlant = { id: 1, name: "Updated Name", capacity_kw: 200 }
      mockClient.single.mockResolvedValueOnce({ data: updatedPlant, error: null })

      const result = await repository.update(1, updateData)
      
      expect(result.name).toBe("Updated Name")
      expect(mockClient.update).toHaveBeenCalled()
      expect(mockClient.eq).toHaveBeenCalledWith("id", 1)
    })
  })

  describe("deleteById", () => {
    it("deletes plant by id", async () => {
      mockClient.eq.mockResolvedValueOnce({ error: null })

      await repository.deleteById(1)
      
      expect(mockClient.delete).toHaveBeenCalled()
      expect(mockClient.eq).toHaveBeenCalledWith("id", 1)
    })
  })

  describe("getPlantIdsByOrgId", () => {
    it("returns plant IDs for org", async () => {
      mockClient.eq.mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }], error: null })

      const result = await repository.getPlantIdsByOrgId(1)
      
      expect(result).toEqual([1, 2])
    })
  })
})

