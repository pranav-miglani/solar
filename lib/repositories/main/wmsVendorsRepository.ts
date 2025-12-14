/**
 * WMS Vendors Repository - Main DB
 * 
 * Phase 8 Implementation
 * 
 * Handles all database operations for the `wms_vendors` table.
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
 * WMS Vendor type enum
 */
export type WmsVendorType = "INTELLO" | "SCADA" | "TRACKSO"

/**
 * WMS Vendor entity returned from database
 */
export interface WmsVendor {
  id: number
  name: string
  vendor_type: WmsVendorType
  credentials: Record<string, unknown>
  token: string | null
  token_expires_at: string | null
  token_metadata: Record<string, unknown> | null
  org_id: number
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * WMS Vendor with organization join
 */
export interface WmsVendorWithOrganization extends WmsVendor {
  organizations: OrganizationRef | null
}

/**
 * Data required to save (create) a WMS vendor
 */
export interface SaveWmsVendorData {
  name: string
  vendor_type: WmsVendorType
  credentials: Record<string, unknown>
  org_id: number
  is_active?: boolean
}

/**
 * Data for updating a WMS vendor
 */
export interface UpdateWmsVendorData {
  name?: string
  vendor_type?: WmsVendorType
  credentials?: Record<string, unknown>
  org_id?: number
  is_active?: boolean
}

/**
 * Data for updating token
 */
export interface UpdateTokenData {
  token: string
  token_expires_at: string
  token_metadata?: Record<string, unknown>
}

// =============================================================================
// Interface
// =============================================================================

/**
 * WMS Vendors Repository Interface (JPA-style)
 */
export interface IWmsVendorsRepository {
  /**
   * Find all WMS vendors with organization join, ordered by name
   */
  findAllWithOrganizations(): Promise<WmsVendorWithOrganization[]>

  /**
   * Find WMS vendors by organization ID with organization join
   */
  findByOrgIdWithOrganization(orgId: number): Promise<WmsVendorWithOrganization[]>

  /**
   * Find WMS vendor by ID with organization join
   */
  findByIdWithOrganization(id: number): Promise<WmsVendorWithOrganization | null>

  /**
   * Find WMS vendor by ID (without join)
   */
  findById(id: number): Promise<WmsVendor | null>

  /**
   * Find all active WMS vendors
   */
  findActive(): Promise<WmsVendor[]>

  /**
   * Save (insert) a new WMS vendor
   */
  save(entity: SaveWmsVendorData): Promise<WmsVendor>

  /**
   * Update a WMS vendor by ID
   */
  update(id: number, data: UpdateWmsVendorData): Promise<WmsVendor>

  /**
   * Update token for a WMS vendor
   */
  updateToken(id: number, data: UpdateTokenData): Promise<void>

  /**
   * Clear token for a WMS vendor
   */
  clearToken(id: number): Promise<void>

  /**
   * Delete a WMS vendor by ID
   */
  deleteById(id: number): Promise<void>
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * WMS Vendors Repository Implementation
 */
export class WmsVendorsRepository implements IWmsVendorsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAllWithOrganizations(): Promise<WmsVendorWithOrganization[]> {
    const { data, error } = await this.client
      .from("wms_vendors")
      .select(`
        *,
        organizations (
          id,
          name
        )
      `)
      .order("name", { ascending: true })

    if (error) throw error
    return (data || []) as WmsVendorWithOrganization[]
  }

  async findByOrgIdWithOrganization(orgId: number): Promise<WmsVendorWithOrganization[]> {
    const { data, error } = await this.client
      .from("wms_vendors")
      .select(`
        *,
        organizations (
          id,
          name
        )
      `)
      .eq("org_id", orgId)
      .order("name", { ascending: true })

    if (error) throw error
    return (data || []) as WmsVendorWithOrganization[]
  }

  async findByIdWithOrganization(id: number): Promise<WmsVendorWithOrganization | null> {
    const { data, error } = await this.client
      .from("wms_vendors")
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
    return data as WmsVendorWithOrganization
  }

  async findById(id: number): Promise<WmsVendor | null> {
    const { data, error } = await this.client
      .from("wms_vendors")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return null
      }
      throw error
    }
    return data as WmsVendor
  }

  async findActive(): Promise<WmsVendor[]> {
    const { data, error } = await this.client
      .from("wms_vendors")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true })

    if (error) throw error
    return (data || []) as WmsVendor[]
  }

  async save(entity: SaveWmsVendorData): Promise<WmsVendor> {
    const { data, error } = await this.client
      .from("wms_vendors")
      .insert({
        name: entity.name,
        vendor_type: entity.vendor_type,
        credentials: entity.credentials,
        org_id: entity.org_id,
        is_active: entity.is_active ?? true,
      })
      .select()
      .single()

    if (error) throw error
    return data as WmsVendor
  }

  async update(id: number, data: UpdateWmsVendorData): Promise<WmsVendor> {
    const updateData: Record<string, unknown> = {}
    
    if (data.name !== undefined) updateData.name = data.name
    if (data.vendor_type !== undefined) updateData.vendor_type = data.vendor_type
    if (data.credentials !== undefined) updateData.credentials = data.credentials
    if (data.org_id !== undefined) updateData.org_id = data.org_id
    if (data.is_active !== undefined) updateData.is_active = data.is_active

    const { data: vendor, error } = await this.client
      .from("wms_vendors")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    return vendor as WmsVendor
  }

  async updateToken(id: number, data: UpdateTokenData): Promise<void> {
    const updateData: Record<string, unknown> = {
      token: data.token,
      token_expires_at: data.token_expires_at,
    }
    
    if (data.token_metadata !== undefined) {
      updateData.token_metadata = data.token_metadata
    }

    const { error } = await this.client
      .from("wms_vendors")
      .update(updateData)
      .eq("id", id)

    if (error) throw error
  }

  async clearToken(id: number): Promise<void> {
    const { error } = await this.client
      .from("wms_vendors")
      .update({
        token: null,
        token_expires_at: null,
      })
      .eq("id", id)

    if (error) throw error
  }

  async deleteById(id: number): Promise<void> {
    const { error } = await this.client
      .from("wms_vendors")
      .delete()
      .eq("id", id)

    if (error) throw error
  }
}

