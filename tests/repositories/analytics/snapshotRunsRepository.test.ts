/**
 * Snapshot Runs Repository Tests - Phase 17
 */

import { SnapshotRunsRepository } from "@/lib/repositories/analytics/snapshotRunsRepository"

describe("SnapshotRunsRepository", () => {
  const mockClient: any = {
    from: jest.fn(() => mockClient),
    select: jest.fn(() => mockClient),
    insert: jest.fn(() => mockClient),
    update: jest.fn(() => mockClient),
    eq: jest.fn(() => mockClient),
    in: jest.fn(() => mockClient),
    order: jest.fn(() => mockClient),
    limit: jest.fn(() => mockClient),
    single: jest.fn(),
  }

  let repository: SnapshotRunsRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repository = new SnapshotRunsRepository(mockClient)
  })

  describe("findByVendorId", () => {
    it("returns runs for vendor", async () => {
      const mockRuns = [{ id: 1, vendor_id: 1, status: "completed" }]
      mockClient.limit.mockResolvedValueOnce({ data: mockRuns, error: null })

      const result = await repository.findByVendorId(1)
      
      expect(result).toEqual(mockRuns)
      expect(mockClient.eq).toHaveBeenCalledWith("vendor_id", 1)
    })
  })

  describe("findLastRunsByVendors", () => {
    it("returns map of last runs per vendor", async () => {
      const mockRuns = [
        { id: 2, vendor_id: 1, status: "completed", created_at: "2024-01-02" },
        { id: 1, vendor_id: 1, status: "completed", created_at: "2024-01-01" },
        { id: 3, vendor_id: 2, status: "running", created_at: "2024-01-03" },
      ]
      mockClient.order.mockResolvedValueOnce({ data: mockRuns, error: null })

      const result = await repository.findLastRunsByVendors([1, 2])
      
      expect(result.size).toBe(2)
      expect(result.get(1)?.id).toBe(2) // Latest run for vendor 1
      expect(result.get(2)?.id).toBe(3) // Latest run for vendor 2
    })

    it("returns empty map for empty input", async () => {
      const result = await repository.findLastRunsByVendors([])
      
      expect(result.size).toBe(0)
    })
  })

  describe("findById", () => {
    it("returns run when found", async () => {
      const mockRun = { id: 1, vendor_id: 1, status: "completed" }
      mockClient.single.mockResolvedValueOnce({ data: mockRun, error: null })

      const result = await repository.findById(1)
      
      expect(result).toEqual(mockRun)
    })
  })

  describe("save", () => {
    it("creates new run", async () => {
      const runData = { vendor_id: 1, status: "running" as const }
      mockClient.single.mockResolvedValueOnce({ data: { id: 1, ...runData }, error: null })

      const result = await repository.save(runData)
      
      expect(result.id).toBe(1)
      expect(mockClient.insert).toHaveBeenCalled()
    })
  })

  describe("update", () => {
    it("updates run status", async () => {
      const updateData = { status: "completed" as const, completed_at: "2024-01-01T12:00:00Z" }
      mockClient.single.mockResolvedValueOnce({ data: { id: 1, vendor_id: 1, ...updateData }, error: null })

      const result = await repository.update(1, updateData)
      
      expect(result.status).toBe("completed")
      expect(mockClient.update).toHaveBeenCalled()
    })
  })
})

