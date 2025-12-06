import { IntelloAdapter } from "@/lib/wms/intelloAdapter"
import type { WmsVendorConfig, WmsSite, WmsDevice } from "@/lib/wms/baseWmsAdapter"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { getMainClient } from "@/lib/supabase/pooled"

/**
 * WMS Sync Service
 * Generic service for syncing WMS sites, devices, and insolation data
 */

interface SiteSyncResult {
  wmsVendorId: number
  wmsVendorName: string
  orgId: number
  orgName?: string
  success: boolean
  sitesSynced: number
  sitesCreated: number
  sitesUpdated: number
  devicesSynced: number
  devicesCreated: number
  devicesUpdated: number
  error?: string
}

interface InsolationSyncResult {
  wmsVendorId: number
  wmsVendorName: string
  orgId: number
  success: boolean
  devicesSynced: number
  readingsCreated: number
  readingsUpdated: number
  error?: string
}

interface SyncSummary {
  totalVendors: number
  successful: number
  failed: number
  totalSitesSynced: number
  totalDevicesSynced: number
  results: SiteSyncResult[]
  duration: number
}

/**
 * Get WMS adapter instance for a vendor
 */
function getWmsAdapter(vendor: any): IntelloAdapter {
  const config: WmsVendorConfig = {
    id: vendor.id,
    name: vendor.name,
    vendorType: vendor.vendor_type,
    credentials: vendor.credentials,
    isActive: vendor.is_active,
    orgId: vendor.org_id,
  }

  switch (vendor.vendor_type) {
    case "INTELLO":
      return new IntelloAdapter(config)
    default:
      throw new Error(`Unsupported WMS vendor type: ${vendor.vendor_type}`)
  }
}

/**
 * Sync sites and devices for a single WMS vendor
 */
async function syncWmsVendorSites(
  vendor: any,
  supabase: any
): Promise<SiteSyncResult> {
  const startTime = Date.now()
  const result: SiteSyncResult = {
    wmsVendorId: vendor.id,
    wmsVendorName: vendor.name,
    orgId: vendor.org_id,
    success: false,
    sitesSynced: 0,
    sitesCreated: 0,
    sitesUpdated: 0,
    devicesSynced: 0,
    devicesCreated: 0,
    devicesUpdated: 0,
  }

  try {
    // Get organization name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", vendor.org_id)
      .single()

    result.orgName = org?.name

    // Get adapter
    const adapter = getWmsAdapter(vendor)
    adapter.setTokenStorage(vendor.id, supabase)

    // Authenticate
    await adapter.authenticate()

    // Fetch sites from vendor
    const sites = await adapter.listSites()
    result.sitesSynced = sites.length

    // Sync each site
    for (const site of sites) {
      // Upsert site
      const { data: existingSite, error: siteError } = await supabase
        .from("wms_sites")
        .select("id")
        .eq("wms_vendor_id", vendor.id)
        .eq("vendor_site_id", site.vendorSiteId)
        .single()

      if (siteError && siteError.code !== "PGRST116") {
        // PGRST116 = not found, which is OK
        throw siteError
      }

      const siteData = {
        wms_vendor_id: vendor.id,
        org_id: vendor.org_id,
        vendor_site_id: site.vendorSiteId,
        site_name: site.siteName,
        address: site.address,
        latitude: site.latitude,
        longitude: site.longitude,
        location: site.location,
        elevation: site.elevation,
        status: site.status,
        panel_count: site.panelCount,
        panel_wattage: site.panelWattage,
        created_date: site.createdDate,
        installer_type: site.installerType,
        metadata: site.metadata || {},
      }

      if (existingSite) {
        // Update existing site
        await supabase
          .from("wms_sites")
          .update(siteData)
          .eq("id", existingSite.id)
        result.sitesUpdated++
      } else {
        // Create new site
        await supabase.from("wms_sites").insert(siteData)
        result.sitesCreated++
      }

      // Get site ID for device sync
      const { data: syncedSite } = await supabase
        .from("wms_sites")
        .select("id")
        .eq("wms_vendor_id", vendor.id)
        .eq("vendor_site_id", site.vendorSiteId)
        .single()

      if (!syncedSite) {
        logger.warn(`[WMS Sync] Site not found after sync: ${site.vendorSiteId}`)
        continue
      }

      // Extract and sync devices
      if (adapter instanceof IntelloAdapter) {
        const devices = adapter.extractDevicesFromSite(site)
        result.devicesSynced += devices.length

        for (const device of devices) {
          // Upsert device
          const { data: existingDevice } = await supabase
            .from("wms_devices")
            .select("id")
            .eq("wms_site_id", syncedSite.id)
            .eq("vendor_device_id", device.vendorDeviceId)
            .single()

          const deviceData = {
            wms_site_id: syncedSite.id,
            vendor_device_id: device.vendorDeviceId,
            device_name: device.deviceName,
            mac_address: device.macAddress,
            serial_no: device.serialNo,
            metadata: device.metadata || {},
          }

          if (existingDevice) {
            await supabase
              .from("wms_devices")
              .update(deviceData)
              .eq("id", existingDevice.id)
            result.devicesUpdated++
          } else {
            await supabase.from("wms_devices").insert(deviceData)
            result.devicesCreated++
          }
        }
      }
    }

    // Update last_sites_synced_at
    await supabase
      .from("wms_vendors")
      .update({ last_sites_synced_at: new Date().toISOString() })
      .eq("id", vendor.id)

    result.success = true
    const duration = Date.now() - startTime
    logger.info(
      `[WMS Sync] Vendor ${vendor.name} (${vendor.id}): ${result.sitesSynced} sites, ${result.devicesSynced} devices synced in ${duration}ms`
    )
  } catch (error: any) {
    result.error = error.message
    logger.error(
      `[WMS Sync] Error syncing vendor ${vendor.name} (${vendor.id}): ${error.message}`,
      { error }
    )
  }

  return result
}

