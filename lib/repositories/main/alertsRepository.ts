/**
 * Alerts Repository - Main DB
 * 
 * Phase 11 Implementation
 * 
 * Handles all database operations for the `alerts` table.
 */

import { SupabaseClient } from "@supabase/supabase-js"

// =============================================================================
// Types
// =============================================================================

export interface PlantRef {
  id: number
  name: string
  org_id: number
  vendors?: { id: number; name: string } | null
}

export interface Alert {
  id: number
  plant_id: number
  vendor_id: number
  vendor_plant_id: string
  vendor_alert_id: string
  alert_type: string
  alert_message: string | null
  alert_time: string
  status: string
  created_at: string
  updated_at: string
}

export interface AlertWithPlant extends Alert {
  plants: PlantRef | null
}

export interface SaveAlertData {
  plant_id: number
  vendor_id: number
  vendor_plant_id: string
  vendor_alert_id: string
  alert_type: string
  alert_message?: string | null
  alert_time: string
  status?: string
}

// =============================================================================
// Interface
// =============================================================================

export interface IAlertsRepository {
  findWithPlants(filters?: { plantId?: number; plantIds?: number[]; limit?: number; status?: string }): Promise<AlertWithPlant[]>
  findById(id: number): Promise<Alert | null>
  save(entity: SaveAlertData): Promise<Alert>
  saveAll(entities: SaveAlertData[]): Promise<Alert[]>
  countActive(): Promise<number>
}

// =============================================================================
// Implementation
// =============================================================================

export class AlertsRepository implements IAlertsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findWithPlants(filters?: { plantId?: number; plantIds?: number[]; limit?: number; status?: string }): Promise<AlertWithPlant[]> {
    let query = this.client
      .from("alerts")
      .select(`*, plants (id, name, org_id, vendors (id, name))`)
      .order("alert_time", { ascending: false })

    if (filters?.plantId) {
      query = query.eq("plant_id", filters.plantId)
    }

    if (filters?.plantIds && filters.plantIds.length > 0) {
      query = query.in("plant_id", filters.plantIds)
    }

    if (filters?.status) {
      query = query.eq("status", filters.status)
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []) as AlertWithPlant[]
  }

  async findById(id: number): Promise<Alert | null> {
    const { data, error } = await this.client.from("alerts").select("*").eq("id", id).single()
    if (error) {
      if (error.code === "PGRST116") return null
      throw error
    }
    return data as Alert
  }

  async save(entity: SaveAlertData): Promise<Alert> {
    const { data, error } = await this.client
      .from("alerts")
      .upsert({
        plant_id: entity.plant_id,
        vendor_id: entity.vendor_id,
        vendor_plant_id: entity.vendor_plant_id,
        vendor_alert_id: entity.vendor_alert_id,
        alert_type: entity.alert_type,
        alert_message: entity.alert_message,
        alert_time: entity.alert_time,
        status: entity.status || "active",
      }, { onConflict: "vendor_id,vendor_plant_id,vendor_alert_id" })
      .select()
      .single()

    if (error) throw error
    return data as Alert
  }

  async saveAll(entities: SaveAlertData[]): Promise<Alert[]> {
    if (entities.length === 0) return []

    const { data, error } = await this.client
      .from("alerts")
      .upsert(entities.map(e => ({
        plant_id: e.plant_id,
        vendor_id: e.vendor_id,
        vendor_plant_id: e.vendor_plant_id,
        vendor_alert_id: e.vendor_alert_id,
        alert_type: e.alert_type,
        alert_message: e.alert_message,
        alert_time: e.alert_time,
        status: e.status || "active",
      })), { onConflict: "vendor_id,vendor_plant_id,vendor_alert_id" })
      .select()

    if (error) throw error
    return (data || []) as Alert[]
  }

  async countActive(): Promise<number> {
    const { count, error } = await this.client
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")

    if (error) throw error
    return count || 0
  }
}

