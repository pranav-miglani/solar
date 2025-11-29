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
 * Map SolarDM fault level to our severity enum
 */
function mapSolarDmSeverity(faultLevel: number | null | undefined): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const severityMap: Record<number, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = {
    1: "LOW",
    2: "MEDIUM",
    3: "HIGH",
    4: "CRITICAL",
  }
  
  return severityMap[faultLevel ?? 2] || "MEDIUM"
}

// Cache of Intl.DateTimeFormat instances per timezone to avoid recreating objects in loops
const TIMEZONE_FORMATTERS = new Map<string, Intl.DateTimeFormat>()

/**
 * Lazily create / reuse a formatter for the requested timezone so that downstream helpers
 * can convert dates without repeatedly allocating expensive Intl objects.
 */
function getTimeZoneFormatter(timeZone: string) {
  if (!TIMEZONE_FORMATTERS.has(timeZone)) {
    TIMEZONE_FORMATTERS.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    )
  }
  return TIMEZONE_FORMATTERS.get(timeZone)!
}

/**
 * Break a UTC date into local (year/month/day/hour/...) parts for a timezone. Returns null
 * when the timezone cannot be resolved, letting callers fall back gracefully.
 */
function getDatePartsForTimeZone(date: Date, timeZone: string) {
  try {
    const formatter = getTimeZoneFormatter(timeZone)
    const parts = formatter.formatToParts(date)
    const values: Record<string, number> = {}
    for (const part of parts) {
      if (part.type !== "literal") {
        values[part.type] = parseInt(part.value, 10)
      }
    }
    if (!values.year || !values.month || !values.day) {
      return null
    }
    return {
      year: values.year,
      month: values.month,
      day: values.day,
      hour: values.hour ?? 0,
      minute: values.minute ?? 0,
      second: values.second ?? 0,
    }
  } catch (error) {
    logger.warn(`⚠️ Failed to resolve timezone parts for ${timeZone}`, error)
    return null
  }
}

/**
 * Compute the offset between UTC and the provided timezone for a specific instant.
 * Used to translate the 9AM–4PM window from local time back into UTC boundaries.
 */
function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getDatePartsForTimeZone(date, timeZone)
  if (!parts) return 0
  const asUTC = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )
  return asUTC - date.getTime()
}

/**
 * Build a Date representing the provided local (year/month/day/hour/minute) in the requested
 * timezone, but expressed in UTC so arithmetic can be done with standard JS Dates.
 */
function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
) {
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0))
  const offset = getTimeZoneOffsetMs(utcDate, timeZone)
  return new Date(utcDate.getTime() - offset)
}

export function calculateGridDownHoursWithinWindow(
  start: Date,
  end: Date,
  timeZone: string
): number {
  if (!start || !end || end <= start) return 0
  const tz = timeZone || "Asia/Calcutta"
  let totalMs = 0
  let cursor = start

  while (cursor < end) {
    const parts = getDatePartsForTimeZone(cursor, tz)
    if (!parts) {
      break
    }

    const windowStart = zonedDateTimeToUtc(parts.year, parts.month, parts.day, 9, 0, tz)
    const windowEnd = zonedDateTimeToUtc(parts.year, parts.month, parts.day, 16, 0, tz)
    const overlapStart = Math.max(cursor.getTime(), windowStart.getTime())
    const overlapEnd = Math.min(end.getTime(), windowEnd.getTime())

    if (overlapEnd > overlapStart) {
      totalMs += overlapEnd - overlapStart
    }

    const nextDayUtc = zonedDateTimeToUtc(parts.year, parts.month, parts.day + 1, 0, 0, tz)
    if (nextDayUtc.getTime() <= cursor.getTime()) {
      cursor = new Date(cursor.getTime() + 60 * 1000)
    } else {
      cursor = nextDayUtc
    }
  }

  return totalMs / (1000 * 60 * 60)
}