/**
 * Sync insolation data for all devices of a WMS vendor
 * @param date - Date to sync (YYYY-MM-DD), defaults to yesterday
 */
async function syncWmsVendorInsolation(
  vendor: any,
  supabase: any,
  date?: string
): Promise<InsolationSyncResult> {
  const startTime = Date.now()
  const result: InsolationSyncResult = {
    wmsVendorId: vendor.id,
    wmsVendorName: vendor.name,
    orgId: vendor.org_id,
    success: false,
    devicesSynced: 0,
    readingsCreated: 0,
    readingsUpdated: 0,
  }

  try {
    // Use provided date or default to yesterday
    const targetDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0]

    // Get adapter
    const adapter = getWmsAdapter(vendor)
    adapter.setTokenStorage(vendor.id, supabase)

    // Authenticate
    await adapter.authenticate()

    // Get all devices for this vendor
    const { data: devices, error: devicesError } = await supabase
      .from("wms_devices")
      .select(`
        id,
        vendor_device_id,
        wms_sites!inner (
          wms_vendor_id
        )
      `)
      .eq("wms_sites.wms_vendor_id", vendor.id)

    if (devicesError) {
      throw devicesError
    }

    if (!devices || devices.length === 0) {
      logger.info(`[WMS Insolation Sync] No devices found for vendor ${vendor.name}`)
      result.success = true
      return result
    }

    // Sync insolation for each device
    for (const device of devices) {
      try {
        // Fetch insolation data from vendor
        const readings = await adapter.getInsolationData(
          device.vendor_device_id,
          targetDate,
          targetDate
        )

        if (!readings || readings.length === 0) {
          logger.warn(
            `[WMS Insolation Sync] No readings for device ${device.vendor_device_id} on ${targetDate}`
          )
          continue
        }

        // Calculate average insolation
        const averageInsolation = adapter.calculateAverageInsolation(readings)

        // Upsert insolation reading
        const { data: existingReading } = await supabase
          .from("insolation_readings")
          .select("id")
          .eq("wms_device_id", device.id)
          .eq("reading_date", targetDate)
          .single()

        const readingData = {
          wms_device_id: device.id,
          reading_date: targetDate,
          insolation_value: averageInsolation,
          reading_count: readings.length,
          metadata: {
            hourly_readings: readings,
            min_irr: Math.min(...readings.map(r => r.irr)),
            max_irr: Math.max(...readings.map(r => r.irr)),
          },
        }

        if (existingReading) {
          await supabase
            .from("insolation_readings")
            .update(readingData)
            .eq("id", existingReading.id)
          result.readingsUpdated++
        } else {
          await supabase.from("insolation_readings").insert(readingData)
          result.readingsCreated++
        }

        result.devicesSynced++
      } catch (deviceError: any) {
        logger.error(
          `[WMS Insolation Sync] Error syncing device ${device.vendor_device_id}: ${deviceError.message}`,
          { error: deviceError }
        )
        // Continue with other devices
      }
    }

    // Update last_insolation_synced_at
    await supabase
      .from("wms_vendors")
      .update({ last_insolation_synced_at: new Date().toISOString() })
      .eq("id", vendor.id)

    result.success = true
    const duration = Date.now() - startTime
    logger.info(
      `[WMS Insolation Sync] Vendor ${vendor.name} (${vendor.id}): ${result.devicesSynced} devices synced, ${result.readingsCreated + result.readingsUpdated} readings in ${duration}ms`
    )
  } catch (error: any) {
    result.error = error.message
    logger.error(
      `[WMS Insolation Sync] Error syncing vendor ${vendor.name} (${vendor.id}): ${error.message}`,
      { error }
    )
  }

  return result
}

