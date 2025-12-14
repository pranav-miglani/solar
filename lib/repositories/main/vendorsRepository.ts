/**
 * Vendors Repository - Main DB
 * 
 * Phase 6 Implementation
 * 
 * Handles all database operations for the `vendors` table in Main DB.
 * Uses JPA-style naming conventions.
 */

import { SupabaseClient } from "@supabase/supabase-js"

// =============================================================================
// Types
// =============================================================================

/**
 * Organization reference (for joins)
 */
export interface OrganizationRef {
  id: number
  name: string
}

/**
 * Vendor entity returned from database
 */
export interface Vendor {
  id: number
  name: string
  vendor_type: string
  credentials: Record<string, unknown>
  token: string | null
  token_metadata: Record<string, unknown> | null
  org_id: number
  is_active: boolean
  plant_sync_mode: string | null
  per_plant_sync_interval_minutes: number
  plant_sync_time_ist: string
  telemetry_sync_mode: string
  telemetry_sync_interval: number
  created_at: string
  updated_at: string
}

/**
 * Vendor with organization join
 */
export interface VendorWithOrganization extends Vendor {
  organizations: OrganizationRef | null
}

/**
 * Data required to save (create) a vendor
 */
export interface SaveVendorData {
  name: string
  vendor_type: string
  credentials: Record<string, unknown>
  org_id: number
  is_active?: boolean
  plant_sync_mode?: string | null
  per_plant_sync_interval_minutes?: number
  plant_sync_time_ist?: string
  telemetry_sync_mode?: string
  telemetry_sync_interval?: number
}

/**
 * Data for updating a vendor
 */
export interface UpdateVendorData {
  name?: string
  credentials?: Record<string, unknown>
  is_active?: boolean
  org_id?: number
  plant_sync_mode?: string | null
  per_plant_sync_interval_minutes?: number
  plant_sync_time_ist?: string
  telemetry_sync_mode?: string
  telemetry_sync_interval?: number
}

// =============================================================================
// Interface
// =============================================================================

/**
 * Vendors Repository Interface (JPA-style)
 */
export interface IVendorsRepository {
  /**
   * Find all vendors with organization join, ordered by name
   */
  findAllWithOrganizations(): Promise<VendorWithOrganization[]>

  /**
   * Find vendor by ID with organization join
   */
  findByIdWithOrganization(id: number): Promise<VendorWithOrganization | null>

  /**
   * Find vendor by ID (without join)
   */
  findById(id: number): Promise<Vendor | null>

  /**
   * Find all active vendors
   */
  findActive(): Promise<Vendor[]>

  /**
   * Find vendors by organization ID
   */
  findByOrgId(orgId: number): Promise<Vendor[]>

  /**
   * Save (insert) a new vendor
   */
  save(entity: SaveVendorData): Promise<Vendor>

  /**
   * Update a vendor by ID
   */
  update(id: number, data: UpdateVendorData): Promise<Vendor>

  /**
   * Delete a vendor by ID
   */
  deleteById(id: number): Promise<void>
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Vendors Repository Implementation
 */
export class VendorsRepository implements IVendorsRepository {
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
      .select(`
        *,
        organizations (
          id,
          name
        )
      `)
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

