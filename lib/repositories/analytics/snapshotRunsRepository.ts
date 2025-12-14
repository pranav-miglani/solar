/**
 * Analytics Snapshot Runs Repository - Analytics DB
 * 
 * Phase 17 Implementation
 * 
 * Handles all database operations for the `analytics_snapshot_runs` table.
 */

import { SupabaseClient } from "@supabase/supabase-js"

// =============================================================================
// Types
// =============================================================================

export interface SnapshotRun {
  id: number
  vendor_id: number
  status: "running" | "completed" | "failed"
  error_message: string | null
  plants_processed: number
  started_at: string
  completed_at: string | null
  created_at: string
}

export interface SaveSnapshotRunData {
  vendor_id: number
  status: "running" | "completed" | "failed"
  error_message?: string | null
  plants_processed?: number
  started_at?: string
  completed_at?: string | null
}

export interface UpdateSnapshotRunData {
  status?: "running" | "completed" | "failed"
  error_message?: string | null
  plants_processed?: number
  completed_at?: string | null
}

// =============================================================================
// Interface
// =============================================================================

export interface ISnapshotRunsRepository {
  findByVendorId(vendorId: number, limit?: number): Promise<SnapshotRun[]>
  findLastRunsByVendors(vendorIds: number[]): Promise<Map<number, SnapshotRun>>
  findById(id: number): Promise<SnapshotRun | null>
  save(entity: SaveSnapshotRunData): Promise<SnapshotRun>
  update(id: number, data: UpdateSnapshotRunData): Promise<SnapshotRun>
}

// =============================================================================
// Implementation
// =============================================================================

export class SnapshotRunsRepository implements ISnapshotRunsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByVendorId(vendorId: number, limit: number = 10): Promise<SnapshotRun[]> {
    const { data, error } = await this.client
      .from("analytics_snapshot_runs")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data || []) as SnapshotRun[]
  }

  async findLastRunsByVendors(vendorIds: number[]): Promise<Map<number, SnapshotRun>> {
    if (vendorIds.length === 0) return new Map()

    const { data, error } = await this.client
      .from("analytics_snapshot_runs")
      .select("*")
      .in("vendor_id", vendorIds)
      .order("created_at", { ascending: false })

    if (error) throw error

    const result = new Map<number, SnapshotRun>()
    for (const run of (data || []) as SnapshotRun[]) {
      if (!result.has(run.vendor_id)) {
        result.set(run.vendor_id, run)
      }
    }
    return result
  }

  async findById(id: number): Promise<SnapshotRun | null> {
    const { data, error } = await this.client
      .from("analytics_snapshot_runs")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") return null
      throw error
    }
    return data as SnapshotRun
  }

  async save(entity: SaveSnapshotRunData): Promise<SnapshotRun> {
    const { data, error } = await this.client
      .from("analytics_snapshot_runs")
      .insert({
        vendor_id: entity.vendor_id,
        status: entity.status,
        error_message: entity.error_message,
        plants_processed: entity.plants_processed || 0,
        started_at: entity.started_at || new Date().toISOString(),
        completed_at: entity.completed_at,
      })
      .select()
      .single()

    if (error) throw error
    return data as SnapshotRun
  }

  async update(id: number, data: UpdateSnapshotRunData): Promise<SnapshotRun> {
    const updateData: Record<string, unknown> = {}
    
    if (data.status !== undefined) updateData.status = data.status
    if (data.error_message !== undefined) updateData.error_message = data.error_message
    if (data.plants_processed !== undefined) updateData.plants_processed = data.plants_processed
    if (data.completed_at !== undefined) updateData.completed_at = data.completed_at

    const { data: run, error } = await this.client
      .from("analytics_snapshot_runs")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    return run as SnapshotRun
  }
}

