/**
 * Work Logs Repository Tests - Phase 20
 */

import { WorkLogsRepository } from "@/lib/repositories/main/workLogsRepository"

describe("WorkLogsRepository", () => {
  const mockClient: any = {
    from: jest.fn(() => mockClient),
    select: jest.fn(() => mockClient),
    insert: jest.fn(() => mockClient),
    eq: jest.fn(() => mockClient),
    order: jest.fn(() => mockClient),
    single: jest.fn(),
  }

  let repository: WorkLogsRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repository = new WorkLogsRepository(mockClient)
  })

  describe("findByWorkOrderId", () => {
    it("returns logs for work order", async () => {
      const mockLogs = [{ id: 1, work_order_id: 1, log_text: "Test" }]
      mockClient.order.mockResolvedValueOnce({ data: mockLogs, error: null })

      const result = await repository.findByWorkOrderId(1)
      
      expect(result).toEqual(mockLogs)
      expect(mockClient.order).toHaveBeenCalledWith("created_at", { ascending: false })
    })
  })

  describe("findById", () => {
    it("returns log when found", async () => {
      const mockLog = { id: 1, work_order_id: 1, log_text: "Test" }
      mockClient.single.mockResolvedValueOnce({ data: mockLog, error: null })

      const result = await repository.findById(1)
      
      expect(result).toEqual(mockLog)
    })

    it("returns null when not found", async () => {
      mockClient.single.mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } })

      const result = await repository.findById(999)
      
      expect(result).toBeNull()
    })
  })

  describe("save", () => {
    it("creates new log", async () => {
      const logData = { work_order_id: 1, account_id: "acc1", log_text: "Test log" }
      mockClient.single.mockResolvedValueOnce({ data: { id: 1, ...logData, log_type: "NOTE" }, error: null })

      const result = await repository.save(logData)
      
      expect(result.id).toBe(1)
      expect(result.log_type).toBe("NOTE")
    })
  })
})

