/**
 * Legacy Accounts Adapter - Main DB
 * 
 * Phase 3 - Feature Toggle Support
 * 
 * This adapter implements the same interface as AccountsRepository
 * but uses direct Supabase calls (legacy pattern).
 * 
 * Used when USE_ACCOUNTS_REPO=false for instant rollback.
 */

import { SupabaseClient } from "@supabase/supabase-js"
import type { Account, SaveAccountData, IAccountsRepository } from "../accountsRepository"

/**
 * Legacy Accounts Adapter Implementation
 * Uses direct Supabase queries (same as pre-repository pattern)
 */
export class LegacyAccountsAdapter implements IAccountsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAll(): Promise<Account[]> {
    const { data, error } = await this.client
      .from("accounts")
      .select("*")
      .order("email")

    if (error) throw error
    return (data || []) as Account[]
  }

  async findByEmail(email: string): Promise<Account | null> {
    const { data, error } = await this.client
      .from("accounts")
      .select("id")
      .eq("email", email)
      .single()

    if (error) {
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
      .eq("account_type", "ORG")
      .single()

    if (error) {
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
      .select("*")
      .single()

    if (error) throw error
    return data as Account
  }

  async testConnection(): Promise<{ success: boolean; count: number }> {
    const { count, error } = await this.client
      .from("accounts")
      .select("*", { count: "exact", head: true })

    if (error) throw error
    return { success: true, count: count || 0 }
  }
}

