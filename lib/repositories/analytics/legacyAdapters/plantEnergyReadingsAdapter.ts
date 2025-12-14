/**
 * Legacy Plant Energy Readings Adapter - Analytics DB
 * 
 * Phase 15 - Feature Toggle Support
 */

import { SupabaseClient } from "@supabase/supabase-js"
import type { PlantEnergyReading, SavePlantEnergyReadingData, IPlantEnergyReadingsRepository } from "../plantEnergyReadingsRepository"

export class LegacyPlantEnergyReadingsAdapter implements IPlantEnergyReadingsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByPlantId(plantId: number, filters?: { startDate?: string; endDate?: string; limit?: number }): Promise<PlantEnergyReading[]> {
    let query = this.client.from("plant_energy_readings").select("*").eq("plant_id", plantId).order("reading_date", { ascending: false })
    if (filters?.startDate) query = query.gte("reading_date", filters.startDate)
    if (filters?.endDate) query = query.lte("reading_date", filters.endDate)
    if (filters?.limit) query = query.limit(filters.limit)
    const { data, error } = await query
    if (error) throw error
    return (data || []) as PlantEnergyReading[]
  }

  async findByVendorId(vendorId: number, filters?: { startDate?: string; endDate?: string }): Promise<PlantEnergyReading[]> {
    let query = this.client.from("plant_energy_readings").select("*").eq("vendor_id", vendorId).order("reading_date", { ascending: false })
    if (filters?.startDate) query = query.gte("reading_date", filters.startDate)
    if (filters?.endDate) query = query.lte("reading_date", filters.endDate)
    const { data, error } = await query
    if (error) throw error
    return (data || []) as PlantEnergyReading[]
  }

  async findByPlantAndDate(plantId: number, date: string): Promise<PlantEnergyReading | null> {
    const { data, error } = await this.client.from("plant_energy_readings").select("*").eq("plant_id", plantId).eq("reading_date", date).single()
    if (error) { if (error.code === "PGRST116") return null; throw error }
    return data as PlantEnergyReading
  }

  async save(entity: SavePlantEnergyReadingData): Promise<PlantEnergyReading> {
    const { data, error } = await this.client.from("plant_energy_readings").upsert({ plant_id: entity.plant_id, vendor_id: entity.vendor_id, reading_date: entity.reading_date, today_energy_kwh: entity.today_energy_kwh, total_energy_kwh: entity.total_energy_kwh, current_power_kw: entity.current_power_kw, peak_power_kw: entity.peak_power_kw }, { onConflict: "plant_id,reading_date" }).select().single()
    if (error) throw error
    return data as PlantEnergyReading
  }

  async saveAll(entities: SavePlantEnergyReadingData[]): Promise<PlantEnergyReading[]> {
    if (entities.length === 0) return []
    const BATCH_SIZE = 100
    const results: PlantEnergyReading[] = []
    for (let i = 0; i < entities.length; i += BATCH_SIZE) {
      const batch = entities.slice(i, i + BATCH_SIZE)
      const { data, error } = await this.client.from("plant_energy_readings").upsert(batch.map(e => ({ plant_id: e.plant_id, vendor_id: e.vendor_id, reading_date: e.reading_date, today_energy_kwh: e.today_energy_kwh, total_energy_kwh: e.total_energy_kwh, current_power_kw: e.current_power_kw, peak_power_kw: e.peak_power_kw })), { onConflict: "plant_id,reading_date" }).select()
      if (error) throw error
      results.push(...((data || []) as PlantEnergyReading[]))
    }
    return results
  }
}

