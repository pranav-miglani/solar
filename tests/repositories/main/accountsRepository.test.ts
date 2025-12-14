/**
 * Accounts Repository Tests
 * 
 * Phase 3 - Unit Tests
 * 
 * Tests for AccountsRepository implementation.
 * Uses mock Supabase client to verify query building.
 */

import { AccountsRepository, Account, SaveAccountData } from "@/lib/repositories/main/accountsRepository"

// =============================================================================
// Mock Setup
// =============================================================================

// Mock Supabase client
const createMockClient = () => {
  const mockData: Account[] = [
    {
      id: "1",
      email: "admin@test.com",
      password_hash: "hashed",
      account_type: "SUPERADMIN",
      org_id: null,
      display_name: "Admin",
      is_active: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "2",
      email: "org@test.com",
      password_hash: "hashed",
      account_type: "ORG",
      org_id: 1,
      display_name: "Org User",
      is_active: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
  ]

  return {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: mockData, error: null }),
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockData[0], error: null }),
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockData[0], error: null }),
            limit: jest.fn().mockResolvedValue({ data: [mockData[0]], error: null }),
          }),
          limit: jest.fn().mockResolvedValue({ data: [mockData[0]], error: null }),
        }),
        single: jest.fn().mockResolvedValue({ data: mockData[0], error: null }),
      }),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockData[0], error: null }),
        }),
      }),
    }),
  }
}

// =============================================================================
// Tests
// =============================================================================

describe("AccountsRepository", () => {
  let repository: AccountsRepository
  let mockClient: ReturnType<typeof createMockClient>

  beforeEach(() => {
    mockClient = createMockClient()
    repository = new AccountsRepository(mockClient as any)
  })

  describe("findAll", () => {
    it("returns accounts ordered by email", async () => {
      const accounts = await repository.findAll()
      
      expect(mockClient.from).toHaveBeenCalledWith("accounts")
      expect(accounts).toHaveLength(2)
      expect(accounts[0].email).toBe("admin@test.com")
    })

    it("returns empty array when no accounts", async () => {
      mockClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      })

      const accounts = await repository.findAll()
      expect(accounts).toHaveLength(0)
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

  describe("findByEmail", () => {
    it("returns account when found", async () => {
      const account = await repository.findByEmail("admin@test.com")
      
      expect(account).not.toBeNull()
      expect(account?.email).toBe("admin@test.com")
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

      const account = await repository.findByEmail("notfound@test.com")
      expect(account).toBeNull()
    })
  })

  describe("findByEmailForLogin", () => {
    it("only returns active accounts", async () => {
      const account = await repository.findByEmailForLogin("admin@test.com")
      
      expect(account).not.toBeNull()
      expect(account?.is_active).toBe(true)
    })

    it("returns null when account is inactive", async () => {
      mockClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      })

      const account = await repository.findByEmailForLogin("inactive@test.com")
      expect(account).toBeNull()
    })
  })

  describe("existsByOrgId", () => {
    it("returns true when org has account", async () => {
      const exists = await repository.existsByOrgId(1)
      expect(exists).toBe(true)
    })

    it("returns false when org has no account (PGRST116)", async () => {
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

      const exists = await repository.existsByOrgId(999)
      expect(exists).toBe(false)
    })
  })

  describe("save", () => {
    it("creates new account with hashed password", async () => {
      const newAccount: SaveAccountData = {
        email: "new@test.com",
        password_hash: "hashedpassword",
        account_type: "ORG",
        org_id: 1,
        display_name: "New User",
      }

      const account = await repository.save(newAccount)
      
      expect(mockClient.from).toHaveBeenCalledWith("accounts")
      expect(account).not.toBeNull()
    })

    it("throws error on duplicate email", async () => {
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

      await expect(repository.save({
        email: "existing@test.com",
        password_hash: "hash",
        account_type: "ORG",
      })).rejects.toEqual({ code: "23505", message: "duplicate key" })
    })
  })

  describe("testConnection", () => {
    it("returns success with count", async () => {
      mockClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ count: 5, error: null }),
      })

      const result = await repository.testConnection()
      
      expect(result.success).toBe(true)
      expect(result.count).toBe(5)
    })

    it("throws error on connection failure", async () => {
      mockClient.from = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ 
          count: null, 
          error: new Error("Connection failed") 
        }),
      })

      await expect(repository.testConnection()).rejects.toThrow("Connection failed")
    })
  })
})

