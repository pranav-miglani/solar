/**
 * Legacy Analytics Organizations Adapter - Analytics DB
 * 
 * Phase 5 - Feature Toggle Support
 * 
 * This adapter implements the same interface as AnalyticsOrganizationsRepository
 * but uses direct Supabase calls (legacy pattern).
 * 
 * Used when USE_ANALYTICS_ORGS_REPO=false for instant rollback.
 */

import { SupabaseClient } from "@supabase/supabase-js"
import type { 
  AnalyticsOrganization, 
  SaveAnalyticsOrganizationData, 
  IAnalyticsOrganizationsRepository 
} from "../organizationsRepository"

/**
 * Legacy Analytics Organizations Adapter Implementation
 * Uses direct Supabase queries (same as pre-repository pattern)
 */
export class LegacyAnalyticsOrganizationsAdapter implements IAnalyticsOrganizationsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAll(): Promise<AnalyticsOrganization[]> {
    const { data, error } = await this.client
      .from("organizations")
      .select("*")
      .order("id", { ascending: true })

    if (error) throw error
    return (data || []) as AnalyticsOrganization[]
  }

  async findById(id: number): Promise<AnalyticsOrganization | null> {
    const { data, error } = await this.client
      .from("organizations")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return null
      }
      throw error
    }
    return data as AnalyticsOrganization
  }

  async findConfigHash(id: number): Promise<string | null> {
    const { data, error } = await this.client
      .from("organizations")
      .select("config_hash")
      .eq("id", id)
      .maybeSingle()

    if (error) throw error
    return data?.config_hash ?? null
  }

  async save(entity: SaveAnalyticsOrganizationData): Promise<AnalyticsOrganization> {
    const { data, error } = await this.client
      .from("organizations")
      .upsert(
        {
          id: entity.id,
          name: entity.name,
          config: entity.config,
          config_hash: entity.config_hash,
          config_ready: entity.config_ready ?? true,
          config_last_run_at: entity.config_last_run_at || new Date().toISOString(),
          config_last_status: entity.config_last_status || "success",
          config_last_error: entity.config_last_error || null,
        },
        { onConflict: "id" }
      )
      .select()
      .single()

    if (error) throw error
    return data as AnalyticsOrganization
  }

  async updateStatusNoChange(id: number, now: string): Promise<void> {
    const { error } = await this.client
      .from("organizations")
      .update({
        config_ready: true,
        config_last_run_at: now,
        config_last_status: "success",
        config_last_error: null,
      })
      .eq("id", id)

    if (error) throw error
  }
}