/**
 * Sync insolation for last 100 days (backfill)
 */
async function backfillInsolationData(
  vendor: any,
  supabase: any
): Promise<InsolationSyncResult> {
  const result: InsolationSyncResult = {
    wmsVendorId: vendor.id,
    wmsVendorName: vendor.name,
    orgId: vendor.org_id,
    success: false,
    devicesSynced: 0,
    readingsCreated: 0,
    readingsUpdated: 0,
  }

  try {
    // Get all devices for this vendor
    const { data: devices } = await supabase
      .from("wms_devices")
      .select(`
        id,
        vendor_device_id,
        wms_sites!inner (
          wms_vendor_id
        )
      `)
      .eq("wms_sites.wms_vendor_id", vendor.id)

    if (!devices || devices.length === 0) {
      result.success = true
      return result
    }

    const adapter = getWmsAdapter(vendor)
    adapter.setTokenStorage(vendor.id, supabase)
    await adapter.authenticate()

    // Sync for last 100 days
    const today = new Date()
    for (let daysAgo = 0; daysAgo < 100; daysAgo++) {
      const targetDate = new Date(today)
      targetDate.setDate(targetDate.getDate() - daysAgo)
      const dateStr = targetDate.toISOString().split("T")[0]

      logger.info(`[WMS Backfill] Syncing ${dateStr} for vendor ${vendor.name}`)

      for (const device of devices) {
        try {
          const readings = await adapter.getInsolationData(
            device.vendor_device_id,
            dateStr,
            dateStr
          )

          if (!readings || readings.length === 0) {
            continue
          }

          const averageInsolation = adapter.calculateAverageInsolation(readings)

          const { data: existingReading } = await supabase
            .from("insolation_readings")
            .select("id")
            .eq("wms_device_id", device.id)
            .eq("reading_date", dateStr)
            .single()

          const readingData = {
            wms_device_id: device.id,
            reading_date: dateStr,
            insolation_value: averageInsolation,
            reading_count: readings.length,
            metadata: {
              hourly_readings: readings,
              min_irr: Math.min(...readings.map(r => r.irr)),
              max_irr: Math.max(...readings.map(r => r.irr)),
            },
          }

          if (existingReading) {
            await supabase
              .from("insolation_readings")
              .update(readingData)
              .eq("id", existingReading.id)
            result.readingsUpdated++
          } else {
            await supabase.from("insolation_readings").insert(readingData)
            result.readingsCreated++
          }
        } catch (deviceError: any) {
          logger.warn(
            `[WMS Backfill] Error syncing device ${device.vendor_device_id} for ${dateStr}: ${deviceError.message}`
          )
        }
      }
    }

    result.success = true
    logger.info(
      `[WMS Backfill] Vendor ${vendor.name}: ${result.readingsCreated + result.readingsUpdated} readings created/updated`
    )
  } catch (error: any) {
    result.error = error.message
    logger.error(
      `[WMS Backfill] Error backfilling vendor ${vendor.name}: ${error.message}`,
      { error }
    )
  }

  return result
}

