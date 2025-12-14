/**
 * Plants Repository - Main DB
 * 
 * Phase 9 Implementation
 * 
 * Handles all database operations for the `plants` table in Main DB.
 * Uses JPA-style naming conventions.
 */

import { SupabaseClient } from "@supabase/supabase-js"

// =============================================================================
// Types
// =============================================================================

export interface VendorRef {
  id: number
  name: string
  vendor_type: string
}

export interface OrganizationRef {
  id: number
  name: string
}

export interface Plant {
  id: number
  name: string
  vendor_id: number
  org_id: number
  vendor_plant_id: string
  capacity_kw: number
  location: Record<string, unknown> | null
  today_energy_kwh: number | null
  total_energy_kwh: number | null
  current_power_kw: number | null
  network_status: string | null
  last_refreshed_at: string | null
  created_at: string
  updated_at: string
}

export interface PlantWithRelations extends Plant {
  vendors: VendorRef | null
  organizations: OrganizationRef | null
}

export interface SavePlantData {
  name: string
  vendor_id: number
  org_id: number
  vendor_plant_id: string
  capacity_kw: number
  location?: Record<string, unknown>
}

export interface UpdatePlantData {
  name?: string
  capacity_kw?: number
  location?: Record<string, unknown>
  today_energy_kwh?: number
  total_energy_kwh?: number
  current_power_kw?: number
  network_status?: string
  last_refreshed_at?: string
}

// =============================================================================
// Interface
// =============================================================================

export interface IPlantsRepository {
  findAllWithRelations(): Promise<PlantWithRelations[]>
  findByOrgIdWithRelations(orgId: number): Promise<PlantWithRelations[]>
  findByIdsWithRelations(ids: number[]): Promise<PlantWithRelations[]>
  findByIdWithRelations(id: number): Promise<PlantWithRelations | null>
  findById(id: number): Promise<Plant | null>
  findByOrgId(orgId: number): Promise<Plant[]>
  getPlantIdsByOrgId(orgId: number): Promise<number[]>
  save(entity: SavePlantData): Promise<Plant>
  update(id: number, data: UpdatePlantData): Promise<Plant>
  deleteById(id: number): Promise<void>
}

// =============================================================================
// Implementation
// =============================================================================

export class PlantsRepository implements IPlantsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAllWithRelations(): Promise<PlantWithRelations[]> {
    const { data, error } = await this.client
      .from("plants")
      .select(`
        *,
        vendors (id, name, vendor_type),
        organizations (id, name)
      `)
      .order("name", { ascending: true })

    if (error) throw error
    return (data || []) as PlantWithRelations[]
  }

  async findByOrgIdWithRelations(orgId: number): Promise<PlantWithRelations[]> {
    const { data, error } = await this.client
      .from("plants")
      .select(`
        *,
        vendors (id, name, vendor_type),
        organizations (id, name)
      `)
      .eq("org_id", orgId)
      .order("name", { ascending: true })

    if (error) throw error
    return (data || []) as PlantWithRelations[]
  }

  async findByIdsWithRelations(ids: number[]): Promise<PlantWithRelations[]> {
    if (ids.length === 0) return []
    
    const { data, error } = await this.client
      .from("plants")
      .select(`
        *,
        vendors (id, name, vendor_type),
        organizations (id, name)
      `)
      .in("id", ids)
      .order("name", { ascending: true })

    if (error) throw error
    return (data || []) as PlantWithRelations[]
  }

  async findByIdWithRelations(id: number): Promise<PlantWithRelations | null> {
    const { data, error } = await this.client
      .from("plants")
      .select(`
        *,
        vendors (id, name, vendor_type),
        organizations (id, name)
      `)
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") return null
      throw error
    }
    return data as PlantWithRelations
  }

  async findById(id: number): Promise<Plant | null> {
    const { data, error } = await this.client
      .from("plants")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") return null
      throw error
    }
    return data as Plant
  }

  async findByOrgId(orgId: number): Promise<Plant[]> {
    const { data, error } = await this.client
      .from("plants")
      .select("*")
      .eq("org_id", orgId)
      .order("name", { ascending: true })

    if (error) throw error
    return (data || []) as Plant[]
  }

  async getPlantIdsByOrgId(orgId: number): Promise<number[]> {
    const { data, error } = await this.client
      .from("plants")
      .select("id")
      .eq("org_id", orgId)

    if (error) throw error
    return (data || []).map(p => p.id)
  }

  async save(entity: SavePlantData): Promise<Plant> {
    const { data, error } = await this.client
      .from("plants")
      .insert({
        name: entity.name,
        vendor_id: entity.vendor_id,
        org_id: entity.org_id,
        vendor_plant_id: entity.vendor_plant_id,
        capacity_kw: entity.capacity_kw,
        location: entity.location || {},
      })
      .select()
      .single()

    if (error) throw error
    return data as Plant
  }

  async update(id: number, data: UpdatePlantData): Promise<Plant> {
    const updateData: Record<string, unknown> = {}
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.capacity_kw !== undefined) updateData.capacity_kw = data.capacity_kw
    if (data.location !== undefined) updateData.location = data.location
    if (data.today_energy_kwh !== undefined) updateData.today_energy_kwh = data.today_energy_kwh
    if (data.total_energy_kwh !== undefined) updateData.total_energy_kwh = data.total_energy_kwh
    if (data.current_power_kw !== undefined) updateData.current_power_kw = data.current_power_kw
    if (data.network_status !== undefined) updateData.network_status = data.network_status
    if (data.last_refreshed_at !== undefined) updateData.last_refreshed_at = data.last_refreshed_at

    const { data: plant, error } = await this.client
      .from("plants")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    return plant as Plant
  }

  async deleteById(id: number): Promise<void> {
    const { error } = await this.client
      .from("plants")
      .delete()
      .eq("id", id)

    if (error) throw error
  }
}

