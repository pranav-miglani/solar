/**
 * WMS Sites Repository - Main DB
 * 
 * Phase 12 Implementation
 * 
 * Handles all database operations for the `wms_sites` table.
 */

import { SupabaseClient } from "@supabase/supabase-js"

// =============================================================================
// Types
// =============================================================================

export interface WmsVendorRef {
  id: number
  name: string
  vendor_type: string
}

export interface OrganizationRef {
  id: number
  name: string
}

export interface WmsSite {
  id: number
  wms_vendor_id: number
  vendor_site_id: string
  site_name: string
  org_id: number
  location: Record<string, unknown> | null
  capacity_kw: number | null
  created_at: string
  updated_at: string
}

export interface WmsSiteWithRelations extends WmsSite {
  wms_vendors: WmsVendorRef | null
  organizations: OrganizationRef | null
  device_count?: number
}

export interface SaveWmsSiteData {
  wms_vendor_id: number
  vendor_site_id: string
  site_name: string
  org_id: number
  location?: Record<string, unknown>
  capacity_kw?: number
}

// =============================================================================
// Interface
// =============================================================================

export interface IWmsSitesRepository {
  findAllWithRelations(): Promise<WmsSiteWithRelations[]>
  findByVendorIdWithRelations(vendorId: number): Promise<WmsSiteWithRelations[]>
  findByOrgIdWithRelations(orgId: number): Promise<WmsSiteWithRelations[]>
  findById(id: number): Promise<WmsSite | null>
  findByVendorSiteId(vendorId: number, vendorSiteId: string): Promise<WmsSite | null>
  save(entity: SaveWmsSiteData): Promise<WmsSite>
  saveAll(entities: SaveWmsSiteData[]): Promise<WmsSite[]>
  deleteById(id: number): Promise<void>
}

// =============================================================================
// Implementation
// =============================================================================

export class WmsSitesRepository implements IWmsSitesRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAllWithRelations(): Promise<WmsSiteWithRelations[]> {
    const { data, error } = await this.client
      .from("wms_sites")
      .select(`*, wms_vendors (id, name, vendor_type), organizations (id, name), wms_devices (count)`)
      .order("site_name", { ascending: true })

    if (error) throw error
    return (data || []).map((site: any) => ({
      ...site,
      device_count: site.wms_devices?.length || 0,
      wms_devices: undefined,
    })) as WmsSiteWithRelations[]
  }

  async findByVendorIdWithRelations(vendorId: number): Promise<WmsSiteWithRelations[]> {
    const { data, error } = await this.client
      .from("wms_sites")
      .select(`*, wms_vendors (id, name, vendor_type), organizations (id, name), wms_devices (count)`)
      .eq("wms_vendor_id", vendorId)
      .order("site_name", { ascending: true })

    if (error) throw error
    return (data || []).map((site: any) => ({
      ...site,
      device_count: site.wms_devices?.length || 0,
      wms_devices: undefined,
    })) as WmsSiteWithRelations[]
  }

  async findByOrgIdWithRelations(orgId: number): Promise<WmsSiteWithRelations[]> {
    const { data, error } = await this.client
      .from("wms_sites")
      .select(`*, wms_vendors (id, name, vendor_type), organizations (id, name), wms_devices (count)`)
      .eq("org_id", orgId)
      .order("site_name", { ascending: true })

    if (error) throw error
    return (data || []).map((site: any) => ({
      ...site,
      device_count: site.wms_devices?.length || 0,
      wms_devices: undefined,
    })) as WmsSiteWithRelations[]
  }

  async findById(id: number): Promise<WmsSite | null> {
    const { data, error } = await this.client.from("wms_sites").select("*").eq("id", id).single()
    if (error) {
      if (error.code === "PGRST116") return null
      throw error
    }
    return data as WmsSite
  }

  async findByVendorSiteId(vendorId: number, vendorSiteId: string): Promise<WmsSite | null> {
    const { data, error } = await this.client
      .from("wms_sites")
      .select("*")
      .eq("wms_vendor_id", vendorId)
      .eq("vendor_site_id", vendorSiteId)
      .single()

    if (error) {
      if (error.code === "PGRST116") return null
      throw error
    }
    return data as WmsSite
  }

  async save(entity: SaveWmsSiteData): Promise<WmsSite> {
    const { data, error } = await this.client
      .from("wms_sites")
      .upsert({
        wms_vendor_id: entity.wms_vendor_id,
        vendor_site_id: entity.vendor_site_id,
        site_name: entity.site_name,
        org_id: entity.org_id,
        location: entity.location || {},
        capacity_kw: entity.capacity_kw,
      }, { onConflict: "wms_vendor_id,vendor_site_id" })
      .select()
      .single()

    if (error) throw error
    return data as WmsSite
  }

  async saveAll(entities: SaveWmsSiteData[]): Promise<WmsSite[]> {
    if (entities.length === 0) return []

    const { data, error } = await this.client
      .from("wms_sites")
      .upsert(entities.map(e => ({
        wms_vendor_id: e.wms_vendor_id,
        vendor_site_id: e.vendor_site_id,
        site_name: e.site_name,
        org_id: e.org_id,
        location: e.location || {},
        capacity_kw: e.capacity_kw,
      })), { onConflict: "wms_vendor_id,vendor_site_id" })
      .select()

    if (error) throw error
    return (data || []) as WmsSite[]
  }

  async deleteById(id: number): Promise<void> {
    const { error } = await this.client.from("wms_sites").delete().eq("id", id)
    if (error) throw error
  }
}

