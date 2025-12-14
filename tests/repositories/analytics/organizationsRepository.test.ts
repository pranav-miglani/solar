/**
 * Analytics Organizations Repository Tests
 * 
 * Phase 5 - Unit Tests
 * 
 * Tests for AnalyticsOrganizationsRepository implementation.
 * Uses mock Supabase client to verify query building.
 */

import { 
  AnalyticsOrganizationsRepository, 
  AnalyticsOrganization, 
  SaveAnalyticsOrganizationData 
} from "@/lib/repositories/analytics/organizationsRepository"

// =============================================================================
// Mock Setup
// =============================================================================

const createMockClient = () => {
  const mockData: AnalyticsOrganization[] = [
    {
      id: 1,
      name: "Alpha Organization",
      config: { settings: true },
      config_hash: "hash123",
      config_ready: true,
      config_last_run_at: "2024-01-01T00:00:00Z",
      config_last_status: "success",
      config_last_error: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: 2,
      name: "Beta Organization",
      config: { settings: false },
      config_hash: "hash456",
      config_ready: false,
      config_last_run_at: null,
      config_last_status: null,
      config_last_error: null,
      created_at: "2024-01-02T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
    },
  ]

  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockData[0], error: null }),
          maybeSingle: jest.fn().mockResolvedValue({ data: { config_hash: "hash123" }, error: null }),
        }),
        maybeSingle: jest.fn().mockResolvedValue({ data: { config_hash: "hash123" }, error: null }),
      }),
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockData[0], error: null }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    }),
    mockData,
  }
}

// =============================================================================
// Tests
// =============================================================================

describe("AnalyticsOrganizationsRepository", () => {
  let repository: AnalyticsOrganizationsRepository
  let mockClient: ReturnType<typeof createMockClient>

  beforeEach(() => {
    mockClient = createMockClient()
    repository = new AnalyticsOrganizationsRepository(mockClient as any)
  })

  describe("findAll", () => {
    it("returns organizations ordered by name", async () => {
      const orgs = await repository.findAll()
      
      expect(mockClient.from).toHaveBeenCalledWith("organizations")
      expect(orgs).toHaveLength(2)
      expect(orgs[0].name).toBe("Alpha Organization")
    })

    it("returns empty array when no organizations", async () => {
      mockClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      })

      const orgs = await repository.findAll()
      expect(orgs).toHaveLength(0)
    })
  })

  describe("findById", () => {
    it("returns organization when found", async () => {
      const org = await repository.findById(1)
      
      expect(org).not.toBeNull()
      expect(org?.id).toBe(1)
      expect(org?.config_hash).toBe("hash123")
    })

    it("returns null when not found (PGRST116)", async () => {
      mockClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: { code: "PGRST116" } 
            }),
          }),
        }),
      })

      const org = await repository.findById(999)
      expect(org).toBeNull()
    })
  })

  describe("findConfigHash", () => {
    it("returns config hash when organization exists", async () => {
      const hash = await repository.findConfigHash(1)
      
      expect(hash).toBe("hash123")
    })

    it("returns null when organization not found", async () => {
      mockClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      })

      const hash = await repository.findConfigHash(999)
      expect(hash).toBeNull()
    })

    it("returns null when config_hash is null", async () => {
      mockClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ 
              data: { config_hash: null }, 
              error: null 
            }),
          }),
        }),
      })

      const hash = await repository.findConfigHash(2)
      expect(hash).toBeNull()
    })
  })

  describe("save", () => {
    it("upserts organization with config data", async () => {
      const saveData: SaveAnalyticsOrganizationData = {
        id: 1,
        name: "Updated Org",
        config: { newSettings: true },
        config_hash: "newhash",
        config_ready: true,
        config_last_run_at: "2024-01-01T00:00:00Z",
        config_last_status: "success",
        config_last_error: null,
      }

      const org = await repository.save(saveData)
      
      expect(mockClient.from).toHaveBeenCalledWith("organizations")
      expect(org).not.toBeNull()
      expect(org.id).toBe(1)
    })

    it("creates new organization if not exists", async () => {
      const saveData: SaveAnalyticsOrganizationData = {
        id: 999,
        name: "New Org",
        config: { isNew: true },
        config_hash: "hash999",
        config_ready: true,
        config_last_run_at: "2024-01-01T00:00:00Z",
        config_last_status: "success",
        config_last_error: null,
      }

      const org = await repository.save(saveData)
      expect(org).not.toBeNull()
    })

    it("throws error on database failure", async () => {
      mockClient.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: new Error("Upsert failed") 
            }),
          }),
        }),
      })

      await expect(repository.save({
        id: 1,
        name: "Test",
        config: {},
        config_hash: "hash",
        config_ready: true,
        config_last_run_at: "2024-01-01T00:00:00Z",
        config_last_status: "success",
        config_last_error: null,
      })).rejects.toThrow("Upsert failed")
    })
  })

  describe("updateStatusNoChange", () => {
    it("updates status fields when no config change", async () => {
      const now = new Date().toISOString()
      
      await repository.updateStatusNoChange(1, now)
      
      expect(mockClient.from).toHaveBeenCalledWith("organizations")
    })

    it("throws error on database failure", async () => {
      mockClient.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ 
            error: new Error("Update failed") 
          }),
        }),
      })

      await expect(repository.updateStatusNoChange(1, new Date().toISOString()))
        .rejects.toThrow("Update failed")
    })
  })
})

