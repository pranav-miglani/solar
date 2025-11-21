import { VendorManager } from "@/lib/vendors/vendorManager"
import type { VendorConfig } from "@/lib/vendors/types"
import { getMainClient } from "@/lib/supabase/pooled"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"

type AlertStatus = "ACTIVE" | "RESOLVED" | "ACKNOWLEDGED"

interface AlertSyncResult {
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

interface AlertSyncSummary {
  totalVendors: number
  successful: number
  failed: number
  totalAlertsSynced: number
  totalAlertsCreated: number
  totalAlertsUpdated: number
  results: AlertSyncResult[]
  duration: number
}

/**
 * Resolve the configured alert lookback start date for a vendor.
 *
 * The date is expected to come from vendor configuration (UI-level setting)
 * and stored inside the vendor credentials JSON as `alertsStartDate`
 * (ISO date string), e.g. "2024-01-01".
 *
 * If not configured, we default to a 1-year lookback window.
 */
function getVendorAlertsStartDate(vendor: any): Date {
  const credentials = (vendor.credentials || {}) as Record<string, any>
  const configured = credentials.alertsStartDate as string | undefined

  const oneYearMs = 365 * 24 * 60 * 60 * 1000
  const now = Date.now()
  const fallback = new Date(now - oneYearMs)

  if (!configured) {
    return fallback
  }

  const parsed = new Date(configured)
  if (Number.isNaN(parsed.getTime())) {
    logger.warn(
      `⚠️ Invalid alertsStartDate for vendor ${vendor.id} (${vendor.name}), falling back to 1 year lookback`,
      { alertsStartDate: configured }
    )
    return fallback
  }

  // Never look back more than 1 year even if UI config is older
  return parsed.getTime() < fallback.getTime() ? fallback : parsed
}

/**
 * Map Solarman alert level/influence to our severity enum
 */
function mapSolarmanSeverity(level: number | null | undefined, influence: number | null | undefined) {
  const baseMap: Record<number, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = {
    0: "LOW",
    1: "MEDIUM",
    2: "HIGH",
  }

  let severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = baseMap[level ?? 1] || "MEDIUM"

  // Safety influence upgrades severity
  if (influence === 2 || influence === 3) {
    severity = "CRITICAL"
  } else if (influence === 1 && severity === "LOW") {
    severity = "MEDIUM"
  }

  return severity
}

/**
 * Map Solarman alert status / endTime to our alert_status enum
 *
 * The PRO alert endpoint returns:
 * - status: 1/2/... (vendor-specific)
 * - endTime: null for active alerts, epoch seconds for resolved alerts
 *
 * We primarily rely on endTime for ACTIVE/RESOLVED distinction.
 */
function mapAlertStatus(endTime: number | null | undefined): AlertStatus {
  if (!endTime) {
    return "ACTIVE"
  }
  return "RESOLVED"
}

/**
 * Convert Unix seconds (as number) to JS Date (TIMESTAMPTZ)
 */
function fromUnixSeconds(value: number | null | undefined): Date | null {
  if (!value || Number.isNaN(value)) return null
  return new Date(Math.floor(value) * 1000)
}

/**
 * Sync alerts for a single Solarman vendor using the PRO station alert API.
 *
 * This implementation:
 * - Uses page size = 100
 * - Paginates until no data is returned
 * - Filters alerts to deviceType === "INVERTER"
 * - Restricts lookback window to (configured alertsStartDate, max 1 year)
 */
async function syncSolarmanVendorAlerts(vendor: any, supabase: any): Promise<AlertSyncResult> {
  const startTime = Date.now()
  const result: AlertSyncResult = {
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
    // Resolve org name (for logging only)
    if (vendor.org_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", vendor.org_id)
        .single()
      result.orgName = org?.name
    }

    const vendorConfig: VendorConfig = {
      id: vendor.id,
      name: vendor.name,
      vendorType: vendor.vendor_type as "SOLARMAN" | "SUNGROW" | "OTHER",
      credentials: vendor.credentials as Record<string, any>,
      isActive: vendor.is_active,
    }

    const adapter: any = VendorManager.getAdapter(vendorConfig)

    // If adapter supports DB-backed token storage, wire it up
    if (typeof adapter.setTokenStorage === "function") {
      adapter.setTokenStorage(vendor.id, supabase)
    }

    // Authenticate (uses DB token if valid)
    await adapter.authenticate()

    // Build plant mapping: Solarman stationId -> internal plant_id
    const { data: plants, error: plantsError } = await supabase
      .from("plants")
      .select("id, vendor_plant_id")
      .eq("vendor_id", vendor.id)

    if (plantsError) {
      throw new Error(`Failed to fetch plants for vendor ${vendor.id}: ${plantsError.message}`)
    }

    const stationToPlant = new Map<number, { plantId: number; vendorPlantId: string }>()
    ;(plants || []).forEach((p: any) => {
      const stationId = Number(p.vendor_plant_id)
      if (!Number.isNaN(stationId)) {
        stationToPlant.set(stationId, {
          plantId: p.id,
          vendorPlantId: p.vendor_plant_id as string,
        })
      }
    })

    if (stationToPlant.size === 0) {
      logger.info(
        `ℹ️ No plants found for vendor ${vendor.id} when syncing alerts; nothing to do.`
      )
      result.success = true
      return result
    }

    // Determine lookback window (startDay/endDay) in station timezone
    const startDate = getVendorAlertsStartDate(vendor)
    const endDate = new Date()

    const formatDay = (d: Date) => d.toISOString().slice(0, 10) // YYYY-MM-DD
    const startDay = formatDay(startDate)
    const endDay = formatDay(endDate)

    const pageSize = 100
    let page = 1
    let totalFromVendor = 0

    logger.info(
      `📥 Syncing Solarman alerts for vendor ${vendor.name} (${vendor.id}) from ${startDay} to ${endDay} with page size ${pageSize}`
    )

    // Use Solarman PRO base URL
    const { url: proBaseUrl } = (adapter as any).getProApiBaseUrl
      ? (adapter as any).getProApiBaseUrl()
      : { url: adapter.getApiBaseUrl() }

    // Pagination loop
    // We stop when a page returns no data
    let hasMore = true

    while (hasMore) {
      // Request per vendor sample:
      // POST /maintain-s/operating/station/alert?order.direction=ASC&order.property=alertTime&size=100&page=N
      const query = new URLSearchParams({
        "order.direction": "ASC",
        "order.property": "alertTime",
        size: pageSize.toString(),
        page: page.toString(),
      })

      const url = `${proBaseUrl}/maintain-s/operating/station/alert?${query.toString()}`

      const body = {
        alertQueryName: null, // null => all alert types
        language: "en",
        status: "-1", // all
        timeZone: "Asia/Calcutta",
        deviceId: null,
        endDay,
        plantIdList: null,
        groupIdList: null,
        startDay,
      }

      const response = await (adapter as any).loggedFetch(
        url,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Authorization header is injected by adapter.authenticate() via loggedFetch when using fetchWithAuth,
            // but here we call loggedFetch directly, so add Bearer token manually.
            Authorization: `Bearer ${await adapter.authenticate()}`,
          },
          body: JSON.stringify(body),
        },
        {
          operation: "SYNC_ALERTS_SOLARMAN",
          description: `Fetch Solarman station alerts page ${page}`,
        }
      )

      if (!response.ok) {
        const text = await response.text()
        throw new Error(
          `Solarman alerts request failed (page ${page}): ${response.status} ${response.statusText} - ${text}`
        )
      }

      const data = await response.json()
      const alerts: any[] = Array.isArray(data.data) ? data.data : []

      if (page === 1) {
        totalFromVendor = typeof data.total === "number" ? data.total : alerts.length
      }

      if (!alerts.length) {
        hasMore = false
        break
      }

      result.total += alerts.length

      // Process and upsert alerts
      for (const raw of alerts) {
        // Only INVERTER deviceType as requested
        if (raw.deviceType !== "INVERTER") continue

        const stationId = Number(raw.stationId)
        const mapping = stationToPlant.get(stationId)
        if (!mapping) {
          // We don't have this station mapped to a plant yet; skip
          continue
        }

        const alertTimeDate = fromUnixSeconds(raw.alertTime)
        const endTimeDate = fromUnixSeconds(raw.endTime)

        let gridDownSeconds: number | null = null
        if (alertTimeDate && endTimeDate) {
          const diff = Math.floor(
            (endTimeDate.getTime() - alertTimeDate.getTime()) / 1000
          )
          gridDownSeconds = diff > 0 ? diff : 0
        }

        const severity = mapSolarmanSeverity(raw.level, raw.influence)
        const status = mapAlertStatus(raw.endTime)

        // Use id from response as vendor_alert_id to avoid collisions across vendors
        const vendorAlertId = raw.id?.toString()

        // Check for existing alert (prevent duplicates)
        const { data: existing, error: existingError } = await supabase
          .from("alerts")
          .select("id")
          .eq("vendor_id", vendor.id)
          .eq("vendor_alert_id", vendorAlertId)
          .eq("plant_id", mapping.plantId)
          .maybeSingle()

        if (existingError) {
          logger.warn(
            `⚠️ Error checking existing alert for vendor ${vendor.id}`,
            existingError
          )
        }

        const payload: any = {
          vendor_id: vendor.id,
          plant_id: mapping.plantId,
          vendor_plant_id: mapping.vendorPlantId,
          vendor_alert_id: vendorAlertId,
          title: raw.alertName || "Alert",
          description: null,
          severity,
          status,
          station_id: stationId,
          device_type: raw.deviceType ?? null,
          alert_time: alertTimeDate ? alertTimeDate.toISOString() : null,
          end_time: endTimeDate ? endTimeDate.toISOString() : null,
          grid_down_seconds: gridDownSeconds,
          metadata: raw,
        }

        if (existing) {
          const { error: updateError } = await supabase
            .from("alerts")
            .update(payload)
            .eq("id", existing.id)

          if (updateError) {
            logger.error(
              `❌ Failed to update alert ${existing.id} for vendor ${vendor.id}`,
              updateError
            )
          } else {
            result.updated += 1
            result.synced += 1
          }
        } else {
          const { error: insertError } = await supabase.from("alerts").insert(payload)
          if (insertError) {
            logger.error(
              `❌ Failed to insert alert for vendor ${vendor.id} (plant ${mapping.plantId})`,
              insertError
            )
          } else {
            result.created += 1
            result.synced += 1
          }
        }
      }

      // If this page returned fewer than pageSize, we've reached the end
      if (alerts.length < pageSize) {
        hasMore = false
      } else {
        page += 1
      }
    }

