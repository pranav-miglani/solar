/**
 * Legacy WMS Devices Adapter - Main DB
 * 
 * Phase 13 - Feature Toggle Support
 */

import { SupabaseClient } from "@supabase/supabase-js"
import type { WmsDevice, WmsDeviceWithRelations, SaveWmsDeviceData, IWmsDevicesRepository } from "../wmsDevicesRepository"

export class LegacyWmsDevicesAdapter implements IWmsDevicesRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAllWithRelations(): Promise<WmsDeviceWithRelations[]> {
    const { data, error } = await this.client.from("wms_devices").select(`*, wms_sites!inner (id, site_name, vendor_site_id, org_id, wms_vendor_id, wms_vendors!inner (id, name, vendor_type), organizations (id, name))`).order("device_name", { ascending: true })
    if (error) throw error
    return (data || []) as WmsDeviceWithRelations[]
  }

  async findBySiteIdWithRelations(siteId: number): Promise<WmsDeviceWithRelations[]> {
    const { data, error } = await this.client.from("wms_devices").select(`*, wms_sites!inner (id, site_name, vendor_site_id, org_id, wms_vendor_id, wms_vendors!inner (id, name, vendor_type), organizations (id, name))`).eq("wms_site_id", siteId).order("device_name", { ascending: true })
    if (error) throw error
    return (data || []) as WmsDeviceWithRelations[]
  }

  async findByVendorIdWithRelations(vendorId: number): Promise<WmsDeviceWithRelations[]> {
    const { data, error } = await this.client.from("wms_devices").select(`*, wms_sites!inner (id, site_name, vendor_site_id, org_id, wms_vendor_id, wms_vendors!inner (id, name, vendor_type), organizations (id, name))`).eq("wms_sites.wms_vendor_id", vendorId).order("device_name", { ascending: true })
    if (error) throw error
    return (data || []) as WmsDeviceWithRelations[]
  }

  async findByOrgIdWithRelations(orgId: number): Promise<WmsDeviceWithRelations[]> {
    const { data, error } = await this.client.from("wms_devices").select(`*, wms_sites!inner (id, site_name, vendor_site_id, org_id, wms_vendor_id, wms_vendors!inner (id, name, vendor_type), organizations (id, name))`).eq("wms_sites.org_id", orgId).order("device_name", { ascending: true })
    if (error) throw error
    return (data || []) as WmsDeviceWithRelations[]
  }

  async findById(id: number): Promise<WmsDevice | null> {
    const { data, error } = await this.client.from("wms_devices").select("*").eq("id", id).single()
    if (error) { if (error.code === "PGRST116") return null; throw error }
    return data as WmsDevice
  }

  async findByVendorDeviceId(siteId: number, vendorDeviceId: string): Promise<WmsDevice | null> {
    const { data, error } = await this.client.from("wms_devices").select("*").eq("wms_site_id", siteId).eq("vendor_device_id", vendorDeviceId).single()
    if (error) { if (error.code === "PGRST116") return null; throw error }
    return data as WmsDevice
  }

  async save(entity: SaveWmsDeviceData): Promise<WmsDevice> {
    const { data, error } = await this.client.from("wms_devices").upsert({ wms_site_id: entity.wms_site_id, vendor_device_id: entity.vendor_device_id, device_name: entity.device_name, device_type: entity.device_type }, { onConflict: "wms_site_id,vendor_device_id" }).select().single()
    if (error) throw error
    return data as WmsDevice
  }

  async saveAll(entities: SaveWmsDeviceData[]): Promise<WmsDevice[]> {
    if (entities.length === 0) return []
    const { data, error } = await this.client.from("wms_devices").upsert(entities.map(e => ({ wms_site_id: e.wms_site_id, vendor_device_id: e.vendor_device_id, device_name: e.device_name, device_type: e.device_type })), { onConflict: "wms_site_id,vendor_device_id" }).select()
    if (error) throw error
    return (data || []) as WmsDevice[]
  }

  async deleteById(id: number): Promise<void> {
    const { error } = await this.client.from("wms_devices").delete().eq("id", id)
    if (error) throw error
  }
}

