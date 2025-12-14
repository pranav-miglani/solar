/**
 * Analytics Vendors Repository - Analytics DB
 * 
 * Phase 7 Implementation
 * 
 * Handles all database operations for the `vendors` table in Analytics DB.
 * Analytics vendors have different schema: config_hash, analytics_ready, etc.
 * Uses JPA-style naming conventions.
 */

import { SupabaseClient } from "@supabase/supabase-js"

// =============================================================================
// Types
// =============================================================================

/**
 * Organization reference (for joins)
 */
export interface AnalyticsOrganizationRef {
  id: number
  name: string
}

/**
 * Analytics Vendor entity returned from database
 */
export interface AnalyticsVendor {
  id: number
  name: string
  org_id: number
  config: Record<string, unknown> | null
  config_hash: string | null
  analytics_ready: boolean
  analytics_last_synced_at: string | null
  created_at: string
  updated_at: string
}

/**
 * Analytics Vendor with organization join
 */
export interface AnalyticsVendorWithOrganization extends AnalyticsVendor {
  organizations: AnalyticsOrganizationRef | null
}

/**
 * Data required to save an analytics vendor (for mirroring)
 */
export interface SaveAnalyticsVendorData {
  id: number
  name: string
  org_id: number
  config: Record<string, unknown>
  config_hash: string
  analytics_ready: boolean
  analytics_last_synced_at: string
}

// =============================================================================
// Interface
// =============================================================================

/**
 * Analytics Vendors Repository Interface (JPA-style)
 */
export interface IAnalyticsVendorsRepository {
  /**
   * Find all vendors with organization join, ordered by name
   */
  findAllWithOrganizations(): Promise<AnalyticsVendorWithOrganization[]>

  /**
   * Find vendors by organization ID with organization join
   */
  findByOrgIdWithOrganization(orgId: number): Promise<AnalyticsVendorWithOrganization[]>

  /**
   * Find vendor by ID
   */
  findById(id: number): Promise<AnalyticsVendor | null>

  /**
   * Get config hash for a vendor (for change detection)
   */
  findConfigHash(id: number): Promise<string | null>

  /**
   * Save (upsert) a vendor with config
   */
  save(entity: SaveAnalyticsVendorData): Promise<AnalyticsVendor>

  /**
   * Update status when no config change detected
   */
  updateStatusNoChange(id: number, now: string): Promise<void>
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Analytics Vendors Repository Implementation
 */
export class AnalyticsVendorsRepository implements IAnalyticsVendorsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAllWithOrganizations(): Promise<AnalyticsVendorWithOrganization[]> {
    const { data, error } = await this.client
      .from("vendors")
      .select(`
        *,
        organizations (
          id,
          name
        )
      `)
      .order("name", { ascending: true })

    if (error) throw error
    return (data || []) as AnalyticsVendorWithOrganization[]
  }

  async findByOrgIdWithOrganization(orgId: number): Promise<AnalyticsVendorWithOrganization[]> {
    const { data, error } = await this.client
      .from("vendors")
      .select(`
        *,
        organizations (
          id,
          name
        )
      `)
      .eq("org_id", orgId)
      .order("name", { ascending: true })

    if (error) throw error
    return (data || []) as AnalyticsVendorWithOrganization[]
  }

  async findById(id: number): Promise<AnalyticsVendor | null> {
    const { data, error } = await this.client
      .from("vendors")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return null
      }
      throw error
    }
    return data as AnalyticsVendor
  }

  async findConfigHash(id: number): Promise<string | null> {
    const { data, error } = await this.client
      .from("vendors")
      .select("config_hash")
      .eq("id", id)
      .maybeSingle()

    if (error) throw error
    return data?.config_hash ?? null
  }

  async save(entity: SaveAnalyticsVendorData): Promise<AnalyticsVendor> {
    const { data, error } = await this.client
      .from("vendors")
      .upsert(
        {
          id: entity.id,
          name: entity.name,
          org_id: entity.org_id,
          config: entity.config,
          config_hash: entity.config_hash,
          analytics_ready: entity.analytics_ready,
          analytics_last_synced_at: entity.analytics_last_synced_at,
        },
        { onConflict: "id" }
      )
      .select()
      .single()

    if (error) throw error
    return data as AnalyticsVendor
  }

  async updateStatusNoChange(id: number, now: string): Promise<void> {
    const { error } = await this.client
      .from("vendors")
      .update({
        analytics_ready: true,
        analytics_last_synced_at: now,
      })
      .eq("id", id)

    if (error) throw error
  }
}

