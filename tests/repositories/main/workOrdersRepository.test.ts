/**
 * Work Orders Repository Tests - Phase 18
 */

import { WorkOrdersRepository } from "@/lib/repositories/main/workOrdersRepository"

describe("WorkOrdersRepository", () => {
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

  let repository: WorkOrdersRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repository = new WorkOrdersRepository(mockClient)
  })

  describe("findAllWithPlants", () => {
    it("returns work orders with plants", async () => {
      const mockWorkOrders = [{ id: 1, title: "WO1", work_order_plants: [] }]
      mockClient.order.mockResolvedValueOnce({ data: mockWorkOrders, error: null })

      const result = await repository.findAllWithPlants()
      
      expect(result).toEqual(mockWorkOrders)
    })

    it("filters by orgId when provided", async () => {
      mockClient.order.mockResolvedValueOnce({ data: [], error: null })

      await repository.findAllWithPlants({ orgId: 5 })
      
      expect(mockClient.eq).toHaveBeenCalledWith("org_id", 5)
    })
  })

  describe("findByIdWithPlants", () => {
    it("returns work order with plants", async () => {
      const mockWorkOrder = { id: 1, title: "WO1", work_order_plants: [] }
      mockClient.single.mockResolvedValueOnce({ data: mockWorkOrder, error: null })

      const result = await repository.findByIdWithPlants(1)
      
      expect(result).toEqual(mockWorkOrder)
    })

    it("returns null when not found", async () => {
      mockClient.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } })

      const result = await repository.findByIdWithPlants(999)
      
      expect(result).toBeNull()
    })
  })

  describe("save", () => {
    it("creates new work order", async () => {
      const woData = { title: "New WO", org_id: 1 }
      mockClient.single.mockResolvedValueOnce({ data: { id: 1, ...woData }, error: null })

      const result = await repository.save(woData)
      
      expect(result.id).toBe(1)
    })
  })

  describe("update", () => {
    it("updates work order", async () => {
      const updateData = { title: "Updated WO" }
      mockClient.single.mockResolvedValueOnce({ data: { id: 1, ...updateData }, error: null })

      const result = await repository.update(1, updateData)
      
      expect(result.title).toBe("Updated WO")
    })
  })

  describe("deleteById", () => {
    it("deletes work order", async () => {
      mockClient.eq.mockResolvedValueOnce({ error: null })

      await repository.deleteById(1)
      
      expect(mockClient.delete).toHaveBeenCalled()
    })
  })

  describe("validatePlantsForOrg", () => {
    it("returns error for empty plantIds", async () => {
      const result = await repository.validatePlantsForOrg([])
      
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("At least one plant is required")
    })

    it("returns valid when all plants belong to same org", async () => {
      mockClient.in.mockResolvedValueOnce({
        data: [{ id: 1, org_id: 1 }, { id: 2, org_id: 1 }],
        error: null,
      })

      const result = await repository.validatePlantsForOrg([1, 2])
      
      expect(result.isValid).toBe(true)
      expect(result.orgId).toBe(1)
    })

    it("returns error when plants belong to different orgs", async () => {
      mockClient.in.mockResolvedValueOnce({
        data: [{ id: 1, org_id: 1 }, { id: 2, org_id: 2 }],
        error: null,
      })

      const result = await repository.validatePlantsForOrg([1, 2])
      
      expect(result.isValid).toBe(false)
      expect(result.error).toBe("All plants must belong to the same organization")
    })
  })
})

