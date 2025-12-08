import { logger } from "@/lib/context/logger"
import { getMainClient, getAnalyticsClient } from "@/lib/supabase/pooled"

type SnapshotSummary = {
  vendorsProcessed: number
  vendorsSkipped: number
  vendorsErrored: number
  plantsProcessed: number
  rowsUpserted: number
}

function getIstDateString(): string {
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now) // YYYY-MM-DD
  return parts
}

function toNumberOrNull(value: any): number | null {
  if (value === null || value === undefined) return null
  const num = Number(value)
  if (Number.isNaN(num) || !Number.isFinite(num)) return null
  return num
}

export async function runAnalyticsSnapshot(): Promise<SnapshotSummary> {
  const main = getMainClient()
  const analytics = getAnalyticsClient()
  const readingDate = getIstDateString()

  const summary: SnapshotSummary = {
    vendorsProcessed: 0,
    vendorsSkipped: 0,
    vendorsErrored: 0,
    plantsProcessed: 0,
    rowsUpserted: 0,
  }

  // Fetch vendors ready for analytics
  const { data: vendors, error: vendorError } = await analytics
    .from("vendors")
    .select("id, org_id, name, vendor_type, config, analytics_ready, config_ready, config_last_status")
    .eq("analytics_ready", true)
    .eq("config_ready", true)
    .eq("config_last_status", "success")

  if (vendorError) {
    logger.error("[Analytics Snapshot] Failed to fetch vendors from analytics DB", { error: vendorError.message })
    throw vendorError
  }

  // Fetch org configs for gating auto_sync_enabled
  const { data: orgs, error: orgError } = await analytics.from("organizations").select("id, config")
  if (orgError) {
    logger.error("[Analytics Snapshot] Failed to fetch organizations from analytics DB", { error: orgError.message })
    throw orgError
  }

  const orgConfigMap = new Map<number, any>()
  for (const org of orgs || []) {
    orgConfigMap.set(org.id, org.config || {})
  }

  const totalVendors = vendors?.length || 0
  logger.info("[Analytics Snapshot] Starting snapshot for vendors", { totalVendors, readingDate })

  for (let vendorIndex = 0; vendorIndex < (vendors || []).length; vendorIndex++) {
    const vendor = vendors![vendorIndex]
    summary.vendorsProcessed++
    
    logger.info("[Analytics Snapshot] Processing vendor", {
      vendorIndex: vendorIndex + 1,
      totalVendors,
      vendorId: vendor.id,
      vendorName: vendor.name,
    })

    const orgConfig = orgConfigMap.get(vendor.org_id) || {}
    const orgSyncEnabled = orgConfig.auto_sync_enabled !== false
    if (!orgSyncEnabled) {
      summary.vendorsSkipped++
      logger.info("[Analytics Snapshot] Skipping vendor because org sync disabled", { vendorId: vendor.id, orgId: vendor.org_id })
      continue
    }

    // Create snapshot run record
    const runStartTime = new Date().toISOString()
    const { data: runRecord, error: runCreateError } = await analytics
      .from("analytics_snapshot_runs")
      .insert({
        vendor_id: vendor.id,
        started_at: runStartTime,
        status: "running",
      })
      .select("id")
      .single()

    if (runCreateError) {
      logger.error("[Analytics Snapshot] Failed to create run record", { vendorId: vendor.id, error: runCreateError.message })
      summary.vendorsErrored++
      continue
    }

    const runId = runRecord.id
    let vendorRows = 0
    let vendorError: Error | null = null

    try {
      // Load plants from main DB for this vendor
      logger.info("[Analytics Snapshot] Fetching plants from main DB", { vendorId: vendor.id })
      const { data: plants, error: plantError } = await main
        .from("plants")
        .select("id, org_id, vendor_id, vendor_plant_id, name, daily_energy_kwh, monthly_energy_mwh, yearly_energy_mwh, total_energy_mwh, updated_at")
        .eq("vendor_id", vendor.id)

      if (plantError) {
        throw plantError
      }

      const plantCount = plants?.length || 0
      logger.info("[Analytics Snapshot] Found plants", { vendorId: vendor.id, plantCount })

      // Batch upsert plants in analytics DB
      const BATCH_SIZE = 100
      const plantBatch = (plants || []).map((plant) => ({
        id: plant.id,
        org_id: plant.org_id,
        vendor_id: plant.vendor_id,
        vendor_plant_id: plant.vendor_plant_id,
        plant_name: plant.name,
      }))

      if (plantBatch.length > 0) {
        const totalBatches = Math.ceil(plantBatch.length / BATCH_SIZE)
        logger.info("[Analytics Snapshot] Upserting plants in batches", {
          vendorId: vendor.id,
          totalPlants: plantBatch.length,
          totalBatches,
        })

        for (let i = 0; i < plantBatch.length; i += BATCH_SIZE) {
          const batch = plantBatch.slice(i, i + BATCH_SIZE)
          const batchNum = Math.floor(i / BATCH_SIZE) + 1
          const { error: plantUpsertError } = await analytics
            .from("plants")
            .upsert(batch, { onConflict: "id" })

          if (plantUpsertError) {
            logger.error("[Analytics Snapshot] Failed to upsert plants batch", {
              vendorId: vendor.id,
              batchNum,
              batchStart: i,
              batchSize: batch.length,
              error: plantUpsertError.message,
            })
            throw plantUpsertError
          }

          if (batchNum % 10 === 0 || batchNum === totalBatches) {
            logger.info("[Analytics Snapshot] Plant batch progress", {
              vendorId: vendor.id,
              batchNum,
              totalBatches,
            })
          }
        }
      }

      // Prepare energy readings payloads
      const energyReadings = (plants || []).map((plant) => {
        const dailyEnergyKwh = toNumberOrNull(plant.daily_energy_kwh)
        const monthlyEnergyMwh = toNumberOrNull(plant.monthly_energy_mwh)
        const yearlyEnergyMwh = toNumberOrNull(plant.yearly_energy_mwh)
        const totalEnergyMwh = toNumberOrNull(plant.total_energy_mwh)
        const monthlyEnergyKwh = monthlyEnergyMwh !== null ? monthlyEnergyMwh * 1000 : null

        return {
          org_id: plant.org_id,
          vendor_id: plant.vendor_id,
          plant_id: plant.id,
          vendor_plant_id: plant.vendor_plant_id,
          reading_date: readingDate,
          daily_energy_kwh: dailyEnergyKwh,
          monthly_energy_kwh: monthlyEnergyKwh,
          yearly_energy_mwh: yearlyEnergyMwh,
          total_energy_mwh: totalEnergyMwh,
          metadata: {
            source: "main_plants_snapshot",
            captured_at_ist: readingDate,
            raw: plant,
          },
        }
      })

      // Batch upsert energy readings
      if (energyReadings.length > 0) {
        const totalBatches = Math.ceil(energyReadings.length / BATCH_SIZE)
        logger.info("[Analytics Snapshot] Upserting energy readings in batches", {
          vendorId: vendor.id,
          totalReadings: energyReadings.length,
          totalBatches,
        })

        for (let i = 0; i < energyReadings.length; i += BATCH_SIZE) {
          const batch = energyReadings.slice(i, i + BATCH_SIZE)
          const batchNum = Math.floor(i / BATCH_SIZE) + 1
          const { error: readingUpsertError } = await analytics
            .from("plant_energy_readings")
            .upsert(batch, { onConflict: "plant_id,reading_date" })

          if (readingUpsertError) {
            logger.error("[Analytics Snapshot] Failed to upsert energy readings batch", {
              vendorId: vendor.id,
              batchNum,
              batchStart: i,
              batchSize: batch.length,
              error: readingUpsertError.message,
            })
            throw readingUpsertError
          }

          vendorRows += batch.length
          summary.rowsUpserted += batch.length

          if (batchNum % 10 === 0 || batchNum === totalBatches) {
            logger.info("[Analytics Snapshot] Energy readings batch progress", {
              vendorId: vendor.id,
              batchNum,
              totalBatches,
              rowsUpserted: vendorRows,
            })
          }
        }
      }

      summary.plantsProcessed += plants?.length || 0

      // Update run record and vendor status on success
      const runEndTime = new Date().toISOString()
      await analytics
        .from("analytics_snapshot_runs")
        .update({
          completed_at: runEndTime,
          status: "success",
          plants_processed: plants?.length || 0,
          rows_upserted: vendorRows,
        })
        .eq("id", runId)

      await analytics
        .from("vendors")
        .update({
          analytics_last_synced_at: runEndTime,
        })
        .eq("id", vendor.id)

      logger.info("[Analytics Snapshot] Vendor snapshot complete", {
        vendorId: vendor.id,
        vendorName: vendor.name,
        rows: vendorRows,
      })
    } catch (error: any) {
      vendorError = error
      summary.vendorsErrored++
      const runEndTime = new Date().toISOString()
      await analytics
        .from("analytics_snapshot_runs")
        .update({
          completed_at: runEndTime,
          status: "error",
          error_message: error.message || "Unknown error",
          plants_processed: summary.plantsProcessed,
          rows_upserted: vendorRows,
        })
        .eq("id", runId)

      logger.error("[Analytics Snapshot] Vendor snapshot failed", {
        vendorId: vendor.id,
        vendorName: vendor.name,
        error: error.message,
      })
    }
  }

  // Cleanup retention
  try {
    await analytics.rpc("cleanup_old_plant_energy_readings")
  } catch (error: any) {
    logger.error("[Analytics Snapshot] Cleanup old plant energy readings failed", { error: error.message })
  }

  logger.info("[Analytics Snapshot] Completed snapshot run", summary)
  return summary
}

