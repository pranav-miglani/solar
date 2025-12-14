/**
 * Legacy Plant Grid Downtime Readings Adapter - Analytics DB
 * 
 * Phase 16 - Feature Toggle Support
 */

import { SupabaseClient } from "@supabase/supabase-js"
import type { PlantGridDowntimeReading, SavePlantGridDowntimeReadingData, IPlantGridDowntimeReadingsRepository } from "../plantGridDowntimeReadingsRepository"

export class LegacyPlantGridDowntimeReadingsAdapter implements IPlantGridDowntimeReadingsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByPlantId(plantId: number, filters?: { startDate?: string; endDate?: string; limit?: number }): Promise<PlantGridDowntimeReading[]> {
    let query = this.client.from("plant_grid_downtime_readings").select("*").eq("plant_id", plantId).order("reading_date", { ascending: false })
    if (filters?.startDate) query = query.gte("reading_date", filters.startDate)
    if (filters?.endDate) query = query.lte("reading_date", filters.endDate)
    if (filters?.limit) query = query.limit(filters.limit)
    const { data, error } = await query
    if (error) throw error
    return (data || []) as PlantGridDowntimeReading[]
  }

  async findByPlantAndDate(plantId: number, date: string): Promise<PlantGridDowntimeReading | null> {
    const { data, error } = await this.client.from("plant_grid_downtime_readings").select("*").eq("plant_id", plantId).eq("reading_date", date).single()
    if (error) { if (error.code === "PGRST116") return null; throw error }
    return data as PlantGridDowntimeReading
  }

  async getLatestBaseline(plantId: number, cutoffDate: string): Promise<{ baseline_grid_down_minutes: number } | null> {
    const { data, error } = await this.client.from("plant_grid_downtime_readings").select("baseline_grid_down_minutes").eq("plant_id", plantId).lt("reading_date", cutoffDate).not("baseline_grid_down_minutes", "is", null).order("reading_date", { ascending: false }).limit(1).single()
    if (error) { if (error.code === "PGRST116") return null; throw error }
    return data as { baseline_grid_down_minutes: number }
  }

  async save(entity: SavePlantGridDowntimeReadingData): Promise<PlantGridDowntimeReading> {
    const { data, error } = await this.client.from("plant_grid_downtime_readings").upsert({ plant_id: entity.plant_id, reading_date: entity.reading_date, grid_down_minutes: entity.grid_down_minutes, grid_down_count: entity.grid_down_count, baseline_grid_down_minutes: entity.baseline_grid_down_minutes }, { onConflict: "plant_id,reading_date" }).select().single()
    if (error) throw error
    return data as PlantGridDowntimeReading
  }

  async saveAll(entities: SavePlantGridDowntimeReadingData[]): Promise<PlantGridDowntimeReading[]> {
    if (entities.length === 0) return []
    const BATCH_SIZE = 2000
    const results: PlantGridDowntimeReading[] = []
    for (let i = 0; i < entities.length; i += BATCH_SIZE) {
      const batch = entities.slice(i, i + BATCH_SIZE)
      const { data, error } = await this.client.from("plant_grid_downtime_readings").upsert(batch.map(e => ({ plant_id: e.plant_id, reading_date: e.reading_date, grid_down_minutes: e.grid_down_minutes, grid_down_count: e.grid_down_count, baseline_grid_down_minutes: e.baseline_grid_down_minutes })), { onConflict: "plant_id,reading_date" }).select()
      if (error) throw error
      results.push(...((data || []) as PlantGridDowntimeReading[]))
    }
    return results
  }
}

