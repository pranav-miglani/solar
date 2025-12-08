import { VendorManager } from "@/lib/vendors/vendorManager"
import type { VendorConfig } from "@/lib/vendors/types"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { getMainClient } from "@/lib/supabase/pooled"

/**
 * Live Telemetry Sync Service
 * 
 * Updates live telemetry fields in the plants table:
 * - current_power_kw
 * - daily_energy_kwh
 * - monthly_energy_mwh
 * - yearly_energy_mwh
 * - total_energy_mwh
 * - network_status
 * 
 * This is separate from historical telemetry (graphs) which are stored in the telemetry database.
 * Live telemetry is updated at regular intervals via cron to provide real-time metrics.
 */

interface LiveTelemetryResult {
  plantId: number
  vendorPlantId: string
  success: boolean
  error?: string
}

interface VendorLiveTelemetryResult {
  vendorId: number
  vendorName: string
  orgId: number
  success: boolean
  synced: number
  failed: number
  total: number
  errors: string[]
}

interface LiveTelemetrySummary {
  totalVendors: number
  successful: number
  failed: number
  totalPlantsSynced: number
  totalPlantsFailed: number
  results: VendorLiveTelemetryResult[]
  duration: number
}

/**
 * Check if a vendor should be synced based on its telemetry_sync_interval
 * Sync runs at fixed clock times: if interval is 15, syncs at :00, :15, :30, :45
 * Uses Asia/Kolkata timezone to match the cron schedule
 */
function shouldSyncVendorTelemetry(vendor: any): boolean {
  const intervalMinutes = vendor.telemetry_sync_interval || 15
  
  // Get current time in Asia/Kolkata timezone (matching cron schedule)
  const now = new Date()
  const kolkataTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now)
  
  const currentMinute = parseInt(kolkataTime.find((part) => part.type === "minute")?.value || "0")
  
  // Calculate which intervals have passed in this hour
  // For 15-minute interval: sync at 0, 15, 30, 45
  // For 30-minute interval: sync at 0, 30
  // For 45-minute interval: sync at 0, 45
  const currentInterval = Math.floor(currentMinute / intervalMinutes)
  
  // Check if current minute matches an interval boundary
  const expectedMinute = currentInterval * intervalMinutes
  return currentMinute === expectedMinute
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
    if (typeof adapter.setTokenStorage === "function") {
      adapter.setTokenStorage(vendorId, supabase)
    }

    try {
      await adapter.authenticate()
      return true
    } catch (authError: any) {
      logger.error(`[LiveTelemetry] Token validation failed for vendor ${vendorId}:`, authError.message)
      return false
    }
  } catch (error: any) {
    logger.error(`[LiveTelemetry] Error validating token for vendor ${vendorId}:`, error.message)
    return false
  }
}

/**
 * Sync live telemetry for a single vendor
 * 
 * Strategy based on telemetry_sync_mode:
 * 1. LIST_PLANTS: Fetch all plants telemetry in single API call (efficient)
 * 2. PER_PLANT: Fetch each plant telemetry individually (costly but necessary for some vendors)
 */
