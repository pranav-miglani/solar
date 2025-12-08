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

  for (const vendor of vendors || []) {
    summary.vendorsProcessed++
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
      const { data: plants, error: plantError } = await main
        .from("plants")
        .select("id, org_id, vendor_id, vendor_plant_id, name, daily_energy_kwh, monthly_energy_mwh, yearly_energy_mwh, total_energy_mwh, updated_at")
        .eq("vendor_id", vendor.id)

      if (plantError) {
        throw plantError
      }

      // Update plant name in analytics plants table
      for (const plant of plants || []) {
        await analytics
          .from("plants")
          .upsert(
            {
              id: plant.id,
              org_id: plant.org_id,
              vendor_id: plant.vendor_id,
              vendor_plant_id: plant.vendor_plant_id,
              plant_name: plant.name,
            },
            { onConflict: "id" }
          )
      }

      for (const plant of plants || []) {
        summary.plantsProcessed++

        const dailyEnergyKwh = toNumberOrNull(plant.daily_energy_kwh)
        const monthlyEnergyMwh = toNumberOrNull(plant.monthly_energy_mwh)
        const yearlyEnergyMwh = toNumberOrNull(plant.yearly_energy_mwh)
        const totalEnergyMwh = toNumberOrNull(plant.total_energy_mwh)

        const monthlyEnergyKwh = monthlyEnergyMwh !== null ? monthlyEnergyMwh * 1000 : null

        const payload = {
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

        const { error } = await analytics.from("plant_energy_readings").upsert(payload, { onConflict: "plant_id,reading_date" })
        if (error) {
          logger.error("[Analytics Snapshot] Failed to upsert plant energy reading", {
            vendorId: vendor.id,
            plantId: plant.id,
            error: error.message,
          })
          throw error
        }

        vendorRows++
        summary.rowsUpserted++
      }

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

