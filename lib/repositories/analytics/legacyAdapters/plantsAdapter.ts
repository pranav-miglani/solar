/**
 * Legacy Analytics Plants Adapter - Analytics DB
 * 
 * Phase 10 - Feature Toggle Support
 */

import { SupabaseClient } from "@supabase/supabase-js"
import type { AnalyticsPlant, AnalyticsPlantWithRelations, SaveAnalyticsPlantData, IAnalyticsPlantsRepository } from "../plantsRepository"

export class LegacyAnalyticsPlantsAdapter implements IAnalyticsPlantsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAllWithRelations(): Promise<AnalyticsPlantWithRelations[]> {
    const { data, error } = await this.client.from("plants").select(`*, organizations (id, name), vendors (id, name)`).order("plant_name", { ascending: true })
    if (error) throw error
    return (data || []) as AnalyticsPlantWithRelations[]
  }

  async findByOrgIdWithRelations(orgId: number): Promise<AnalyticsPlantWithRelations[]> {
    const { data, error } = await this.client.from("plants").select(`*, organizations (id, name), vendors (id, name)`).eq("org_id", orgId).order("plant_name", { ascending: true })
    if (error) throw error
    return (data || []) as AnalyticsPlantWithRelations[]
  }

  async findByVendorIdWithRelations(vendorId: number): Promise<AnalyticsPlantWithRelations[]> {
    const { data, error } = await this.client.from("plants").select(`*, organizations (id, name), vendors (id, name)`).eq("vendor_id", vendorId).order("plant_name", { ascending: true })
    if (error) throw error
    return (data || []) as AnalyticsPlantWithRelations[]
  }

  async findById(id: number): Promise<AnalyticsPlant | null> {
    const { data, error } = await this.client.from("plants").select("*").eq("id", id).single()
    if (error) {
      if (error.code === "PGRST116") return null
      throw error
    }
    return data as AnalyticsPlant
  }

  async save(entity: SaveAnalyticsPlantData): Promise<AnalyticsPlant> {
    const { data, error } = await this.client.from("plants").upsert({ id: entity.id, org_id: entity.org_id, vendor_id: entity.vendor_id, vendor_plant_id: entity.vendor_plant_id, plant_name: entity.plant_name, capacity_kw: entity.capacity_kw }, { onConflict: "id" }).select().single()
    if (error) throw error
    return data as AnalyticsPlant
  }

  async saveAll(entities: SaveAnalyticsPlantData[]): Promise<AnalyticsPlant[]> {
    if (entities.length === 0) return []
    const { data, error } = await this.client.from("plants").upsert(entities.map(e => ({ id: e.id, org_id: e.org_id, vendor_id: e.vendor_id, vendor_plant_id: e.vendor_plant_id, plant_name: e.plant_name, capacity_kw: e.capacity_kw })), { onConflict: "id" }).select()
    if (error) throw error
    return (data || []) as AnalyticsPlant[]
  }
}

