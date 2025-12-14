/**
 * WMS Vendors Repository Tests - Main DB
 * 
 * Phase 8 - Unit Tests
 * 
 * Tests for WmsVendorsRepository implementation.
 */

import { 
  WmsVendorsRepository, 
  WmsVendor, 
  WmsVendorWithOrganization, 
  SaveWmsVendorData 
} from "@/lib/repositories/main/wmsVendorsRepository"

// =============================================================================
// Mock Setup
// =============================================================================

const createMockClient = () => {
  const mockVendor: WmsVendor = {
    id: 1,
    name: "Test WMS Vendor",
    vendor_type: "INTELLO",
    credentials: { email: "test@example.com", password_hash: "hash" },
    token: null,
    token_expires_at: null,
    token_metadata: null,
    org_id: 1,
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  }

  const mockVendorWithOrg: WmsVendorWithOrganization = {
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
        }).mockResolvedValue({ error: null }),
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

describe("WmsVendorsRepository", () => {
  let repository: WmsVendorsRepository
  let mockClient: ReturnType<typeof createMockClient>

  beforeEach(() => {
    mockClient = createMockClient()
    repository = new WmsVendorsRepository(mockClient as any)
  })

  describe("findAllWithOrganizations", () => {
    it("returns WMS vendors with organization join", async () => {
      const vendors = await repository.findAllWithOrganizations()
      
      expect(mockClient.from).toHaveBeenCalledWith("wms_vendors")
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

  describe("findByIdWithOrganization", () => {
    it("returns vendor with organization when found", async () => {
      const vendor = await repository.findByIdWithOrganization(1)
      
      expect(vendor).not.toBeNull()
      expect(vendor?.vendor_type).toBe("INTELLO")
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
    it("returns only active WMS vendors", async () => {
      const vendors = await repository.findActive()
      
      expect(vendors).toHaveLength(1)
      expect(vendors[0].is_active).toBe(true)
    })
  })

  describe("save", () => {
    it("creates WMS vendor", async () => {
      const newVendor: SaveWmsVendorData = {
        name: "New WMS Vendor",
        vendor_type: "SCADA",
        credentials: { loginId: "test", password: "pass", userName: "user", userType: "admin" },
        org_id: 1,
      }

      const vendor = await repository.save(newVendor)
      
      expect(mockClient.from).toHaveBeenCalledWith("wms_vendors")
      expect(vendor).not.toBeNull()
    })
  })

  describe("update", () => {
    it("updates WMS vendor fields", async () => {
      const vendor = await repository.update(1, { name: "Updated WMS Vendor" })
      
      expect(vendor).not.toBeNull()
    })
  })

  describe("updateToken", () => {
    it("updates token for WMS vendor", async () => {
      await expect(repository.updateToken(1, {
        token: "newtoken",
        token_expires_at: "2024-12-31T00:00:00Z",
      })).resolves.not.toThrow()
    })
  })

  describe("clearToken", () => {
    it("clears token for WMS vendor", async () => {
      await expect(repository.clearToken(1)).resolves.not.toThrow()
    })
  })

  describe("deleteById", () => {
    it("deletes WMS vendor", async () => {
      await expect(repository.deleteById(1)).resolves.not.toThrow()
    })
  })
})

