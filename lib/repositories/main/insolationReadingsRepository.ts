/**
 * Insolation Readings Repository - Main DB
 * 
 * Phase 14 Implementation
 * 
 * Handles all database operations for the `insolation_readings` table.
 */

import { SupabaseClient } from "@supabase/supabase-js"

// =============================================================================
// Types
// =============================================================================

export interface InsolationReading {
  id: number
  wms_device_id: number
  reading_date: string
  insolation_kwh_m2: number | null
  irradiance_w_m2: number | null
  ambient_temp_c: number | null
  module_temp_c: number | null
  created_at: string
  updated_at: string
}

export interface SaveInsolationReadingData {
  wms_device_id: number
  reading_date: string
  insolation_kwh_m2?: number
  irradiance_w_m2?: number
  ambient_temp_c?: number
  module_temp_c?: number
}

// =============================================================================
// Interface
// =============================================================================

export interface IInsolationReadingsRepository {
  findByDeviceId(deviceId: number, filters?: { startDate?: string; endDate?: string; limit?: number }): Promise<InsolationReading[]>
  findByDeviceAndDate(deviceId: number, date: string): Promise<InsolationReading | null>
  save(entity: SaveInsolationReadingData): Promise<InsolationReading>
  saveAll(entities: SaveInsolationReadingData[]): Promise<InsolationReading[]>
}

// =============================================================================
// Implementation
// =============================================================================

export class InsolationReadingsRepository implements IInsolationReadingsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByDeviceId(deviceId: number, filters?: { startDate?: string; endDate?: string; limit?: number }): Promise<InsolationReading[]> {
    let query = this.client
      .from("insolation_readings")
      .select("*")
      .eq("wms_device_id", deviceId)
      .order("reading_date", { ascending: false })

    if (filters?.startDate) {
      query = query.gte("reading_date", filters.startDate)
    }
    if (filters?.endDate) {
      query = query.lte("reading_date", filters.endDate)
    }
    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []) as InsolationReading[]
  }

  async findByDeviceAndDate(deviceId: number, date: string): Promise<InsolationReading | null> {
    const { data, error } = await this.client
      .from("insolation_readings")
      .select("*")
      .eq("wms_device_id", deviceId)
      .eq("reading_date", date)
      .single()

    if (error) {
      if (error.code === "PGRST116") return null
      throw error
    }
    return data as InsolationReading
  }

  async save(entity: SaveInsolationReadingData): Promise<InsolationReading> {
    const { data, error } = await this.client
      .from("insolation_readings")
      .upsert({
        wms_device_id: entity.wms_device_id,
        reading_date: entity.reading_date,
        insolation_kwh_m2: entity.insolation_kwh_m2,
        irradiance_w_m2: entity.irradiance_w_m2,
        ambient_temp_c: entity.ambient_temp_c,
        module_temp_c: entity.module_temp_c,
      }, { onConflict: "wms_device_id,reading_date" })
      .select()
      .single()

    if (error) throw error
    return data as InsolationReading
  }

  async saveAll(entities: SaveInsolationReadingData[]): Promise<InsolationReading[]> {
    if (entities.length === 0) return []

    const { data, error } = await this.client
      .from("insolation_readings")
      .upsert(entities.map(e => ({
        wms_device_id: e.wms_device_id,
        reading_date: e.reading_date,
        insolation_kwh_m2: e.insolation_kwh_m2,
        irradiance_w_m2: e.irradiance_w_m2,
        ambient_temp_c: e.ambient_temp_c,
        module_temp_c: e.module_temp_c,
      })), { onConflict: "wms_device_id,reading_date" })
      .select()

    if (error) throw error
    return (data || []) as InsolationReading[]
  }
}