async function syncVendorLiveTelemetry(
  vendor: any,
  supabase: any
): Promise<VendorLiveTelemetryResult> {
  const startTime = Date.now()
  const result: VendorLiveTelemetryResult = {
    vendorId: vendor.id,
    vendorName: vendor.name,
    orgId: vendor.org_id,
    success: false,
    synced: 0,
    failed: 0,
    total: 0,
    errors: [],
  }

  try {
    // Get all plants for this vendor (including inactive ones - sync continues until user deletes)
    const { data: plantsInDB, error: plantsError } = await supabase
      .from("plants")
      .select("id, vendor_plant_id")
      .eq("vendor_id", vendor.id)

    if (plantsError) {
      throw new Error(`Failed to fetch plants: ${plantsError.message}`)
    }

    if (!plantsInDB || plantsInDB.length === 0) {
      logger.info(`[LiveTelemetry] No plants found for vendor ${vendor.name}`)
      result.success = true
      return result
    }

    result.total = plantsInDB.length
    logger.info(`[LiveTelemetry] Syncing live telemetry for ${plantsInDB.length} plants from vendor ${vendor.name}`)

    // Get telemetry sync mode (default to LIST_PLANTS for efficiency)
    const telemetrySyncMode = vendor.telemetry_sync_mode || 'LIST_PLANTS'
    
    logger.info(
      `[LiveTelemetry] Vendor ${vendor.name} using telemetry_sync_mode=${telemetrySyncMode}`
    )
    
    // Create vendor config
    const vendorConfig: VendorConfig = {
      id: vendor.id,
      name: vendor.name,
      vendorType: vendor.vendor_type,
      apiBaseUrl: vendor.api_base_url,
      credentials: vendor.credentials,
      isActive: vendor.is_active,
      plantSyncMode: vendor.plant_sync_mode,
      perPlantSyncIntervalMinutes: vendor.per_plant_sync_interval_minutes,
      plantSyncTimeIst: vendor.plant_sync_time_ist || "02:00",
    }

    const adapter = VendorManager.getAdapter(vendorConfig)

    // Validate token
    const tokenValid = await validateAndRefreshToken(adapter, vendor.id, supabase)
    if (!tokenValid) {
      throw new Error("Failed to validate/refresh token")
    }

    // Process plants based on telemetry sync mode
    const FETCH_BATCH_SIZE = 50 // Fetch telemetry for 50 plants at a time
    const UPDATE_BATCH_SIZE = 100 // Update 100 plants in one database transaction
    const plantResults: LiveTelemetryResult[] = []
    const allUpdates: Array<{
      id: number
      vendorPlantId: string
      data: {
        current_power_kw: number | null
        daily_energy_kwh: number | null
        monthly_energy_mwh: number | null
        yearly_energy_mwh: number | null
        total_energy_mwh: number | null
        network_status: string | null
        last_update_time: string | null
        last_refreshed_at: string
      }
    }> = []

    if (telemetrySyncMode === 'LIST_PLANTS') {
      // Efficient mode: Fetch all plants telemetry in single API call
      logger.info(
        `[LiveTelemetry] Using LIST_PLANTS mode: fetching all plants telemetry in single call for vendor ${vendor.name}`
      )
      
      try {
        const allPlantsData = await adapter.listPlants()
        
        // Create a map of vendor_plant_id -> plant data for quick lookup
        const plantDataMap = new Map<string, any>()
        for (const plantData of allPlantsData) {
          plantDataMap.set(plantData.id, plantData)
        }
        
        // Match fetched plants with database plants and prepare updates
        for (const plant of plantsInDB) {
          const plantData = plantDataMap.get(plant.vendor_plant_id)
          
          if (!plantData) {
            plantResults.push({
              plantId: plant.id,
              vendorPlantId: plant.vendor_plant_id,
              success: false,
              error: "Plant not found in vendor response",
            })
            continue
          }
          
          // Extract live telemetry fields ONLY
          // NOTE: capacity_kw is NOT updated here - it's a fixed property that only changes during plant sync
          // Only update telemetry fields that change frequently (power, energy, network status, timestamps)
          const metadata = plantData.metadata || {}
          const currentPowerKw = metadata.currentPowerKw ?? null
          const dailyEnergyKwh = metadata.dailyEnergyKwh ?? null
          const monthlyEnergyMwh = metadata.monthlyEnergyMwh ?? null
          const yearlyEnergyMwh = metadata.yearlyEnergyMwh ?? null
          const totalEnergyMwh = metadata.totalEnergyMwh ?? null
          const networkStatus = metadata.networkStatus
            ? String(metadata.networkStatus).trim()
            : null
          const lastUpdateTime = metadata.lastUpdateTime
            ? typeof metadata.lastUpdateTime === "string"
              ? metadata.lastUpdateTime
              : typeof metadata.lastUpdateTime === "number"
              ? new Date(metadata.lastUpdateTime * 1000).toISOString()
              : null
            : null
          
          plantResults.push({
            plantId: plant.id,
            vendorPlantId: plant.vendor_plant_id,
            success: true,
          })
          
          // Update ONLY telemetry fields - explicitly exclude capacity_kw, name, location, etc.
          // These are plant properties that only change during plant sync, not live telemetry sync
          allUpdates.push({
            id: plant.id,
            vendorPlantId: plant.vendor_plant_id,
            data: {
              current_power_kw: currentPowerKw,
              daily_energy_kwh: dailyEnergyKwh,
              monthly_energy_mwh: monthlyEnergyMwh,
              yearly_energy_mwh: yearlyEnergyMwh,
              total_energy_mwh: totalEnergyMwh,
              network_status: networkStatus,
              last_update_time: lastUpdateTime,
              last_refreshed_at: new Date().toISOString(),
              // Explicitly NOT including: capacity_kw, name, location, org_id, vendor_id, etc.
            },
          })
        }
      } catch (error: any) {
        logger.error(
          `[LiveTelemetry] Error fetching all plants telemetry for vendor ${vendor.name}:`,
          error.message
        )
        // Mark all plants as failed
        for (const plant of plantsInDB) {
          plantResults.push({
            plantId: plant.id,
            vendorPlantId: plant.vendor_plant_id,
            success: false,
            error: error.message,
          })
        }
      }
    } else {
      // PER_PLANT mode: Fetch each plant individually (costly but necessary)
      logger.info(
        `[LiveTelemetry] Using PER_PLANT mode: fetching telemetry for each plant individually for vendor ${vendor.name}`
      )
      
      // Fetch telemetry for plants in batches (parallel API calls)
      for (let i = 0; i < plantsInDB.length; i += FETCH_BATCH_SIZE) {
        const batch = plantsInDB.slice(i, i + FETCH_BATCH_SIZE)
        const batchNumber = Math.floor(i / FETCH_BATCH_SIZE) + 1
        logger.info(
          `[LiveTelemetry] Fetching batch ${batchNumber} (${batch.length} plants) for vendor ${vendor.name}`
        )

        // Fetch telemetry for all plants in batch in parallel
        const batchPromises = batch.map(async (plant: { id: number; vendor_plant_id: string }) => {
          try {
            let plantData = null

            // Use listPlant() for per-plant fetching
            try {
              plantData = await adapter.listPlant(plant.vendor_plant_id)
            } catch (listPlantError: any) {
              logger.error(
                `[LiveTelemetry] listPlant() failed for vendor ${vendor.name}, ` +
                `plant ${plant.vendor_plant_id}: ${listPlantError.message}`
              )
              return {
                plantId: plant.id,
                vendorPlantId: plant.vendor_plant_id,
                success: false,
                error: listPlantError.message,
                data: null,
              }
            }

            if (!plantData) {
              return {
                plantId: plant.id,
                vendorPlantId: plant.vendor_plant_id,
                success: false,
                error: "Plant not found",
                data: null,
              }
            }

            // Extract live telemetry fields from plant data ONLY
            // NOTE: capacity_kw is NOT updated here - it's a fixed property that only changes during plant sync
            // Only update telemetry fields that change frequently (power, energy, network status, timestamps)
            const metadata = plantData.metadata || {}
            const currentPowerKw = metadata.currentPowerKw ?? null
            const dailyEnergyKwh = metadata.dailyEnergyKwh ?? null
            const monthlyEnergyMwh = metadata.monthlyEnergyMwh ?? null
            const yearlyEnergyMwh = metadata.yearlyEnergyMwh ?? null
            const totalEnergyMwh = metadata.totalEnergyMwh ?? null
            const networkStatus = metadata.networkStatus
              ? String(metadata.networkStatus).trim()
              : null
            const lastUpdateTime = metadata.lastUpdateTime
              ? typeof metadata.lastUpdateTime === "string"
                ? metadata.lastUpdateTime
                : typeof metadata.lastUpdateTime === "number"
                ? new Date(metadata.lastUpdateTime * 1000).toISOString()
                : null
              : null

            return {
              plantId: plant.id,
              vendorPlantId: plant.vendor_plant_id,
              success: true,
              data: {
                // Update ONLY telemetry fields - explicitly exclude capacity_kw, name, location, etc.
                // These are plant properties that only change during plant sync, not live telemetry sync
                current_power_kw: currentPowerKw,
                daily_energy_kwh: dailyEnergyKwh,
                monthly_energy_mwh: monthlyEnergyMwh,
                yearly_energy_mwh: yearlyEnergyMwh,
                total_energy_mwh: totalEnergyMwh,
                network_status: networkStatus,
                last_update_time: lastUpdateTime,
                last_refreshed_at: new Date().toISOString(),
                // Explicitly NOT including: capacity_kw, name, location, org_id, vendor_id, etc.
              },
            }
          } catch (plantError: any) {
            logger.error(
              `[LiveTelemetry] Error fetching telemetry for plant ${plant.vendor_plant_id}:`,
              plantError.message
            )
            return {
              plantId: plant.id,
              vendorPlantId: plant.vendor_plant_id,
              success: false,
              error: plantError.message,
              data: null,
            }
          }
        })

        // Wait for all plants in batch to be fetched
        const batchResults = await Promise.all(batchPromises)

        // Collect results and accumulate updates
        for (const res of batchResults) {
          plantResults.push({
            plantId: res.plantId,
            vendorPlantId: res.vendorPlantId,
            success: res.success,
            error: res.error,
          })

          // Add to update batch if we have data
          if (res.success && res.data) {
            allUpdates.push({
              id: res.plantId,
              vendorPlantId: res.vendorPlantId,
              data: res.data,
            })
          }
        }
      }
    }

    // Update all plants in batches (reduce number of database transactions)
    if (allUpdates.length > 0) {
      logger.info(
        `[LiveTelemetry] Updating ${allUpdates.length} plants in batches of ${UPDATE_BATCH_SIZE} for vendor ${vendor.name}`
      )

      // Process updates in chunks to avoid too large payloads
      for (let j = 0; j < allUpdates.length; j += UPDATE_BATCH_SIZE) {
        const updateChunk = allUpdates.slice(j, j + UPDATE_BATCH_SIZE)
        const chunkNumber = Math.floor(j / UPDATE_BATCH_SIZE) + 1
        
        try {
          // Use update() instead of upsert() - we only update existing plants, never create new ones
          // Live telemetry sync only updates telemetry fields for plants that already exist
          // Update each plant individually since Supabase doesn't support batch updates with different values per row
          const updatePromises = updateChunk.map(async (item) => {
            // Ensure update data only contains telemetry fields - explicitly construct to avoid accidental field inclusion
            const updateData = {
              current_power_kw: item.data.current_power_kw,
              daily_energy_kwh: item.data.daily_energy_kwh,
              monthly_energy_mwh: item.data.monthly_energy_mwh,
              yearly_energy_mwh: item.data.yearly_energy_mwh,
              total_energy_mwh: item.data.total_energy_mwh,
              network_status: item.data.network_status,
              last_update_time: item.data.last_update_time,
              last_refreshed_at: item.data.last_refreshed_at,
              // Explicitly exclude: org_id, vendor_id, capacity_kw, name, location, etc.
            }
            
            const { error: updateError } = await supabase
            .from("plants")
              .update(updateData) // Only telemetry fields, explicitly constructed
              .eq("id", item.id)
            
            if (updateError) {
              logger.error(
                `[LiveTelemetry] Failed to update plant ${item.id} (${item.vendorPlantId}): ${updateError.message}`
              )
              return { success: false, plantId: item.id, error: updateError.message }
            }
            return { success: true, plantId: item.id }
          })

          const updateResults = await Promise.all(updatePromises)
          const failedUpdates = updateResults.filter((r) => !r.success)
          
          if (failedUpdates.length > 0) {
            logger.error(
              `[LiveTelemetry] Batch update error (chunk ${chunkNumber}) for vendor ${vendor.name}: ${failedUpdates.length}/${updateChunk.length} plants failed`
            )
            // Mark affected plants as failed
            failedUpdates.forEach((failed) => {
              const result = plantResults.find((r) => r.plantId === failed.plantId)
              if (result) {
                result.success = false
                result.error = (failed as any).error
              }
            })
          } else {
            logger.debug(
              `[LiveTelemetry] Successfully updated ${updateChunk.length} plants in batch (chunk ${chunkNumber}) for vendor ${vendor.name}`
            )
          }
        } catch (batchError: any) {
          logger.error(
            `[LiveTelemetry] Batch update exception (chunk ${chunkNumber}) for vendor ${vendor.name}:`,
            batchError.message
          )
          // Mark affected plants as failed
          updateChunk.forEach((item) => {
            const result = plantResults.find((r) => r.plantId === item.id)
            if (result) {
              result.success = false
              result.error = batchError.message
            }
          })
        }
      }
    }

    // Calculate results
    const successful = plantResults.filter((r) => r.success).length
    const failed = plantResults.filter((r) => !r.success).length

    result.synced = successful
    result.failed = failed
    result.success = failed === 0 || successful > 0

    if (failed > 0) {
      const errorMessages = plantResults
        .filter((r) => !r.success)
        .slice(0, 5)
        .map((r) => `${r.vendorPlantId}: ${r.error}`)
      result.errors = errorMessages
    }

    const duration = Date.now() - startTime
    logger.info(
      `[LiveTelemetry] ✅ Vendor ${vendor.name}: ${successful}/${result.total} plants synced ` +
      `(${failed} failed) in ${duration}ms`
    )

    return result
  } catch (error: any) {
    logger.error(`[LiveTelemetry] ❌ Error syncing vendor ${vendor.name}:`, error)
    result.errors = [error.message || "Unknown error"]
    return result
  }
}