    const duration = Date.now() - startTime
    result.success = true

    logger.info(
      `✅ Solarman alert sync complete for vendor ${vendor.name} (${vendor.id}): ${result.synced}/${result.total} alerts processed in ${duration}ms`
    )

    // If we actually synced any alerts, record the timestamp on the vendor
    if (result.synced > 0) {
      try {
        await supabase
          .from("vendors")
          .update({ last_alert_synced_at: new Date().toISOString() })
          .eq("id", vendor.id)
      } catch (error: any) {
        logger.warn(
          `⚠️ Failed to update last_alert_synced_at for vendor ${vendor.id}`,
          error
        )
      }
    }

    return result
  } catch (error: any) {
    logger.error(
      `❌ Error syncing alerts for Solarman vendor ${vendor.name} (${vendor.id})`,
      error
    )
    result.error = error.message || "Unknown error"
    return result
  }
}

/**
 * Sync alerts for all active vendors (currently only SOLARMAN is implemented).
 *
 * This is analogous to `syncAllPlants` but focused on alerts.
 */
export async function syncAllAlerts(): Promise<AlertSyncSummary> {
  const startTime = Date.now()
  const supabase = getMainClient()

  const source = MDC.getSource() || "system"
  logger.info(`🚀 Starting alert sync for all vendors (source: ${source})...`)

  // Fetch active vendors with organization info
  const { data: vendors, error: vendorsError } = await supabase
    .from("vendors")
    .select(
      `
      *,
      organizations (
        id,
        name,
        auto_sync_enabled,
        sync_interval_minutes
      )
    `
    )
    .eq("is_active", true)
    .not("org_id", "is", null)

  if (vendorsError) {
    throw new Error(`Failed to fetch vendors for alert sync: ${vendorsError.message}`)
  }

  if (!vendors || vendors.length === 0) {
    logger.info("No active vendors found for alert sync")
    return {
      totalVendors: 0,
      successful: 0,
      failed: 0,
      totalAlertsSynced: 0,
      totalAlertsCreated: 0,
      totalAlertsUpdated: 0,
      results: [],
      duration: Date.now() - startTime,
    }
  }

  // For now, only Solarman is supported; others are skipped but keep structure generic
  const solarmanVendors = vendors.filter(
    (v: any) => v.vendor_type === "SOLARMAN"
  )

  if (solarmanVendors.length === 0) {
    logger.info("No SOLARMAN vendors found for alert sync")
    return {
      totalVendors: vendors.length,
      successful: 0,
      failed: 0,
      totalAlertsSynced: 0,
      totalAlertsCreated: 0,
      totalAlertsUpdated: 0,
      results: [],
      duration: Date.now() - startTime,
    }
  }

  logger.info(`Processing ${solarmanVendors.length} SOLARMAN vendor(s) for alert sync`)

  const results = await Promise.all(
    solarmanVendors.map((vendor: any) =>
      MDC.withContextAsync(
        {
          vendorId: vendor.id,
          vendorName: vendor.name,
          orgId: vendor.org_id,
          operation: `sync-alerts-vendor-${vendor.id}`,
        },
        () => syncSolarmanVendorAlerts(vendor, supabase)
      )
    )
  )

  const successful = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length
  const totalAlertsSynced = results.reduce((sum, r) => sum + r.synced, 0)
  const totalAlertsCreated = results.reduce((sum, r) => sum + r.created, 0)
  const totalAlertsUpdated = results.reduce((sum, r) => sum + r.updated, 0)

  const summary: AlertSyncSummary = {
    totalVendors: solarmanVendors.length,
    successful,
    failed,
    totalAlertsSynced,
    totalAlertsCreated,
    totalAlertsUpdated,
    results,
    duration: Date.now() - startTime,
  }

  logger.info(
    `✅ Alert sync complete: ${successful}/${summary.totalVendors} vendors successful, ` +
      `${totalAlertsSynced} alerts synced (${totalAlertsCreated} created, ${totalAlertsUpdated} updated) ` +
      `in ${summary.duration}ms`
  )

  return summary
}

/**
 * Sync alerts for a single vendor by ID (currently Solarman only).
 * Used by per-vendor manual sync endpoints / UI.
 */
export async function syncAlertsForVendor(vendorId: number): Promise<AlertSyncResult> {
  const supabase = getMainClient()

  const { data: vendor, error } = await supabase
    .from("vendors")
    .select(
      `
      *,
      organizations (
        id,
        name,
        auto_sync_enabled,
        sync_interval_minutes
      )
    `
    )
    .eq("id", vendorId)
    .single()

  if (error || !vendor) {
    throw new Error(`Vendor ${vendorId} not found for alert sync`)
  }

  if (!vendor.is_active) {
    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      orgId: vendor.org_id,
      orgName: vendor.organizations?.name,
      success: true,
      synced: 0,
      created: 0,
      updated: 0,
      total: 0,
      error: undefined,
    }
  }

  if (vendor.vendor_type !== "SOLARMAN") {
    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      orgId: vendor.org_id,
      orgName: vendor.organizations?.name,
      success: false,
      synced: 0,
      created: 0,
      updated: 0,
      total: 0,
      error: "Alert sync is currently implemented only for SOLARMAN vendors",
    }
  }

  return syncSolarmanVendorAlerts(vendor, supabase)
}


