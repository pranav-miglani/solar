/**
 * Legacy Work Logs Adapter - Main DB
 * 
 * Phase 20 - Feature Toggle Support
 */

import { SupabaseClient } from "@supabase/supabase-js"
import type { WorkLog, SaveWorkLogData, IWorkLogsRepository } from "../workLogsRepository"

export class LegacyWorkLogsAdapter implements IWorkLogsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByWorkOrderId(workOrderId: number): Promise<WorkLog[]> {
    const { data, error } = await this.client.from("work_logs").select("*").eq("work_order_id", workOrderId).order("created_at", { ascending: false })
    if (error) throw error
    return (data || []) as WorkLog[]
  }

  async findById(id: number): Promise<WorkLog | null> {
    const { data, error } = await this.client.from("work_logs").select("*").eq("id", id).single()
    if (error) { if (error.code === "PGRST116") return null; throw error }
    return data as WorkLog
  }

  async save(entity: SaveWorkLogData): Promise<WorkLog> {
    const { data, error } = await this.client.from("work_logs").insert({ work_order_id: entity.work_order_id, account_id: entity.account_id, log_text: entity.log_text, log_type: entity.log_type || "NOTE" }).select().single()
    if (error) throw error
    return data as WorkLog
  }
}

