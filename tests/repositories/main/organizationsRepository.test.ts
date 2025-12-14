/**
 * Organizations Repository Tests - Main DB
 * 
 * Phase 4 - Unit Tests
 * 
 * Tests for OrganizationsRepository implementation.
 * Uses mock Supabase client to verify query building.
 */

import { OrganizationsRepository, Organization, SaveOrganizationData } from "@/lib/repositories/main/organizationsRepository"

// =============================================================================
// Mock Setup
// =============================================================================

const createMockClient = () => {
  const mockData: Organization[] = [
    {
      id: 1,
      name: "Alpha Organization",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: 2,
      name: "Beta Organization",
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
        }),
      }),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockData[0], error: null }),
        }),
      }),
    }),
    mockData,
  }
}

// =============================================================================
// Tests
// =============================================================================

describe("OrganizationsRepository", () => {
  let repository: OrganizationsRepository
  let mockClient: ReturnType<typeof createMockClient>

  beforeEach(() => {
    mockClient = createMockClient()
    repository = new OrganizationsRepository(mockClient as any)
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

    it("throws error on database failure", async () => {
      mockClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: null, error: new Error("DB Error") }),
        }),
      })

      await expect(repository.findAll()).rejects.toThrow("DB Error")
    })
  })

  describe("findById", () => {
    it("returns organization when found", async () => {
      const org = await repository.findById(1)
      
      expect(mockClient.from).toHaveBeenCalledWith("organizations")
      expect(org).not.toBeNull()
      expect(org?.id).toBe(1)
      expect(org?.name).toBe("Alpha Organization")
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

    it("throws error on other database errors", async () => {
      mockClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: { code: "XXXX", message: "Unknown error" } 
            }),
          }),
        }),
      })

      await expect(repository.findById(1)).rejects.toEqual({ 
        code: "XXXX", 
        message: "Unknown error" 
      })
    })
  })

  describe("save", () => {
    it("creates organization with provided name", async () => {
      const newOrg: SaveOrganizationData = {
        name: "New Organization",
      }

      const org = await repository.save(newOrg)
      
      expect(mockClient.from).toHaveBeenCalledWith("organizations")
      expect(org).not.toBeNull()
      expect(org.name).toBe("Alpha Organization") // Returns mock data
    })

    it("throws error on duplicate name (if constraint exists)", async () => {
      mockClient.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: { code: "23505", message: "duplicate key" } 
            }),
          }),
        }),
      })

      await expect(repository.save({ name: "Existing Org" }))
        .rejects.toEqual({ code: "23505", message: "duplicate key" })
    })

    it("throws error on database failure", async () => {
      mockClient.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ 
              data: null, 
              error: new Error("Insert failed") 
            }),
          }),
        }),
      })

      await expect(repository.save({ name: "Test Org" }))
        .rejects.toThrow("Insert failed")
    })
  })
})

