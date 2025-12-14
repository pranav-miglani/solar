/**
 * Accounts Repository - Main DB
 * 
 * Phase 3 Implementation
 * 
 * Handles all database operations for the `accounts` table.
 * Uses JPA-style naming conventions.
 */

import { SupabaseClient } from "@supabase/supabase-js"

// =============================================================================
// Types
// =============================================================================

/**
 * Account entity returned from database
 */
export interface Account {
  id: string
  email: string
  password_hash: string
  account_type: "SUPERADMIN" | "ORG" | "GOVT" | "DEVELOPER"
  org_id: number | null
  display_name: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Data required to save (create) an account
 */
export interface SaveAccountData {
  email: string
  password_hash: string
  account_type: "SUPERADMIN" | "ORG" | "GOVT" | "DEVELOPER"
  org_id?: number | null
  display_name?: string | null
}

// =============================================================================
// Interface
// =============================================================================

/**
 * Accounts Repository Interface (JPA-style)
 */
export interface IAccountsRepository {
  /**
   * Find all accounts, ordered by email
   */
  findAll(): Promise<Account[]>

  /**
   * Find account by email (for duplicate check)
   */
  findByEmail(email: string): Promise<Account | null>

  /**
   * Find active account by email for login
   * Only returns accounts where is_active = true
   */
  findByEmailForLogin(email: string): Promise<Account | null>

  /**
   * Check if an account exists for a given org_id
   */
  existsByOrgId(orgId: number): Promise<boolean>

  /**
   * Save (insert) a new account
   * JPA-style: save() instead of create()
   */
  save(entity: SaveAccountData): Promise<Account>

  /**
   * Test database connection by counting accounts
   * Used for health checks during login
   */
  testConnection(): Promise<{ success: boolean; count: number }>
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Accounts Repository Implementation
 */
export class AccountsRepository implements IAccountsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAll(): Promise<Account[]> {
    const { data, error } = await this.client
      .from("accounts")
      .select("*")
      .order("email", { ascending: true })

    if (error) throw error
    return (data || []) as Account[]
  }

  async findByEmail(email: string): Promise<Account | null> {
    const { data, error } = await this.client
      .from("accounts")
      .select("*")
      .eq("email", email)
      .single()

    if (error) {
      // PGRST116 = no rows returned, which is valid (account not found)
      if (error.code === "PGRST116") {
        return null
      }
      throw error
    }
    return data as Account
  }

  async findByEmailForLogin(email: string): Promise<Account | null> {
    const { data, error } = await this.client
      .from("accounts")
      .select("*")
      .eq("email", email)
      .eq("is_active", true)
      .limit(1)

    if (error) throw error
    
    if (!data || data.length === 0) {
      return null
    }
    return data[0] as Account
  }

  async existsByOrgId(orgId: number): Promise<boolean> {
    const { data, error } = await this.client
      .from("accounts")
      .select("id")
      .eq("org_id", orgId)
      .single()

    if (error) {
      // PGRST116 = no rows returned, which means org doesn't have account
      if (error.code === "PGRST116") {
        return false
      }
      throw error
    }
    return !!data
  }

  async save(entity: SaveAccountData): Promise<Account> {
    const { data, error } = await this.client
      .from("accounts")
      .insert({
        email: entity.email,
        password_hash: entity.password_hash,
        account_type: entity.account_type,
        org_id: entity.org_id ?? null,
        display_name: entity.display_name ?? null,
      })
      .select()
      .single()

    if (error) throw error
    return data as Account
  }

  async testConnection(): Promise<{ success: boolean; count: number }> {
    const { count, error } = await this.client
      .from("accounts")
      .select("*", { count: "exact", head: true })

    if (error) {
      throw error
    }
    return { success: true, count: count || 0 }
  }
}

