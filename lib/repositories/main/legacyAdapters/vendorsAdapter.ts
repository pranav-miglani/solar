/**
 * Legacy Vendors Adapter - Main DB
 * 
 * Phase 6 - Feature Toggle Support
 * 
 * This adapter implements the same interface as VendorsRepository
 * but uses direct Supabase calls (legacy pattern).
 * 
 * Used when USE_VENDORS_REPO=false for instant rollback.
 */

import { SupabaseClient } from "@supabase/supabase-js"
import type { 
  Vendor, 
  VendorWithOrganization, 
  SaveVendorData, 
  UpdateVendorData, 
  IVendorsRepository 
} from "../vendorsRepository"

/**
 * Legacy Vendors Adapter Implementation
 */
export class LegacyVendorsAdapter implements IVendorsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAllWithOrganizations(): Promise<VendorWithOrganization[]> {
    const { data, error } = await this.client
      .from("vendors")
      .select(`
        *,
        organizations (
          id,
          name
        )
      `)
      .order("name", { ascending: true })

    if (error) throw error
    return (data || []) as VendorWithOrganization[]
  }

  async findByIdWithOrganization(id: number): Promise<VendorWithOrganization | null> {
    const { data, error } = await this.client
      .from("vendors")
      .select("*, organizations(id, name)")
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return null
      }
      throw error
    }
    return data as VendorWithOrganization
  }

  async findById(id: number): Promise<Vendor | null> {
    const { data, error } = await this.client
      .from("vendors")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return null
      }
      throw error
    }
    return data as Vendor
  }

  async findActive(): Promise<Vendor[]> {
    const { data, error } = await this.client
      .from("vendors")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true })

    if (error) throw error
    return (data || []) as Vendor[]
  }

  async findByOrgId(orgId: number): Promise<Vendor[]> {
    const { data, error } = await this.client
      .from("vendors")
      .select("*")
      .eq("org_id", orgId)
      .order("name", { ascending: true })

    if (error) throw error
    return (data || []) as Vendor[]
  }

  async save(entity: SaveVendorData): Promise<Vendor> {
    const { data, error } = await this.client
      .from("vendors")
      .insert({
        name: entity.name,
        vendor_type: entity.vendor_type,
        credentials: entity.credentials,
        org_id: entity.org_id,
        is_active: entity.is_active ?? true,
        plant_sync_mode: entity.plant_sync_mode || null,
        per_plant_sync_interval_minutes: entity.per_plant_sync_interval_minutes ?? 15,
        plant_sync_time_ist: entity.plant_sync_time_ist || '02:00',
        telemetry_sync_mode: entity.telemetry_sync_mode || 'LIST_PLANTS',
        telemetry_sync_interval: entity.telemetry_sync_interval ?? 15,
      })
      .select()
      .single()

    if (error) throw error
    return data as Vendor
  }

  async update(id: number, data: UpdateVendorData): Promise<Vendor> {
    const updateData: Record<string, unknown> = {}
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.credentials !== undefined) updateData.credentials = data.credentials
    if (data.is_active !== undefined) updateData.is_active = data.is_active
    if (data.org_id !== undefined) updateData.org_id = data.org_id
    if (data.plant_sync_mode !== undefined) updateData.plant_sync_mode = data.plant_sync_mode
    if (data.per_plant_sync_interval_minutes !== undefined) {
      updateData.per_plant_sync_interval_minutes = data.per_plant_sync_interval_minutes
    }
    if (data.plant_sync_time_ist !== undefined) updateData.plant_sync_time_ist = data.plant_sync_time_ist
    if (data.telemetry_sync_mode !== undefined) updateData.telemetry_sync_mode = data.telemetry_sync_mode
    if (data.telemetry_sync_interval !== undefined) updateData.telemetry_sync_interval = data.telemetry_sync_interval

    const { data: vendor, error } = await this.client
      .from("vendors")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    return vendor as Vendor
  }

  async deleteById(id: number): Promise<void> {
    const { error } = await this.client
      .from("vendors")
      .delete()
      .eq("id", id)

    if (error) throw error
  }
}

