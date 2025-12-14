/**
 * Analytics Vendors Repository Tests
 * 
 * Phase 7 - Unit Tests
 * 
 * Tests for AnalyticsVendorsRepository implementation.
 */

import { 
  AnalyticsVendorsRepository, 
  AnalyticsVendor, 
  AnalyticsVendorWithOrganization,
  SaveAnalyticsVendorData 
} from "@/lib/repositories/analytics/vendorsRepository"

// =============================================================================
// Mock Setup
// =============================================================================

const createMockClient = () => {
  const mockVendor: AnalyticsVendor = {
    id: 1,
    name: "Test Vendor",
    org_id: 1,
    config: { settings: true },
    config_hash: "hash123",
    analytics_ready: true,
    analytics_last_synced_at: "2024-01-01T00:00:00Z",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  }

  const mockVendorWithOrg: AnalyticsVendorWithOrganization = {
    ...mockVendor,
    organizations: { id: 1, name: "Test Org" },
  }

  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: [mockVendorWithOrg], error: null }),
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockVendor, error: null }),
          order: jest.fn().mockResolvedValue({ data: [mockVendorWithOrg], error: null }),
          maybeSingle: jest.fn().mockResolvedValue({ data: { config_hash: "hash123" }, error: null }),
        }),
        maybeSingle: jest.fn().mockResolvedValue({ data: { config_hash: "hash123" }, error: null }),
      }),
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockVendor, error: null }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    }),
    mockVendor,
    mockVendorWithOrg,
  }
}

// =============================================================================
// Tests
// =============================================================================

describe("AnalyticsVendorsRepository", () => {
  let repository: AnalyticsVendorsRepository
  let mockClient: ReturnType<typeof createMockClient>

  beforeEach(() => {
    mockClient = createMockClient()
    repository = new AnalyticsVendorsRepository(mockClient as any)
  })

  describe("findAllWithOrganizations", () => {
    it("returns vendors with organization join", async () => {
      const vendors = await repository.findAllWithOrganizations()
      
      expect(mockClient.from).toHaveBeenCalledWith("vendors")
      expect(vendors).toHaveLength(1)
      expect(vendors[0].organizations?.name).toBe("Test Org")
    })
  })

  describe("findByOrgIdWithOrganization", () => {
    it("returns vendors filtered by org ID", async () => {
      const vendors = await repository.findByOrgIdWithOrganization(1)
      
      expect(vendors).toHaveLength(1)
    })
  })

  describe("findConfigHash", () => {
    it("returns config hash when vendor exists", async () => {
      const hash = await repository.findConfigHash(1)
      
      expect(hash).toBe("hash123")
    })

    it("returns null when vendor not found", async () => {
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
  })

  describe("save", () => {
    it("upserts vendor with config", async () => {
      const saveData: SaveAnalyticsVendorData = {
        id: 1,
        name: "Updated Vendor",
        org_id: 1,
        config: { newSettings: true },
        config_hash: "newhash",
        analytics_ready: true,
        analytics_last_synced_at: "2024-01-01T00:00:00Z",
      }

      const vendor = await repository.save(saveData)
      
      expect(vendor).not.toBeNull()
    })
  })

  describe("updateStatusNoChange", () => {
    it("updates status fields", async () => {
      await expect(repository.updateStatusNoChange(1, new Date().toISOString()))
        .resolves.not.toThrow()
    })
  })
})

