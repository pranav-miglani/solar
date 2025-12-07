import { VendorManager } from "@/lib/vendors/vendorManager"
import type { VendorConfig, Plant } from "@/lib/vendors/types"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { getMainClient } from "@/lib/supabase/pooled"

/**
 * Plant Sync Service
 * Generic service for syncing plant data from all vendors across all organizations
 */

interface SyncResult {
  vendorId: number
  vendorName: string
  orgId: number
  orgName?: string
  success: boolean
  synced: number
  created: number
  updated: number
  total: number
  error?: string
}

interface SyncSummary {
  totalVendors: number
  successful: number
  failed: number
  totalPlantsSynced: number
  totalPlantsCreated: number
  totalPlantsUpdated: number
  results: SyncResult[]
  duration: number
}

/**
 * Validate and refresh token for a vendor adapter
 */
async function validateAndRefreshToken(
  adapter: any,
  vendorId: number,
  supabase: any
): Promise<boolean> {
  try {
    // Check if adapter supports token storage
    if (typeof adapter.setTokenStorage === "function") {
      adapter.setTokenStorage(vendorId, supabase)
    }

    // Try to authenticate (will use cached token if valid)
    try {
      await adapter.authenticate()
      return true
    } catch (authError: any) {
      console.error(`[Sync] Token validation failed for vendor ${vendorId}:`, authError.message)
      return false
    }
  } catch (error: any) {
    console.error(`[Sync] Error validating token for vendor ${vendorId}:`, error.message)
    return false
  }
}

/**
 * Resolve plant sync mode for a vendor. Defaults are based on vendor_type:
 * - SOLARMAN, SHINEMONITOR -> LIST_PLANTS
 * - SOLARDM, PVBLINK       -> PER_PLANT
 * - FOXESSCLOUD, OTHER     -> LIST_PLANTS
 */
function getPlantSyncMode(vendor: any): 'LIST_PLANTS' | 'PER_PLANT' {
  if (vendor.plant_sync_mode === 'LIST_PLANTS' || vendor.plant_sync_mode === 'PER_PLANT') {
    return vendor.plant_sync_mode
  }

  switch (vendor.vendor_type) {
    case 'SOLARMAN':
    case 'SHINEMONITOR':
      return 'LIST_PLANTS'
    case 'SOLARDM':
    case 'PVBLINK':
      return 'PER_PLANT'
    default:
      return 'LIST_PLANTS'
  }
}

/**
 * Sync plants for a single vendor
 */
