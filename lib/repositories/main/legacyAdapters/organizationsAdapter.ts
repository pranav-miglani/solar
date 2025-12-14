/**
 * Legacy Organizations Adapter - Main DB
 * 
 * Phase 4 - Feature Toggle Support
 * 
 * This adapter implements the same interface as OrganizationsRepository
 * but uses direct Supabase calls (legacy pattern).
 * 
 * Used when USE_ORGS_REPO=false for instant rollback.
 */

import { SupabaseClient } from "@supabase/supabase-js"
import type { Organization, SaveOrganizationData, IOrganizationsRepository } from "../organizationsRepository"

/**
 * Legacy Organizations Adapter Implementation
 * Uses direct Supabase queries (same as pre-repository pattern)
 */
export class LegacyOrganizationsAdapter implements IOrganizationsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAll(): Promise<Organization[]> {
    const { data, error } = await this.client
      .from("organizations")
      .select("*")
      .order("name")

    if (error) throw error
    return (data || []) as Organization[]
  }

  async findById(id: number): Promise<Organization | null> {
    const { data, error } = await this.client
      .from("organizations")
      .select("id, name")
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return null
      }
      throw error
    }
    return data as Organization
  }

  async save(entity: SaveOrganizationData): Promise<Organization> {
    const { data, error } = await this.client
      .from("organizations")
      .insert({ name: entity.name })
      .select()
      .single()

    if (error) throw error
    return data as Organization
  }
}

