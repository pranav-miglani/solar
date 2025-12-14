/**
 * Work Logs Repository - Main DB
 * 
 * Phase 20 Implementation
 * 
 * Handles all database operations for the `work_logs` table.
 */

import { SupabaseClient } from "@supabase/supabase-js"

// =============================================================================
// Types
// =============================================================================

export interface WorkLog {
  id: number
  work_order_id: number
  account_id: string
  log_text: string
  log_type: string
  created_at: string
}

export interface SaveWorkLogData {
  work_order_id: number
  account_id: string
  log_text: string
  log_type?: string
}

// =============================================================================
// Interface
// =============================================================================

export interface IWorkLogsRepository {
  findByWorkOrderId(workOrderId: number): Promise<WorkLog[]>
  findById(id: number): Promise<WorkLog | null>
  save(entity: SaveWorkLogData): Promise<WorkLog>
}

// =============================================================================
// Implementation
// =============================================================================

export class WorkLogsRepository implements IWorkLogsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByWorkOrderId(workOrderId: number): Promise<WorkLog[]> {
    const { data, error } = await this.client
      .from("work_logs")
      .select("*")
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: false })

    if (error) throw error
    return (data || []) as WorkLog[]
  }

  async findById(id: number): Promise<WorkLog | null> {
    const { data, error } = await this.client
      .from("work_logs")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") return null
      throw error
    }
    return data as WorkLog
  }

  async save(entity: SaveWorkLogData): Promise<WorkLog> {
    const { data, error } = await this.client
      .from("work_logs")
      .insert({
        work_order_id: entity.work_order_id,
        account_id: entity.account_id,
        log_text: entity.log_text,
        log_type: entity.log_type || "NOTE",
      })
      .select()
      .single()

    if (error) throw error
    return data as WorkLog
  }
}