async function syncVendorPlants(
  vendor: any,
  supabase: any
): Promise<SyncResult> {
  const startTime = Date.now()
  const result: SyncResult = {
    vendorId: vendor.id,
    vendorName: vendor.name,
    orgId: vendor.org_id,
    success: false,
    synced: 0,
    created: 0,
    updated: 0,
    total: 0,
  }

  try {
    const plantSyncMode = getPlantSyncMode(vendor)
    logger.info(
      `[Sync] Vendor ${vendor.id} (${vendor.name}) using plant_sync_mode=${plantSyncMode}`
    )

    // Get organization name
    if (vendor.org_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", vendor.org_id)
        .single()
      result.orgName = org?.name
    }

            // Create vendor adapter
            // Note: apiBaseUrl is now optional - will be read from environment variables if not provided
            const vendorConfig: VendorConfig = {
              id: vendor.id,
              name: vendor.name,
              vendorType: vendor.vendor_type as "SOLARMAN" | "SOLARDM" | "SHINEMONITOR" | "PVBLINK" | "FOXESSCLOUD" | "OTHER",
              // apiBaseUrl removed - now read from environment variables (e.g., SOLARMAN_API_BASE_URL)
              credentials: vendor.credentials as Record<string, any>,
              isActive: vendor.is_active,
              plantSyncMode,
              perPlantSyncIntervalMinutes: vendor.per_plant_sync_interval_minutes ?? 15,
              plantSyncTimeIst: vendor.plant_sync_time_ist || "02:00",
            }

    const adapter = VendorManager.getAdapter(vendorConfig)

    // For now, the 15‑minute cron only runs full listPlants() sync for LIST_PLANTS mode.
    // Vendors configured for PER_PLANT mode will be handled by a separate per‑plant
    // metrics cron (which can still call listPlants() at configured morning/evening times).
    if (plantSyncMode === "PER_PLANT") {
      logger.info(
        `[Sync] Skipping listPlants() sync for vendor ${vendor.name} (${vendor.id}) because plant_sync_mode=PER_PLANT. ` +
          `Topology and metrics will be refreshed by the per‑plant cron and twice‑daily listPlants() job.`
      )
      result.success = true
      return result
    }

    // Set token storage for adapters that support it
    if (typeof (adapter as any).setTokenStorage === "function") {
      (adapter as any).setTokenStorage(vendor.id, supabase)
    }

    // Validate token (will refresh if needed)
    const tokenValid = await validateAndRefreshToken(adapter, vendor.id, supabase)
    if (!tokenValid) {
      result.error = "Token validation/refresh failed"
      return result
    }

    // Fetch plants from vendor (context automatically propagated) for LIST_PLANTS mode
    logger.info(`Fetching plants for vendor ${vendor.name} (ID: ${vendor.id})`)
    let vendorPlants = await adapter.listPlants()

    if (!vendorPlants || vendorPlants.length === 0) {
      result.success = true
      result.total = 0
      logger.info(`No plants found for vendor ${vendor.name}`)
      return result
    }

    result.total = vendorPlants.length
    logger.info(`Found ${vendorPlants.length} plants for vendor ${vendor.name}`)

    // Check if listPlants() provides live telemetry (current_power_kw, daily_energy_kwh, etc.)
    // If not, optionally fetch it using listPlant() for each plant
    const samplePlant = vendorPlants[0]
    const hasLiveTelemetryInListPlants = samplePlant?.metadata?.currentPowerKw !== undefined ||
      samplePlant?.metadata?.dailyEnergyKwh !== undefined ||
      samplePlant?.metadata?.monthlyEnergyMwh !== undefined

    // If live telemetry is not available in listPlants(), try to fetch it using listPlant()
    // This is optional and can be disabled via environment variable
    const enablePerPlantLiveTelemetry = process.env.ENABLE_PER_PLANT_LIVE_TELEMETRY !== 'false'
    
    if (!hasLiveTelemetryInListPlants && enablePerPlantLiveTelemetry) {
      logger.info(
        `[Sync] Live telemetry not available in listPlants() for vendor ${vendor.name}, ` +
        `attempting to fetch via listPlant() for ${vendorPlants.length} plants`
      )

      // Fetch live telemetry for each plant in parallel (batched)
      const LIVE_TELEMETRY_BATCH_SIZE = 20 // Smaller batch size to avoid overwhelming vendor API
      const enrichedPlants: Plant[] = []

      for (let i = 0; i < vendorPlants.length; i += LIVE_TELEMETRY_BATCH_SIZE) {
        const batch = vendorPlants.slice(i, i + LIVE_TELEMETRY_BATCH_SIZE)
        const batchNumber = Math.floor(i / LIVE_TELEMETRY_BATCH_SIZE) + 1

        logger.info(
          `[Sync] Fetching live telemetry for batch ${batchNumber} (${batch.length} plants)`
        )

        const batchPromises = batch.map(async (plant) => {
          try {
            const enrichedPlant = await adapter.listPlant(plant.id)
            if (enrichedPlant && enrichedPlant.metadata) {
              // Merge live telemetry from listPlant() into plant metadata
              return {
                ...plant,
                metadata: {
                  ...plant.metadata,
                  ...enrichedPlant.metadata,
                },
              }
            }
            return plant
          } catch (error: any) {
            // If listPlant() fails, use the plant from listPlants() as-is
            logger.debug(
              `[Sync] listPlant() failed for plant ${plant.id}, using data from listPlants(): ${error.message}`
            )
            return plant
          }
        })

        const batchResults = await Promise.all(batchPromises)
        enrichedPlants.push(...batchResults)
      }

      vendorPlants = enrichedPlants
      logger.info(
        `[Sync] Enriched ${vendorPlants.length} plants with live telemetry data`
      )
    }

    // Prepare plant data for upsert
    // All these fields are refreshed on every sync to keep data up-to-date
    const plantDataArray = vendorPlants.map((plant) => {
      const metadata = plant.metadata || {}
      
      // Handle timestamps - they should already be ISO strings from adapter
      // But handle both cases: ISO string or Unix timestamp (seconds)
      let lastUpdateTime: string | null = null
      if (metadata.lastUpdateTime) {
        if (typeof metadata.lastUpdateTime === 'string') {
          // Already ISO string
          lastUpdateTime = metadata.lastUpdateTime
        } else if (typeof metadata.lastUpdateTime === 'number') {
          // Unix timestamp in seconds - convert to ISO
          lastUpdateTime = new Date(metadata.lastUpdateTime * 1000).toISOString()
        }
      }
      
      let createdDate: string | null = null
      if (metadata.createdDate) {
        if (typeof metadata.createdDate === 'string') {
          // Already ISO string
          createdDate = metadata.createdDate
        } else if (typeof metadata.createdDate === 'number') {
          // Unix timestamp in seconds - convert to ISO
          createdDate = new Date(metadata.createdDate * 1000).toISOString()
        }
      }
      
      let startOperatingTime: string | null = null
      if (metadata.startOperatingTime) {
        if (typeof metadata.startOperatingTime === 'string') {
          // Already ISO string
          startOperatingTime = metadata.startOperatingTime
        } else if (typeof metadata.startOperatingTime === 'number') {
          // Unix timestamp in seconds - convert to ISO
          startOperatingTime = new Date(metadata.startOperatingTime * 1000).toISOString()
        }
      }

      // Ensure location.address is included
      const location = plant.location || {}
      if (metadata.locationAddress && !location.address) {
        location.address = metadata.locationAddress
      }

      return {
        org_id: vendor.org_id,
        vendor_id: vendor.id,
        vendor_plant_id: plant.id.toString(), // Vendor's plant ID (unique per vendor)
        name: plant.name || `Plant ${plant.id}`,
        capacity_kw: plant.capacityKw || 0, // installedCapacity from vendor
        location: location, // Includes address, lat, lng
        // Production metrics
        current_power_kw: metadata.currentPowerKw || null, // generationPower from vendor (converted to kW)
        daily_energy_kwh: metadata.dailyEnergyKwh || null,
        monthly_energy_mwh: metadata.monthlyEnergyMwh || null,
        yearly_energy_mwh: metadata.yearlyEnergyMwh || null,
        total_energy_mwh: metadata.totalEnergyMwh || null,
        last_update_time: lastUpdateTime, // lastUpdateTime from vendor
        last_refreshed_at: new Date().toISOString(), // Always set to current time when syncing
        // Additional metadata fields (refreshed on every sync)
        // Normalize network_status by trimming whitespace (handle ' ALL_OFFLINE' with leading space)
        network_status: metadata.networkStatus ? String(metadata.networkStatus).trim() : null,
        vendor_created_date: createdDate || null,
        start_operating_time: startOperatingTime || null,
      }
    })

    // Get existing plant IDs for counting
    const vendorPlantIds = plantDataArray.map((p) => p.vendor_plant_id)
    const { data: existingPlants } = await supabase
      .from("plants")
      .select("vendor_plant_id")
      .eq("vendor_id", vendor.id)
      .in("vendor_plant_id", vendorPlantIds)

    const existingIds = new Set(
      (existingPlants || []).map((p: { vendor_plant_id: string }) => p.vendor_plant_id)
    )

    // Batch upsert plants
    const BATCH_SIZE = 100
    let created = 0
    let updated = 0
    const errors: string[] = []

    for (let i = 0; i < plantDataArray.length; i += BATCH_SIZE) {
      const batch = plantDataArray.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1

      try {
        // Log first plant in batch to verify last_refreshed_at is included
        if (batch.length > 0) {
          logger.info(`[Sync] Batch ${batchNumber} first plant sample for vendor ${vendor.name}:`, {
            vendor_plant_id: batch[0].vendor_plant_id,
            name: batch[0].name,
            last_refreshed_at: batch[0].last_refreshed_at,
          })
        }
        
        // Ensure last_refreshed_at is set for all plants in batch
        const batchWithRefreshTime = batch.map((plant) => ({
          ...plant,
          last_refreshed_at: new Date().toISOString(), // Ensure it's always set to current time
        }))
        
        const { error: upsertError } = await supabase
          .from("plants")
          .upsert(batchWithRefreshTime, {
            onConflict: "vendor_id,vendor_plant_id",
          })

        if (upsertError) {
          logger.error(`Batch ${batchNumber} error for vendor ${vendor.name}`, upsertError)
          errors.push(`Batch ${batchNumber}: ${upsertError.message}`)

          // Fallback: individual upserts
          for (const plantData of batch) {
            try {
              // Ensure last_refreshed_at is set
              const plantDataWithRefresh = {
                ...plantData,
                last_refreshed_at: new Date().toISOString(),
              }
              
              const { error: individualError } = await supabase
                .from("plants")
                .upsert(plantDataWithRefresh, {
                  onConflict: "vendor_id,vendor_plant_id",
                })

              if (individualError) {
                errors.push(`Plant ${plantData.vendor_plant_id}: ${individualError.message}`)
              } else {
                if (existingIds.has(plantData.vendor_plant_id)) {
                  updated++
                } else {
                  created++
                }
              }
            } catch (individualException: any) {
              errors.push(`Plant ${plantData.vendor_plant_id}: ${individualException.message}`)
            }
          }
        } else {
          // Count created vs updated
          const batchCreated = batch.filter((p) => !existingIds.has(p.vendor_plant_id)).length
          const batchUpdated = batch.length - batchCreated
          created += batchCreated
          updated += batchUpdated
        }
      } catch (batchError: any) {
        console.error(`[Sync] Batch ${batchNumber} exception for vendor ${vendor.name}:`, batchError)
        errors.push(`Batch ${batchNumber}: ${batchError.message}`)
      }
    }

    result.success = errors.length === 0 || errors.length < plantDataArray.length
    result.synced = created + updated
    result.created = created
    result.updated = updated

    if (errors.length > 0) {
      result.error = `Some errors occurred: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "..." : ""}`
    }

    const duration = Date.now() - startTime
    logger.info(
      `✅ Vendor ${vendor.name}: ${result.synced}/${result.total} plants synced (${created} created, ${updated} updated) in ${duration}ms`
    )

    // Update last_synced_at timestamp if sync was successful
    if (result.success && result.synced > 0) {
      await supabase
        .from("vendors")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", vendor.id)
    }

    return result
  } catch (error: any) {
    logger.error(`❌ Error syncing vendor ${vendor.name}`, error)
    result.error = error.message || "Unknown error"
    return result
  }
}

