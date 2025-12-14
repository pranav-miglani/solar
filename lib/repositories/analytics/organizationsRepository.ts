/**
 * Analytics Organizations Repository - Analytics DB
 * 
 * Phase 5 Implementation
 * 
 * Handles all database operations for the `organizations` table in Analytics DB.
 * This extends the basic organization operations with analytics-specific
 * config management (hash-based change detection, config_ready, etc.)
 * 
 * Uses JPA-style naming conventions.
 */

import { SupabaseClient } from "@supabase/supabase-js"

// =============================================================================
// Types
// =============================================================================

/**
 * Analytics Organization entity returned from database
 */
export interface AnalyticsOrganization {
  id: number
  name: string
  config: Record<string, unknown> | null
  config_hash: string | null
  config_ready: boolean
  config_last_run_at: string | null
  config_last_status: string | null
  config_last_error: string | null
  created_at: string
  updated_at: string
}

/**
 * Data required to save an analytics organization
 * Used for mirroring from Main DB
 */
export interface SaveAnalyticsOrganizationData {
  id: number
  name: string
  config: Record<string, unknown>
  config_hash: string
  config_ready: boolean
  config_last_run_at: string
  config_last_status: string
  config_last_error: string | null
}

/**
 * Data for no-change status update
 */
export interface UpdateStatusNoChangeData {
  config_ready: boolean
  config_last_run_at: string
  config_last_status: string
  config_last_error: null
}

// =============================================================================
// Interface
// =============================================================================

/**
 * Analytics Organizations Repository Interface (JPA-style)
 */
export interface IAnalyticsOrganizationsRepository {
  /**
   * Find all organizations, ordered by name
   */
  findAll(): Promise<AnalyticsOrganization[]>

  /**
   * Find organization by ID
   */
  findById(id: number): Promise<AnalyticsOrganization | null>

  /**
   * Get config hash for an organization
   * Used for change detection before mirroring
   */
  findConfigHash(id: number): Promise<string | null>

  /**
   * Save (upsert) an organization with config
   * JPA-style: save() handles both insert and update
   */
  save(entity: SaveAnalyticsOrganizationData): Promise<AnalyticsOrganization>

  /**
   * Update status when no config change detected
   * Updates config_ready, config_last_run_at, config_last_status
   */
  updateStatusNoChange(id: number, now: string): Promise<void>
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Analytics Organizations Repository Implementation
 */
export class AnalyticsOrganizationsRepository implements IAnalyticsOrganizationsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAll(): Promise<AnalyticsOrganization[]> {
    const { data, error } = await this.client
      .from("organizations")
      .select("*")
      .order("name", { ascending: true })

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
      // PGRST116 = no rows returned
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
          config_ready: entity.config_ready,
          config_last_run_at: entity.config_last_run_at,
          config_last_status: entity.config_last_status,
          config_last_error: entity.config_last_error,
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

