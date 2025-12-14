/**
 * Legacy Analytics Vendors Adapter - Analytics DB
 * 
 * Phase 7 - Feature Toggle Support
 * 
 * This adapter implements the same interface as AnalyticsVendorsRepository
 * but uses direct Supabase calls (legacy pattern).
 * 
 * Used when USE_ANALYTICS_VENDORS_REPO=false for instant rollback.
 */

import { SupabaseClient } from "@supabase/supabase-js"
import type { 
  AnalyticsVendor, 
  AnalyticsVendorWithOrganization, 
  SaveAnalyticsVendorData, 
  IAnalyticsVendorsRepository 
} from "../vendorsRepository"

/**
 * Legacy Analytics Vendors Adapter Implementation
 */
export class LegacyAnalyticsVendorsAdapter implements IAnalyticsVendorsRepository {
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
          analytics_ready: entity.analytics_ready ?? true,
          analytics_last_synced_at: entity.analytics_last_synced_at || new Date().toISOString(),
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