/**
 * Check if a vendor's plant sync should run based on configured daily sync time.
 * Plant sync runs once daily at the configured time to fetch new plants.
 * Uses Asia/Kolkata timezone.
 */
function shouldRunPlantSync(vendor: any): boolean {
  const now = new Date()
  const kolkataTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now)

  const currentHour = parseInt(kolkataTime.find((part) => part.type === "hour")?.value || "0")
  const currentMinute = parseInt(kolkataTime.find((part) => part.type === "minute")?.value || "0")

  // Get configured sync time (default: 02:00 IST)
  const syncTime = vendor.plant_sync_time_ist || "02:00"
  const [syncHour, syncMin] = syncTime.split(":").map(Number)

  // Allow a small window around the configured time (e.g., +/- 5 minutes)
  const SYNC_WINDOW_BUFFER_MINUTES = 5

  const isNearSyncTime =
    currentHour === syncHour &&
    currentMinute >= syncMin - SYNC_WINDOW_BUFFER_MINUTES &&
    currentMinute <= syncMin + SYNC_WINDOW_BUFFER_MINUTES

  if (isNearSyncTime) {
    logger.info(`[PlantSync] Vendor ${vendor.name} is scheduled for daily plant sync at ${syncTime} IST.`)
  }

  return isNearSyncTime
}


