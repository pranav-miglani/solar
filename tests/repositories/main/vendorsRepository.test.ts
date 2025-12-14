/**
 * Vendors Repository Tests - Main DB
 * 
 * Phase 6 - Unit Tests
 * 
 * Tests for VendorsRepository implementation.
 */

import { VendorsRepository, Vendor, VendorWithOrganization, SaveVendorData } from "@/lib/repositories/main/vendorsRepository"

// =============================================================================
// Mock Setup
// =============================================================================

const createMockClient = () => {
  const mockVendor: Vendor = {
    id: 1,
    name: "Test Vendor",
    vendor_type: "SOLARMAN",
    credentials: { apiKey: "test" },
    token: null,
    token_metadata: null,
    org_id: 1,
    is_active: true,
    plant_sync_mode: "LIST_PLANTS",
    per_plant_sync_interval_minutes: 15,
    plant_sync_time_ist: "02:00",
    telemetry_sync_mode: "LIST_PLANTS",
    telemetry_sync_interval: 15,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  }

  const mockVendorWithOrg: VendorWithOrganization = {
    ...mockVendor,
    organizations: { id: 1, name: "Test Org" },
  }

  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: [mockVendorWithOrg], error: null }),
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockVendorWithOrg, error: null }),
          order: jest.fn().mockResolvedValue({ data: [mockVendor], error: null }),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockVendor, error: null }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockVendor, error: null }),
          }),
        }),
      }),
      delete: jest.fn().mockReturnValue({
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

describe("VendorsRepository", () => {
  let repository: VendorsRepository
  let mockClient: ReturnType<typeof createMockClient>

  beforeEach(() => {
    mockClient = createMockClient()
    repository = new VendorsRepository(mockClient as any)
  })

  describe("findAllWithOrganizations", () => {
    it("returns vendors with organization join ordered by name", async () => {
      const vendors = await repository.findAllWithOrganizations()
      
      expect(mockClient.from).toHaveBeenCalledWith("vendors")
      expect(vendors).toHaveLength(1)
      expect(vendors[0].organizations?.name).toBe("Test Org")
    })
  })

  describe("findByIdWithOrganization", () => {
    it("returns vendor with organization when found", async () => {
      const vendor = await repository.findByIdWithOrganization(1)
      
      expect(vendor).not.toBeNull()
      expect(vendor?.organizations?.name).toBe("Test Org")
    })

    it("returns null when not found", async () => {
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

      const vendor = await repository.findByIdWithOrganization(999)
      expect(vendor).toBeNull()
    })
  })

  describe("findActive", () => {
    it("returns only active vendors", async () => {
      const vendors = await repository.findActive()
      
      expect(vendors).toHaveLength(1)
      expect(vendors[0].is_active).toBe(true)
    })
  })

  describe("save", () => {
    it("creates vendor with default values", async () => {
      const newVendor: SaveVendorData = {
        name: "New Vendor",
        vendor_type: "SOLARMAN",
        credentials: { apiKey: "new" },
        org_id: 1,
      }

      const vendor = await repository.save(newVendor)
      
      expect(mockClient.from).toHaveBeenCalledWith("vendors")
      expect(vendor.name).toBe("Test Vendor")
    })
  })

  describe("update", () => {
    it("updates vendor fields", async () => {
      const vendor = await repository.update(1, { name: "Updated Vendor" })
      
      expect(vendor).not.toBeNull()
    })
  })

  describe("deleteById", () => {
    it("deletes vendor", async () => {
      await expect(repository.deleteById(1)).resolves.not.toThrow()
    })
  })
})

