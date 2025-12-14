/**
 * Legacy WMS Sites Adapter - Main DB
 * 
 * Phase 12 - Feature Toggle Support
 */

import { SupabaseClient } from "@supabase/supabase-js"
import type { WmsSite, WmsSiteWithRelations, SaveWmsSiteData, IWmsSitesRepository } from "../wmsSitesRepository"

export class LegacyWmsSitesAdapter implements IWmsSitesRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAllWithRelations(): Promise<WmsSiteWithRelations[]> {
    const { data, error } = await this.client.from("wms_sites").select(`*, wms_vendors (id, name, vendor_type), organizations (id, name), wms_devices (count)`).order("site_name", { ascending: true })
    if (error) throw error
    return (data || []).map((site: any) => ({ ...site, device_count: site.wms_devices?.length || 0, wms_devices: undefined })) as WmsSiteWithRelations[]
  }

  async findByVendorIdWithRelations(vendorId: number): Promise<WmsSiteWithRelations[]> {
    const { data, error } = await this.client.from("wms_sites").select(`*, wms_vendors (id, name, vendor_type), organizations (id, name), wms_devices (count)`).eq("wms_vendor_id", vendorId).order("site_name", { ascending: true })
    if (error) throw error
    return (data || []).map((site: any) => ({ ...site, device_count: site.wms_devices?.length || 0, wms_devices: undefined })) as WmsSiteWithRelations[]
  }

  async findByOrgIdWithRelations(orgId: number): Promise<WmsSiteWithRelations[]> {
    const { data, error } = await this.client.from("wms_sites").select(`*, wms_vendors (id, name, vendor_type), organizations (id, name), wms_devices (count)`).eq("org_id", orgId).order("site_name", { ascending: true })
    if (error) throw error
    return (data || []).map((site: any) => ({ ...site, device_count: site.wms_devices?.length || 0, wms_devices: undefined })) as WmsSiteWithRelations[]
  }

  async findById(id: number): Promise<WmsSite | null> {
    const { data, error } = await this.client.from("wms_sites").select("*").eq("id", id).single()
    if (error) { if (error.code === "PGRST116") return null; throw error }
    return data as WmsSite
  }

  async findByVendorSiteId(vendorId: number, vendorSiteId: string): Promise<WmsSite | null> {
    const { data, error } = await this.client.from("wms_sites").select("*").eq("wms_vendor_id", vendorId).eq("vendor_site_id", vendorSiteId).single()
    if (error) { if (error.code === "PGRST116") return null; throw error }
    return data as WmsSite
  }

  async save(entity: SaveWmsSiteData): Promise<WmsSite> {
    const { data, error } = await this.client.from("wms_sites").upsert({ wms_vendor_id: entity.wms_vendor_id, vendor_site_id: entity.vendor_site_id, site_name: entity.site_name, org_id: entity.org_id, location: entity.location || {}, capacity_kw: entity.capacity_kw }, { onConflict: "wms_vendor_id,vendor_site_id" }).select().single()
    if (error) throw error
    return data as WmsSite
  }

  async saveAll(entities: SaveWmsSiteData[]): Promise<WmsSite[]> {
    if (entities.length === 0) return []
    const { data, error } = await this.client.from("wms_sites").upsert(entities.map(e => ({ wms_vendor_id: e.wms_vendor_id, vendor_site_id: e.vendor_site_id, site_name: e.site_name, org_id: e.org_id, location: e.location || {}, capacity_kw: e.capacity_kw })), { onConflict: "wms_vendor_id,vendor_site_id" }).select()
    if (error) throw error
    return (data || []) as WmsSite[]
  }

  async deleteById(id: number): Promise<void> {
    const { error } = await this.client.from("wms_sites").delete().eq("id", id)
    if (error) throw error
  }
}