/**
 * Sync plants for all active vendors across all organizations
 * Only syncs organizations that have auto_sync_enabled = true
 * Plant sync runs once daily at vendor-configured time (default: 02:00 IST)
 * Uses MAIN CLIENT - plants are stored in the main database
 */
export async function syncAllPlants(): Promise<SyncSummary> {
  const startTime = Date.now()
  // Use MAIN client - plants table is in main database
  const supabase = getMainClient()

  // Context is automatically propagated from caller (cron or user)
  const source = MDC.getSource() || "system"
  logger.info(`🚀 Starting plant sync for all organizations (source: ${source})...`)

  // Fetch all active vendors with their organization sync settings
  const { data: vendors, error: vendorsError } = await supabase
    .from("vendors")
    .select(`
      *,
      organizations (
        id,
        name,
        auto_sync_enabled
      )
    `)
    .eq("is_active", true)
    .not("org_id", "is", null)

  if (vendorsError) {
    throw new Error(`Failed to fetch vendors: ${vendorsError.message}`)
  }

  if (!vendors || vendors.length === 0) {
    logger.info("No active vendors found")
    return {
      totalVendors: 0,
      successful: 0,
      failed: 0,
      totalPlantsSynced: 0,
      totalPlantsCreated: 0,
      totalPlantsUpdated: 0,
      results: [],
      duration: Date.now() - startTime,
    }
  }

  logger.info(`Found ${vendors.length} active vendor(s)`)

  // Filter vendors - plant sync now runs only twice a day (morning/evening)
  // This is to fetch newly added plants from vendors
  const vendorsToSync: any[] = []
  const skippedVendors = new Set<number>()

  for (const vendor of vendors) {
    const org = vendor.organizations
    if (!org) {
      logger.warn(`⚠️ Organization not found for vendor ${vendor.id}, skipping`)
      continue
    }

    // Check if auto-sync is enabled for the organization
    if (!org.auto_sync_enabled) {
      if (!skippedVendors.has(vendor.id)) {
        logger.info(
          `⏭️ Skipping vendor ${vendor.id} (${vendor.name}): ` +
          `auto_sync_enabled=false for org ${org.id} (${org.name})`
        )
        skippedVendors.add(vendor.id)
      }
      continue
    }

    // Check if it's time to run plant sync (morning or evening)
    const shouldSync = shouldRunPlantSync(vendor)
    if (!shouldSync) {
      if (!skippedVendors.has(vendor.id)) {
        // Get current IST time for logging
        const now = new Date()
        const kolkataTime = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).formatToParts(now)
        const currentHour = parseInt(kolkataTime.find((part) => part.type === "hour")?.value || "0")
        const currentMinute = parseInt(kolkataTime.find((part) => part.type === "minute")?.value || "0")
        const morningTime = vendor.plant_list_sync_morning_ist || '06:00'
        const eveningTime = vendor.plant_list_sync_evening_ist || '23:00'
        
        logger.info(
          `⏭️ Skipping plant sync for vendor ${vendor.id} (${vendor.name}): ` +
          `current IST time=${currentHour}:${currentMinute.toString().padStart(2, "0")}, ` +
          `not near morning (${morningTime}) or evening (${eveningTime}) sync times`
        )
        skippedVendors.add(vendor.id)
      }
      continue
    }

    vendorsToSync.push(vendor)
  }

  if (vendorsToSync.length === 0) {
    logger.info("No organizations to sync at this time")
    return {
      totalVendors: vendors.length,
      successful: 0,
      failed: 0,
      totalPlantsSynced: 0,
      totalPlantsCreated: 0,
      totalPlantsUpdated: 0,
      results: [],
      duration: Date.now() - startTime,
    }
  }

  logger.info(`Processing ${vendorsToSync.length} vendor(s) from organizations with auto-sync enabled and matching interval`)

  // Group vendors by organization for parallel processing
  const vendorsByOrg = new Map<number, any[]>()
  vendorsToSync.forEach((vendor) => {
    if (vendor.org_id) {
      if (!vendorsByOrg.has(vendor.org_id)) {
        vendorsByOrg.set(vendor.org_id, [])
      }
      vendorsByOrg.get(vendor.org_id)!.push(vendor)
    }
  })

  logger.info(`Processing ${vendorsByOrg.size} organization(s) in parallel`)

  // Process all vendors in parallel (no concurrency limit - all vendors processed simultaneously)
  // Context automatically propagated to each vendor sync
  const results = await Promise.all(
    vendorsToSync.map((vendor) => 
      // Create child context for each vendor (context still propagated)
      MDC.withContextAsync(
        {
          vendorId: vendor.id,
          vendorName: vendor.name,
          orgId: vendor.org_id,
          operation: `sync-vendor-${vendor.id}`,
        },
        () => syncVendorPlants(vendor, supabase)
      )
    )
  )

  // Calculate summary
  const successful = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length
  const totalPlantsSynced = results.reduce((sum, r) => sum + r.synced, 0)
  const totalPlantsCreated = results.reduce((sum, r) => sum + r.created, 0)
  const totalPlantsUpdated = results.reduce((sum, r) => sum + r.updated, 0)

  const summary: SyncSummary = {
    totalVendors: vendorsToSync.length,
    successful,
    failed,
    totalPlantsSynced,
    totalPlantsCreated,
    totalPlantsUpdated,
    results,
    duration: Date.now() - startTime,
  }

  logger.info(
    `✅ Sync complete: ${successful}/${vendorsToSync.length} vendors successful, ` +
    `${totalPlantsSynced} plants synced (${totalPlantsCreated} created, ${totalPlantsUpdated} updated) ` +
    `in ${summary.duration}ms`
  )

  return summary
}