/**
 * Sync all WMS vendors (sites and devices)
 */
export async function syncAllWmsSites(): Promise<SyncSummary> {
  return MDC.runAsync(
    {
      source: "wms-sync",
      operation: "sync-sites",
    },
    async () => {
      const startTime = Date.now()
      const supabase = getMainClient()
      const results: SiteSyncResult[] = []

      logger.info("[WMS Sync] Starting site sync for all WMS vendors")

      // Get all active WMS vendors
      const { data: vendors, error } = await supabase
        .from("wms_vendors")
        .select("*")
        .eq("is_active", true)

      if (error) {
        throw error
      }

      if (!vendors || vendors.length === 0) {
        logger.info("[WMS Sync] No active WMS vendors found")
        return {
          totalVendors: 0,
          successful: 0,
          failed: 0,
          totalSitesSynced: 0,
          totalDevicesSynced: 0,
          results: [],
          duration: Date.now() - startTime,
        }
      }

      logger.info(`[WMS Sync] Found ${vendors.length} active WMS vendors`)

      // Sync each vendor
      for (const vendor of vendors) {
        const result = await syncWmsVendorSites(vendor, supabase)
        results.push(result)
      }

      const successful = results.filter((r) => r.success).length
      const failed = results.filter((r) => !r.success).length
      const totalSitesSynced = results.reduce((sum, r) => sum + r.sitesSynced, 0)
      const totalDevicesSynced = results.reduce((sum, r) => sum + r.devicesSynced, 0)

      const summary: SyncSummary = {
        totalVendors: vendors.length,
        successful,
        failed,
        totalSitesSynced,
        totalDevicesSynced,
        results,
        duration: Date.now() - startTime,
      }

      logger.info(
        `[WMS Sync] Complete: ${successful}/${vendors.length} vendors successful, ${totalSitesSynced} sites, ${totalDevicesSynced} devices synced in ${summary.duration}ms`
      )

      return summary
    }
  )
}

/**
 * Sync insolation data for all WMS vendors
 * @param date - Optional date to sync (YYYY-MM-DD), defaults to yesterday
 */
export async function syncAllWmsInsolation(date?: string): Promise<InsolationSyncResult[]> {
  return MDC.runAsync(
    {
      source: "wms-sync",
      operation: "sync-insolation",
    },
    async () => {
      const supabase = getMainClient()
      const results: InsolationSyncResult[] = []

      logger.info("[WMS Insolation Sync] Starting insolation sync for all WMS vendors")

      // Get all active WMS vendors
      const { data: vendors, error } = await supabase
        .from("wms_vendors")
        .select("*")
        .eq("is_active", true)

      if (error) {
        throw error
      }

      if (!vendors || vendors.length === 0) {
        logger.info("[WMS Insolation Sync] No active WMS vendors found")
        return []
      }

      // Sync each vendor
      for (const vendor of vendors) {
        const result = await syncWmsVendorInsolation(vendor, supabase, date)
        results.push(result)
      }

      const successful = results.filter((r) => r.success).length
      logger.info(
        `[WMS Insolation Sync] Complete: ${successful}/${vendors.length} vendors successful`
      )

      return results
    }
  )
}

/**
 * Backfill insolation data for last 100 days
 */
export async function backfillAllWmsInsolation(): Promise<InsolationSyncResult[]> {
  return MDC.runAsync(
    {
      source: "wms-sync",
      operation: "backfill-insolation",
    },
    async () => {
      const supabase = getMainClient()
      const results: InsolationSyncResult[] = []

      logger.info("[WMS Backfill] Starting insolation backfill for all WMS vendors")

      // Get all active WMS vendors
      const { data: vendors, error } = await supabase
        .from("wms_vendors")
        .select("*")
        .eq("is_active", true)

      if (error) {
        throw error
      }

      if (!vendors || vendors.length === 0) {
        logger.info("[WMS Backfill] No active WMS vendors found")
        return []
      }

      // Backfill each vendor
      for (const vendor of vendors) {
        const result = await backfillInsolationData(vendor, supabase)
        results.push(result)
      }

      const successful = results.filter((r) => r.success).length
      logger.info(
        `[WMS Backfill] Complete: ${successful}/${vendors.length} vendors successful`
      )

      return results
    }
  )
}

