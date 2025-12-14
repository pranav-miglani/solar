/**
 * Work Order Plants Repository Tests - Phase 19
 */

import { WorkOrderPlantsRepository } from "@/lib/repositories/main/workOrderPlantsRepository"

describe("WorkOrderPlantsRepository", () => {
  const mockClient: any = {
    from: jest.fn(() => mockClient),
    select: jest.fn(() => mockClient),
    insert: jest.fn(() => mockClient),
    update: jest.fn(() => mockClient),
    eq: jest.fn(() => mockClient),
    in: jest.fn(() => mockClient),
  }

  let repository: WorkOrderPlantsRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repository = new WorkOrderPlantsRepository(mockClient)
  })

  describe("findByWorkOrderId", () => {
    it("returns plants for work order", async () => {
      const mockPlants = [{ id: 1, work_order_id: 1, plant_id: 1, is_active: true }]
      mockClient.eq.mockResolvedValueOnce({ data: mockPlants, error: null })

      const result = await repository.findByWorkOrderId(1)
      
      expect(result).toEqual(mockPlants)
    })
  })

  describe("findActiveByPlantIds", () => {
    it("returns active plants", async () => {
      mockClient.eq.mockResolvedValueOnce({ data: [], error: null })

      await repository.findActiveByPlantIds([1, 2])
      
      expect(mockClient.in).toHaveBeenCalledWith("plant_id", [1, 2])
      expect(mockClient.eq).toHaveBeenCalledWith("is_active", true)
    })

    it("returns empty array for empty input", async () => {
      const result = await repository.findActiveByPlantIds([])
      
      expect(result).toEqual([])
    })
  })

  describe("deactivateByPlantIds", () => {
    it("deactivates plants", async () => {
      mockClient.eq.mockResolvedValueOnce({ error: null })

      await repository.deactivateByPlantIds([1, 2])
      
      expect(mockClient.update).toHaveBeenCalledWith({ is_active: false })
    })

    it("does nothing for empty input", async () => {
      await repository.deactivateByPlantIds([])
      
      expect(mockClient.update).not.toHaveBeenCalled()
    })
  })

  describe("activateByWorkOrderAndPlantIds", () => {
    it("activates plants", async () => {
      mockClient.in.mockResolvedValueOnce({ error: null })

      await repository.activateByWorkOrderAndPlantIds(1, [1, 2])
      
      expect(mockClient.update).toHaveBeenCalledWith({ is_active: true })
    })
  })

  describe("saveAll", () => {
    it("batch inserts plants", async () => {
      const plantsData = [
        { work_order_id: 1, plant_id: 1 },
        { work_order_id: 1, plant_id: 2 },
      ]
      mockClient.select.mockResolvedValueOnce({ data: plantsData.map((p, i) => ({ id: i + 1, ...p, is_active: true })), error: null })

      const result = await repository.saveAll(plantsData)
      
      expect(result.length).toBe(2)
    })
  })
})