export function calculateGridDownBenefitKwh(
  start: Date | null,
  end: Date | null,
  capacityKw: number | null | undefined,
  timeZone: string | undefined
): number | null {
  if (!start || !end || !capacityKw || capacityKw <= 0) {
    return null
  }

  const hours = calculateGridDownHoursWithinWindow(start, end, timeZone || "Asia/Calcutta")
  if (hours <= 0) {
    return null
  }

  const benefit = 0.5 * hours * capacityKw
  return Number(benefit.toFixed(3))
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
 * - Filters alerts to deviceType === "INVERTER" (filtered but not stored)
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
      .select("id, vendor_plant_id, capacity_kw")
      .eq("vendor_id", vendor.id)

    if (plantsError) {
      throw new Error(`Failed to fetch plants for vendor ${vendor.id}: ${plantsError.message}`)
    }

    const stationToPlant = new Map<
      number,
      { plantId: number; vendorPlantId: string; capacityKw: number | null }
    >()
    ;(plants || []).forEach((p: any) => {
      const stationId = Number(p.vendor_plant_id)
      if (!Number.isNaN(stationId)) {
        stationToPlant.set(stationId, {
          plantId: p.id,
          vendorPlantId: p.vendor_plant_id as string,
          capacityKw: typeof p.capacity_kw === "number" ? p.capacity_kw : Number(p.capacity_kw) || null,
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
        // Filter alerts to the specific rule "No Mains Voltage"
        alertQueryName: "No Mains Voltage",
        language: "en",
        status: "-1", // all statuses
        timeZone: "Asia/Calcutta",
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

        const gridDownBenefitKwh = calculateGridDownBenefitKwh(
          alertTimeDate,
          endTimeDate,
          mapping.capacityKw,
          raw.timezone
        )

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
          alert_time: alertTimeDate ? alertTimeDate.toISOString() : null,
          end_time: endTimeDate ? endTimeDate.toISOString() : null,
          grid_down_seconds: gridDownSeconds,
          grid_down_benefit_kwh: gridDownBenefitKwh,
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
 * Sync alerts for a single SolarDM vendor using the inverter fault API.
 *
 * This implementation:
 * - Uses page size = 100
 * - Paginates until current > pages
 * - Filters alerts to "There is no mains voltage" (faultInfo)
 * - Restricts lookback window to (configured alertsStartDate, max 1 year)
 */
async function syncSolarDmVendorAlerts(vendor: any, supabase: any): Promise<AlertSyncResult> {
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
      vendorType: vendor.vendor_type as "SOLARDM" | "SOLARMAN" | "SUNGROW" | "OTHER",
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

    // Build plant mapping: SolarDM plantId -> internal plant_id
    const { data: plants, error: plantsError } = await supabase
      .from("plants")
      .select("id, vendor_plant_id, capacity_kw")
      .eq("vendor_id", vendor.id)

    if (plantsError) {
      throw new Error(`Failed to fetch plants for vendor ${vendor.id}: ${plantsError.message}`)
    }

    const plantIdToPlant = new Map<
      string,
      { plantId: number; vendorPlantId: string; capacityKw: number | null }
    >()
    ;(plants || []).forEach((p: any) => {
      const vendorPlantId = p.vendor_plant_id as string
      if (vendorPlantId) {
        plantIdToPlant.set(vendorPlantId, {
          plantId: p.id,
          vendorPlantId,
          capacityKw: typeof p.capacity_kw === "number" ? p.capacity_kw : Number(p.capacity_kw) || null,
        })
      }
    })

    if (plantIdToPlant.size === 0) {
      logger.info(
        `ℹ️ No plants found for vendor ${vendor.id} when syncing alerts; nothing to do.`
      )
      result.success = true
      return result
    }

    // Determine lookback window
    const startDate = getVendorAlertsStartDate(vendor)
    const endDate = new Date()

    logger.info(
      `📥 Syncing SolarDM alerts for vendor ${vendor.name} (${vendor.id}) from ${startDate.toISOString()} to ${endDate.toISOString()}`
    )

    // Fetch all alerts with pagination
    const allAlerts = await adapter.getAllAlerts(startDate, endDate)

    result.total = allAlerts.length

    // Process and upsert alerts
    for (const raw of allAlerts) {
      const vendorPlantId = raw.plantId?.toString()
      const mapping = vendorPlantId ? plantIdToPlant.get(vendorPlantId) : null
      
      if (!mapping) {
        // We don't have this plant mapped yet; skip
        continue
      }

      // Parse timestamps
      // SolarDM format: "2025-11-29 06:58:21"
      let alertTimeDate: Date | null = null
      let endTimeDate: Date | null = null

      if (raw.happenTime) {
        // Convert "2025-11-29 06:58:21" to ISO format
        const happenTimeStr = raw.happenTime.replace(" ", "T")
        alertTimeDate = new Date(happenTimeStr)
        if (Number.isNaN(alertTimeDate.getTime())) {
          alertTimeDate = null
        }
      }

      if (raw.recoverTime) {
        const recoverTimeStr = raw.recoverTime.replace(" ", "T")
        endTimeDate = new Date(recoverTimeStr)
        if (Number.isNaN(endTimeDate.getTime())) {
          endTimeDate = null
        }
      }

      // Filter by date range
      if (alertTimeDate) {
        if (alertTimeDate < startDate || alertTimeDate > endDate) {
          continue
        }
      }

      let gridDownSeconds: number | null = null
      if (alertTimeDate && endTimeDate) {
        const diff = Math.floor(
          (endTimeDate.getTime() - alertTimeDate.getTime()) / 1000
        )
        gridDownSeconds = diff > 0 ? diff : 0
      }

      // Use Asia/Calcutta as default timezone (same as Solarman)
      const gridDownBenefitKwh = calculateGridDownBenefitKwh(
        alertTimeDate,
        endTimeDate,
        mapping.capacityKw,
        "Asia/Calcutta"
      )

      const severity = mapSolarDmSeverity(raw.faultLevel)
      const status = mapAlertStatus(raw.recoverTime ? 1 : null)

      // Use id from response as vendor_alert_id
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
        title: raw.faultInfoEN || raw.faultInfo || "Alert",
        description: raw.faultInfo || null,
        severity,
        status,
        alert_time: alertTimeDate ? alertTimeDate.toISOString() : null,
        end_time: endTimeDate ? endTimeDate.toISOString() : null,
        grid_down_seconds: gridDownSeconds,
        grid_down_benefit_kwh: gridDownBenefitKwh,
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
            `❌ Failed to insert alert for vendor ${vendor.id}, plant ${mapping.plantId}`,
            insertError
          )
        } else {
          result.created += 1
          result.synced += 1
        }
      }
    }

    // Update vendor's last_alert_synced_at
    await supabase
      .from("vendors")
      .update({ last_alert_synced_at: new Date().toISOString() })
      .eq("id", vendor.id)

    result.success = true

    const duration = Date.now() - startTime
    logger.info(
      `✅ Synced ${result.synced} SolarDM alerts for vendor ${vendor.name} (${vendor.id}): ${result.created} created, ${result.updated} updated (${duration}ms)`
    )
  } catch (error: any) {
    result.error = error.message || String(error)
    logger.error(
      `❌ Failed to sync SolarDM alerts for vendor ${vendor.id} (${vendor.name})`,
      error
    )
  }

  return result
}

/**
 * Sync alerts for all active vendors (SOLARMAN and SOLARDM are implemented).
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

  // Filter to SOLARMAN and SOLARDM vendors only
  const supportedVendors = vendors.filter(
    (v: any) => v.vendor_type === "SOLARMAN" || v.vendor_type === "SOLARDM"
  )

  if (supportedVendors.length === 0) {
    logger.info("No SOLARMAN or SOLARDM vendors found for alert sync")
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

  const solarmanCount = supportedVendors.filter((v: any) => v.vendor_type === "SOLARMAN").length
  const solardmCount = supportedVendors.filter((v: any) => v.vendor_type === "SOLARDM").length
  logger.info(`Processing ${supportedVendors.length} vendor(s) for alert sync (${solarmanCount} SOLARMAN, ${solardmCount} SOLARDM)`)

  const results = await Promise.all(
    supportedVendors.map((vendor: any) =>
      MDC.withContextAsync(
        {
          vendorId: vendor.id,
          vendorName: vendor.name,
          orgId: vendor.org_id,
          operation: `sync-alerts-vendor-${vendor.id}`,
        },
        () => {
          if (vendor.vendor_type === "SOLARMAN") {
            return syncSolarmanVendorAlerts(vendor, supabase)
          }
          if (vendor.vendor_type === "SOLARDM") {
            return syncSolarDmVendorAlerts(vendor, supabase)
          }
          return Promise.resolve({
            vendorId: vendor.id,
            vendorName: vendor.name,
            orgId: vendor.org_id,
            success: false,
            synced: 0,
            created: 0,
            updated: 0,
            total: 0,
            error: `Unsupported vendor type: ${vendor.vendor_type}`,
          })
        }
      )
    )
  )

  const successful = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length
  const totalAlertsSynced = results.reduce((sum, r) => sum + r.synced, 0)
  const totalAlertsCreated = results.reduce((sum, r) => sum + r.created, 0)
  const totalAlertsUpdated = results.reduce((sum, r) => sum + r.updated, 0)

  const summary: AlertSyncSummary = {
    totalVendors: supportedVendors.length,
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

  if (vendor.vendor_type === "SOLARMAN") {
    return syncSolarmanVendorAlerts(vendor, supabase)
  }

  if (vendor.vendor_type === "SOLARDM") {
    return syncSolarDmVendorAlerts(vendor, supabase)
  }

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
    error: `Alert sync is not implemented for vendor type: ${vendor.vendor_type}`,
  }
}


