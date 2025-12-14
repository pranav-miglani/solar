/**
 * Analytics Plants Repository - Analytics DB
 * 
 * Phase 10 Implementation
 * 
 * Handles all database operations for the `plants` table in Analytics DB.
 * Analytics plants have simplified schema (no production metrics).
 */

import { SupabaseClient } from "@supabase/supabase-js"

// =============================================================================
// Types
// =============================================================================

export interface AnalyticsOrganizationRef {
  id: number
  name: string
}

export interface AnalyticsVendorRef {
  id: number
  name: string
}

export interface AnalyticsPlant {
  id: number
  org_id: number
  vendor_id: number
  vendor_plant_id: string
  plant_name: string
  capacity_kw: number
  created_at: string
  updated_at: string
}

export interface AnalyticsPlantWithRelations extends AnalyticsPlant {
  organizations: AnalyticsOrganizationRef | null
  vendors: AnalyticsVendorRef | null
}

export interface SaveAnalyticsPlantData {
  id?: number
  org_id: number
  vendor_id: number
  vendor_plant_id: string
  plant_name: string
  capacity_kw: number
}

// =============================================================================
// Interface
// =============================================================================

export interface IAnalyticsPlantsRepository {
  findAllWithRelations(): Promise<AnalyticsPlantWithRelations[]>
  findByOrgIdWithRelations(orgId: number): Promise<AnalyticsPlantWithRelations[]>
  findByVendorIdWithRelations(vendorId: number): Promise<AnalyticsPlantWithRelations[]>
  findById(id: number): Promise<AnalyticsPlant | null>
  save(entity: SaveAnalyticsPlantData): Promise<AnalyticsPlant>
  saveAll(entities: SaveAnalyticsPlantData[]): Promise<AnalyticsPlant[]>
}

// =============================================================================
// Implementation
// =============================================================================

export class AnalyticsPlantsRepository implements IAnalyticsPlantsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAllWithRelations(): Promise<AnalyticsPlantWithRelations[]> {
    const { data, error } = await this.client
      .from("plants")
      .select(`*, organizations (id, name), vendors (id, name)`)
      .order("plant_name", { ascending: true })

    if (error) throw error
    return (data || []) as AnalyticsPlantWithRelations[]
  }

  async findByOrgIdWithRelations(orgId: number): Promise<AnalyticsPlantWithRelations[]> {
    const { data, error } = await this.client
      .from("plants")
      .select(`*, organizations (id, name), vendors (id, name)`)
      .eq("org_id", orgId)
      .order("plant_name", { ascending: true })

    if (error) throw error
    return (data || []) as AnalyticsPlantWithRelations[]
  }

  async findByVendorIdWithRelations(vendorId: number): Promise<AnalyticsPlantWithRelations[]> {
    const { data, error } = await this.client
      .from("plants")
      .select(`*, organizations (id, name), vendors (id, name)`)
      .eq("vendor_id", vendorId)
      .order("plant_name", { ascending: true })

    if (error) throw error
    return (data || []) as AnalyticsPlantWithRelations[]
  }

  async findById(id: number): Promise<AnalyticsPlant | null> {
    const { data, error } = await this.client
      .from("plants")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") return null
      throw error
    }
    return data as AnalyticsPlant
  }

  async save(entity: SaveAnalyticsPlantData): Promise<AnalyticsPlant> {
    const { data, error } = await this.client
      .from("plants")
      .upsert({
        id: entity.id,
        org_id: entity.org_id,
        vendor_id: entity.vendor_id,
        vendor_plant_id: entity.vendor_plant_id,
        plant_name: entity.plant_name,
        capacity_kw: entity.capacity_kw,
      }, { onConflict: "id" })
      .select()
      .single()

    if (error) throw error
    return data as AnalyticsPlant
  }

  async saveAll(entities: SaveAnalyticsPlantData[]): Promise<AnalyticsPlant[]> {
    if (entities.length === 0) return []

    const { data, error } = await this.client
      .from("plants")
      .upsert(entities.map(e => ({
        id: e.id,
        org_id: e.org_id,
        vendor_id: e.vendor_id,
        vendor_plant_id: e.vendor_plant_id,
        plant_name: e.plant_name,
        capacity_kw: e.capacity_kw,
      })), { onConflict: "id" })
      .select()

    if (error) throw error
    return (data || []) as AnalyticsPlant[]
  }
}

