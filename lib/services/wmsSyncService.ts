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
 * Exported for use in per-vendor sync endpoints
 */
export async function syncWmsVendorSites(
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
 * Sync devices only (re-fetch sites and update devices without updating sites)
 * Exported for use in per-vendor device sync endpoints
 */
export async function syncWmsVendorDevices(
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

    // Get existing sites from database
    const { data: existingSites } = await supabase
      .from("wms_sites")
      .select("id, vendor_site_id")
      .eq("wms_vendor_id", vendor.id)

    if (!existingSites || existingSites.length === 0) {
      result.success = true
      logger.info(
        `[WMS Device Sync] No sites found for vendor ${vendor.name}. Please sync sites first.`
      )
      return result
    }

    // Create adapter and authenticate
    const adapter = getWmsAdapter(vendor)
    adapter.setTokenStorage(vendor.id, supabase)
    await adapter.authenticate()

    // Fetch sites from vendor API
    const sites = await adapter.listSites()
    result.sitesSynced = sites.length

    // Create a map of vendor_site_id -> site_id for quick lookup
    const siteIdMap = new Map<string, number>()
    for (const existingSite of existingSites) {
      siteIdMap.set(existingSite.vendor_site_id, existingSite.id)
    }

    // Sync devices from each site (without updating sites)
    for (const site of sites) {
      const siteId = siteIdMap.get(site.vendorSiteId)
      if (!siteId) {
        logger.warn(
          `[WMS Device Sync] Site ${site.vendorSiteId} not found in database. Skipping devices.`
        )
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
            .eq("wms_site_id", siteId)
            .eq("vendor_device_id", device.vendorDeviceId)
            .single()

          const deviceData = {
            wms_site_id: siteId,
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

    result.success = true
    const duration = Date.now() - startTime
    logger.info(
      `[WMS Device Sync] Vendor ${vendor.name} (${vendor.id}): ${result.devicesSynced} devices synced (${result.devicesCreated} created, ${result.devicesUpdated} updated) in ${duration}ms`
    )
  } catch (error: any) {
    result.error = error.message
    logger.error(
      `[WMS Device Sync] Error syncing devices for vendor ${vendor.name} (${vendor.id}): ${error.message}`,
      { error }
    )
  }

  return result
}

/**
 * Sync insolation data for a single WMS device
 * For INTELLO, this syncs per-device (vendor supports per-device only)
 * @param deviceId - Device ID
 * @param date - Date to sync (YYYY-MM-DD). If null, backfills last 100 days
 * @param supabase - Supabase client
 */
export async function syncWmsDeviceInsolation(
  deviceId: number,
  date: string | null,
  supabase: any
): Promise<{ success: boolean; readingsCreated: number; readingsUpdated: number; error?: string }> {
  const startTime = Date.now()
  const result = {
    success: false,
    readingsCreated: 0,
    readingsUpdated: 0,
  }

  try {
    // Get device with site and vendor info
    const { data: device, error: deviceError } = await supabase
      .from("wms_devices")
      .select(
        `
        id,
        vendor_device_id,
        wms_site_id,
        wms_sites!inner (
          id,
          vendor_site_id,
          wms_vendor_id,
          wms_vendors!inner (
            id,
            name,
            vendor_type,
            org_id,
            credentials,
            is_active
          )
        )
      `
      )
      .eq("id", deviceId)
      .single()

    if (deviceError || !device) {
      logger.error(`[WMS Insolation Sync] Device ${deviceId} not found in database`, { deviceError })
      throw new Error("Device not found")
    }

    logger.info(
      `[WMS Insolation Sync] Found device: ${device.vendor_device_id} (DB ID: ${device.id}), Site: ${device.wms_sites.vendor_site_id}`
    )

    const vendor = device.wms_sites.wms_vendors

    if (!vendor.is_active) {
      throw new Error(`Vendor ${vendor.name} is not active`)
    }

    // Create adapter and authenticate
    const adapter = getWmsAdapter(vendor)
    adapter.setTokenStorage(vendor.id, supabase)
    await adapter.authenticate()

    // Determine dates to sync
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Start of today
    
    let datesToSync: string[] = []
    
    if (date) {
      // Single date sync (for cron)
      datesToSync = [date]
      logger.info(`[WMS Insolation Sync] Starting insolation sync for device ID: ${deviceId}, date: ${date}`)
    } else {
      // Backfill last 100 days (for manual sync)
      logger.info(`[WMS Insolation Sync] Starting backfill for device ID: ${deviceId} (last 100 days)`)
      for (let daysAgo = 1; daysAgo <= 100; daysAgo++) {
        const targetDate = new Date(today)
        targetDate.setDate(targetDate.getDate() - daysAgo)
        datesToSync.push(targetDate.toISOString().split("T")[0])
      }
      logger.info(`[WMS Insolation Sync] Will sync ${datesToSync.length} days (from ${datesToSync[datesToSync.length - 1]} to ${datesToSync[0]})`)
    }

    // Sync each date
    for (const targetDate of datesToSync) {
      try {
        logger.info(`[WMS Insolation Sync] Fetching insolation data for device ${device.vendor_device_id} for date ${targetDate}`)
        const readings = await adapter.getInsolationData(device.vendor_device_id, targetDate, targetDate)

        if (!readings || readings.length === 0) {
          logger.warn(`[WMS Insolation Sync] No readings for device ${device.vendor_device_id} on ${targetDate}`)
          continue
        }

        const dailyInsolation = adapter.calculateDailyInsolation(readings)
        logger.info(`[WMS Insolation Sync] Calculated daily insolation: ${dailyInsolation.toFixed(4)} kWh/m² from ${readings.length} readings for ${targetDate}`)

        // Check if reading already exists
        const { data: existingReading } = await supabase
          .from("insolation_readings")
          .select("id")
          .eq("wms_device_id", device.id)
          .eq("reading_date", targetDate)
          .single()

        const readingData = {
          wms_device_id: device.id,
          reading_date: targetDate,
          insolation_value: dailyInsolation,
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
          logger.info(`[WMS Insolation Sync] Updated existing reading for device ${device.vendor_device_id} on ${targetDate}`)
        } else {
          await supabase.from("insolation_readings").insert(readingData)
          result.readingsCreated++
          logger.info(`[WMS Insolation Sync] Created new reading for device ${device.vendor_device_id} on ${targetDate}`)
        }
      } catch (dayError: any) {
        logger.warn(
          `[WMS Insolation Sync] Error syncing device ${device.vendor_device_id} for ${targetDate}: ${dayError.message}`
        )
        // Continue with other days
      }
    }

    result.success = true
    const duration = Date.now() - startTime
    logger.info(
      `[WMS Insolation Sync] Device ${device.vendor_device_id} (ID: ${deviceId}) insolation synced successfully: ${result.readingsCreated + result.readingsUpdated} readings (${result.readingsCreated} created, ${result.readingsUpdated} updated) in ${duration}ms`
    )
  } catch (error: any) {
    logger.error(
      `[WMS Insolation Sync] Error syncing insolation for device ${deviceId}: ${error.message}`,
      { error, deviceId, date }
    )
    return { ...result, error: error.message }
  }

  return result
}

/**
 * Sync a single device by re-fetching its site and updating the device metadata
 * NOTE: This is for device metadata sync, not insolation. Use syncWmsDeviceInsolation() for insolation.
 */
export async function syncWmsDevice(
  deviceId: number,
  supabase: any
): Promise<{ success: boolean; deviceUpdated: boolean; error?: string }> {
  const startTime = Date.now()
  
  try {
    logger.info(`[WMS Device Sync] Starting sync for device ID: ${deviceId}`)
    
    // Get device with site and vendor info
    logger.info(`[WMS Device Sync] Fetching device ${deviceId} with site and vendor information`)
    const { data: device, error: deviceError } = await supabase
      .from("wms_devices")
      .select(
        `
        id,
        vendor_device_id,
        wms_site_id,
        wms_sites!inner (
          id,
          vendor_site_id,
          wms_vendor_id,
          wms_vendors!inner (
            id,
            name,
            vendor_type,
            org_id,
            credentials,
            is_active
          )
        )
      `
      )
      .eq("id", deviceId)
      .single()

    if (deviceError || !device) {
      logger.error(`[WMS Device Sync] Device ${deviceId} not found in database`, { deviceError })
      throw new Error("Device not found")
    }

    logger.info(
      `[WMS Device Sync] Found device: ${device.vendor_device_id} (DB ID: ${device.id}), Site: ${device.wms_sites.vendor_site_id} (DB ID: ${device.wms_sites.id})`
    )

    const vendor = device.wms_sites.wms_vendors
    const site = device.wms_sites

    logger.info(
      `[WMS Device Sync] Vendor: ${vendor.name} (ID: ${vendor.id}, Type: ${vendor.vendor_type}), Org ID: ${vendor.org_id}`
    )

    if (!vendor.is_active) {
      logger.warn(`[WMS Device Sync] Vendor ${vendor.name} is not active`)
    }

    // Create adapter and authenticate
    logger.info(`[WMS Device Sync] Creating adapter for vendor type: ${vendor.vendor_type}`)
    const adapter = getWmsAdapter(vendor)
    adapter.setTokenStorage(vendor.id, supabase)
    
    logger.info(`[WMS Device Sync] Authenticating with vendor API`)
    await adapter.authenticate()
    logger.info(`[WMS Device Sync] Authentication successful`)

    // Fetch sites from vendor API
    logger.info(`[WMS Device Sync] Fetching sites from vendor API`)
    const sites = await adapter.listSites()
    logger.info(`[WMS Device Sync] Retrieved ${sites.length} sites from vendor API`)
    
    const vendorSite = sites.find((s) => s.vendorSiteId === site.vendor_site_id)

    if (!vendorSite) {
      logger.error(
        `[WMS Device Sync] Site ${site.vendor_site_id} not found in vendor API response. Available sites: ${sites.map(s => s.vendorSiteId).join(", ")}`
      )
      throw new Error(`Site ${site.vendor_site_id} not found in vendor API`)
    }

    logger.info(
      `[WMS Device Sync] Found site ${vendorSite.vendorSiteId} (${vendorSite.siteName}) in vendor API`
    )

    // Extract devices from site
    if (adapter instanceof IntelloAdapter) {
      logger.info(`[WMS Device Sync] Extracting devices from site ${vendorSite.vendorSiteId}`)
      const devices = adapter.extractDevicesFromSite(vendorSite)
      logger.info(
        `[WMS Device Sync] Found ${devices.length} devices in site: ${devices.map(d => d.vendorDeviceId).join(", ")}`
      )
      
      const vendorDevice = devices.find(
        (d) => d.vendorDeviceId === device.vendor_device_id
      )

      if (!vendorDevice) {
        logger.error(
          `[WMS Device Sync] Device ${device.vendor_device_id} not found in site ${site.vendor_site_id}. Available devices: ${devices.map(d => d.vendorDeviceId).join(", ")}`
        )
        throw new Error(
          `Device ${device.vendor_device_id} not found in site ${site.vendor_site_id}`
        )
      }

      logger.info(
        `[WMS Device Sync] Found device ${vendorDevice.vendorDeviceId} in vendor API. Name: ${vendorDevice.deviceName || "N/A"}, MAC: ${vendorDevice.macAddress || "N/A"}, Serial: ${vendorDevice.serialNo || "N/A"}`
      )

      // Update device
      const deviceData = {
        device_name: vendorDevice.deviceName,
        mac_address: vendorDevice.macAddress,
        serial_no: vendorDevice.serialNo,
        metadata: vendorDevice.metadata || {},
      }

      logger.info(
        `[WMS Device Sync] Updating device ${deviceId} in database with new data`
      )
      const { error: updateError } = await supabase
        .from("wms_devices")
        .update(deviceData)
        .eq("id", deviceId)

      if (updateError) {
        logger.error(
          `[WMS Device Sync] Database update failed for device ${deviceId}`,
          { updateError }
        )
        throw updateError
      }

      const duration = Date.now() - startTime
      logger.info(
        `[WMS Device Sync] Device ${device.vendor_device_id} (ID: ${deviceId}) synced successfully in ${duration}ms`
      )

      return { success: true, deviceUpdated: true }
    }

    logger.error(`[WMS Device Sync] Unsupported adapter type: ${vendor.vendor_type}`)
    throw new Error("Unsupported adapter type")
  } catch (error: any) {
    const duration = Date.now() - startTime
    logger.error(
      `[WMS Device Sync] Error syncing device ${deviceId} after ${duration}ms: ${error.message}`,
      { error, deviceId }
    )
    return { success: false, deviceUpdated: false, error: error.message }
  }
}

/**
 * Sync insolation data for all devices of a WMS vendor
 * Exported for use in per-vendor sync endpoints
 * @param vendor - WMS vendor
 * @param supabase - Supabase client
 * @param date - Date to sync (YYYY-MM-DD). If null, backfills last 100 days for all devices
 */
export async function syncWmsVendorInsolation(
  vendor: any,
  supabase: any,
  date: string | null = null
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

        // Calculate daily insolation (area under curve, in kWh/m²)
        const dailyInsolation = adapter.calculateDailyInsolation(readings)

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
          insolation_value: dailyInsolation,
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

          const dailyInsolation = adapter.calculateDailyInsolation(readings)

          const { data: existingReading } = await supabase
            .from("insolation_readings")
            .select("id")
            .eq("wms_device_id", device.id)
            .eq("reading_date", dateStr)
            .single()

          const readingData = {
            wms_device_id: device.id,
            reading_date: dateStr,
            insolation_value: dailyInsolation,
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
      source: "cron",
      operation: "sync-wms-sites",
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
 * @param date - Date to sync (YYYY-MM-DD), required. For cron: today (end of day) or yesterday (morning)
 */
export async function syncAllWmsInsolation(date: string): Promise<InsolationSyncResult[]> {
  return MDC.runAsync(
    {
      source: "cron",
      operation: "sync-wms-insolation",
    },
    async () => {
      const supabase = getMainClient()
      const results: InsolationSyncResult[] = []

      logger.info(`[WMS Insolation Sync] Starting insolation sync for all WMS vendors, date: ${date}`)

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
      source: "cron",
      operation: "backfill-wms-insolation",
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