/**
 * Sync live telemetry for all active vendors across all organizations
 */
export async function syncAllLiveTelemetry(): Promise<LiveTelemetrySummary> {
  const startTime = Date.now()
  const summary: LiveTelemetrySummary = {
    totalVendors: 0,
    successful: 0,
    failed: 0,
    totalPlantsSynced: 0,
    totalPlantsFailed: 0,
    results: [],
    duration: 0,
  }

  return MDC.runAsync(
    {
      source: "cron",
      operation: "sync-live-telemetry",
    },
    async () => {
      try {
        const supabase = getMainClient()

        // Get all active vendors with their organization sync settings
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
          logger.info("[LiveTelemetry] No active vendors found")
          return summary
        }

        // Filter vendors by org-level auto_sync_enabled and telemetry sync interval
        const vendorsToSync = vendors.filter((vendor) => {
          // Check org-level auto_sync_enabled first
          const org = vendor.organizations
          if (!org) {
            logger.warn(`⚠️ Organization not found for vendor ${vendor.id} (${vendor.name}), skipping telemetry sync`)
            return false
          }

          if (!org.auto_sync_enabled) {
            logger.info(
              `⏭️ Skipping telemetry sync for vendor ${vendor.id} (${vendor.name}): ` +
              `auto_sync_enabled=false for org ${org.id} (${org.name})`
            )
            return false
          }

          // Then check if it's time to sync based on telemetry_sync_interval
          const shouldSync = shouldSyncVendorTelemetry(vendor)
          if (!shouldSync) {
            const now = new Date()
            const kolkataTime = new Intl.DateTimeFormat("en-US", {
              timeZone: "Asia/Kolkata",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }).formatToParts(now)
            const currentHour = parseInt(kolkataTime.find((part) => part.type === "hour")?.value || "0")
            const currentMinute = parseInt(kolkataTime.find((part) => part.type === "minute")?.value || "0")
            const interval = vendor.telemetry_sync_interval || 15
            
            logger.debug(
              `[LiveTelemetry] Skipping vendor ${vendor.name}: ` +
              `interval=${interval}min, current IST time=${currentHour}:${currentMinute.toString().padStart(2, "0")}, ` +
              `doesn't match interval boundary`
            )
          }
          return shouldSync
        })

        if (vendorsToSync.length === 0) {
          logger.info("[LiveTelemetry] No vendors to sync at this time (interval check)")
          return summary
        }

        summary.totalVendors = vendorsToSync.length
        logger.info(`[LiveTelemetry] Starting sync for ${vendorsToSync.length} vendors (filtered from ${vendors.length} total)`)

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

        logger.info(`[LiveTelemetry] Processing ${vendorsByOrg.size} organizations (${vendorsToSync.length} vendors total)`)

        // Process organizations in parallel with concurrency limit
        // For t3.nano: limit to 3-5 concurrent orgs to avoid resource exhaustion
        // Adjust MAX_CONCURRENT_ORGS based on instance performance
        const MAX_CONCURRENT_ORGS = 3
        const orgArray = Array.from(vendorsByOrg.entries())

        // Process orgs in batches to respect concurrency limit
        for (let i = 0; i < orgArray.length; i += MAX_CONCURRENT_ORGS) {
          const orgBatch = orgArray.slice(i, i + MAX_CONCURRENT_ORGS)
          const batchNumber = Math.floor(i / MAX_CONCURRENT_ORGS) + 1
          const totalBatches = Math.ceil(orgArray.length / MAX_CONCURRENT_ORGS)

          logger.info(
            `[LiveTelemetry] Processing org batch ${batchNumber}/${totalBatches} ` +
            `(${orgBatch.length} orgs, ${orgBatch.reduce((sum, [, vendors]) => sum + vendors.length, 0)} vendors)`
          )

          // Process orgs in parallel within batch
          const orgResults = await Promise.all(
            orgBatch.map(async ([orgId, vendors]) => {
              // Process vendors within org sequentially to avoid overwhelming vendor APIs
              const orgVendorResults: VendorLiveTelemetryResult[] = []

              for (const vendor of vendors) {
                const result = await syncVendorLiveTelemetry(vendor, supabase)
                orgVendorResults.push(result)

                if (result.success) {
                  summary.successful++
                } else {
                  summary.failed++
                }

                summary.totalPlantsSynced += result.synced
                summary.totalPlantsFailed += result.failed
              }

              return orgVendorResults
            })
          )

          // Flatten results from all orgs in this batch
          orgResults.flat().forEach((result) => {
            summary.results.push(result)
          })

          logger.info(
            `[LiveTelemetry] Completed org batch ${batchNumber}/${totalBatches}: ` +
            `${summary.successful} successful, ${summary.failed} failed vendors so far`
          )
        }

        summary.duration = Date.now() - startTime
        logger.info(
          `[LiveTelemetry] ✅ Sync complete: ${summary.successful}/${summary.totalVendors} vendors successful, ` +
          `${summary.totalPlantsSynced} plants synced in ${summary.duration}ms`
        )

        return summary
      } catch (error: any) {
        logger.error("[LiveTelemetry] ❌ Fatal error in syncAllLiveTelemetry:", error)
        summary.duration = Date.now() - startTime
        return summary
      }
    }
  )
}

