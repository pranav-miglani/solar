/**
 * Legacy WMS Vendors Adapter - Main DB
 * 
 * Phase 8 - Feature Toggle Support
 * 
 * This adapter implements the same interface as WmsVendorsRepository
 * but uses direct Supabase calls (legacy pattern).
 * 
 * Used when USE_WMS_VENDORS_REPO=false for instant rollback.
 */

import { SupabaseClient } from "@supabase/supabase-js"
import type { 
  WmsVendor, 
  WmsVendorWithOrganization, 
  SaveWmsVendorData, 
  UpdateWmsVendorData,
  UpdateTokenData,
  IWmsVendorsRepository 
} from "../wmsVendorsRepository"

/**
 * Legacy WMS Vendors Adapter Implementation
 */
export class LegacyWmsVendorsAdapter implements IWmsVendorsRepository {
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

