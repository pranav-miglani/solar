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
  skipped: number // Alerts skipped due to no changes
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
  totalAlertsSkipped: number // Alerts skipped due to no changes
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
    skipped: 0,
    total: 0,
  }

  try {
    logger.info(`🚀 Starting Solarman alert sync for vendor ${vendor.name} (${vendor.id})`)

    // Resolve org name (for logging only)
    if (vendor.org_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", vendor.org_id)
        .single()
      result.orgName = org?.name
      if (org?.name) {
        logger.info(`📋 Organization: ${org.name} (${vendor.org_id})`)
      }
    }

    const vendorConfig: VendorConfig = {
      id: vendor.id,
      name: vendor.name,
      vendorType: vendor.vendor_type as "SOLARMAN" | "SOLARDM" | "SHINEMONITOR" | "PVBLINK" | "FOXESSCLOUD" | "OTHER",
      credentials: vendor.credentials as Record<string, any>,
      isActive: vendor.is_active,
    }

    logger.info(`🔧 Initializing Solarman adapter for vendor ${vendor.id}`)
    const adapter: any = VendorManager.getAdapter(vendorConfig)

    // If adapter supports DB-backed token storage, wire it up
    if (typeof adapter.setTokenStorage === "function") {
      adapter.setTokenStorage(vendor.id, supabase)
      logger.info(`💾 Token storage configured for vendor ${vendor.id}`)
    }

    // Authenticate (uses DB token if valid)
    logger.info(`🔐 Authenticating with Solarman API for vendor ${vendor.id}`)
    await adapter.authenticate()
    logger.info(`✅ Authentication successful for vendor ${vendor.id}`)

    // Build plant mapping: Solarman stationId -> internal plant_id
    logger.info(`🌱 Fetching plants for vendor ${vendor.id}`)
    const { data: plants, error: plantsError } = await supabase
      .from("plants")
      .select("id, vendor_plant_id, capacity_kw")
      .eq("vendor_id", vendor.id)

    if (plantsError) {
      throw new Error(`Failed to fetch plants for vendor ${vendor.id}: ${plantsError.message}`)
    }

    logger.info(`📊 Found ${plants?.length || 0} plants for vendor ${vendor.id}`)

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

    logger.info(`🗺️ Built plant mapping: ${stationToPlant.size} plants mapped`)

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

    logger.info(`📄 Starting pagination: page size ${pageSize}, lookback from ${startDay} to ${endDay}`)

    while (hasMore) {
      // Request per vendor sample:
      // POST /maintain-s/operating/station/alert?order.direction=ASC&order.property=alertTime&size=100&page=N
      logger.info(`📥 Fetching Solarman alerts page ${page}...`)
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
        logger.info(`📊 Total alerts from vendor API: ${totalFromVendor}`)
      }

      logger.info(`📦 Page ${page}: Received ${alerts.length} alerts`)

      if (!alerts.length) {
        logger.info(`✅ No more alerts on page ${page}, pagination complete`)
        hasMore = false
        break
      }

      result.total += alerts.length

      // Process and upsert alerts
      logger.info(`🔄 Processing ${alerts.length} alerts from page ${page}...`)
      let skippedCount = 0
      let processedCount = 0

      for (const raw of alerts) {
        // Only INVERTER deviceType as requested
        if (raw.deviceType !== "INVERTER") {
          skippedCount++
          continue
        }

        const stationId = Number(raw.stationId)
        const mapping = stationToPlant.get(stationId)
        if (!mapping) {
          // We don't have this station mapped to a plant yet; skip
          skippedCount++
          logger.debug(`⏭️ Skipping alert ${raw.id} - station ${stationId} not mapped to a plant`)
          continue
        }

        processedCount++

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
        // Uniqueness is based on: vendor_id, vendor_plant_id, vendor_alert_id
        // Note: plant_id is system's internal ID, vendor_plant_id is vendor's plant identifier
        // Fetch all relevant fields for comparison to avoid unnecessary updates
        const { data: allMatchingAlerts, error: countError } = await supabase
          .from("alerts")
          .select("id, created_at, title, description, severity, status, alert_time, end_time, grid_down_seconds, grid_down_benefit_kwh", { count: "exact" })
          .eq("vendor_id", vendor.id)
          .eq("vendor_alert_id", vendorAlertId)
          .eq("vendor_plant_id", mapping.vendorPlantId)
          .order("created_at", { ascending: false })

        if (countError) {
          logger.warn(
            `⚠️ Error checking existing alerts for vendor ${vendor.id} (${vendor.name || "Unknown"}):`,
            {
              vendorId: vendor.id,
              vendorName: vendor.name,
              vendorAlertId: vendorAlertId,
              plantId: mapping.plantId,
              vendorPlantId: mapping.vendorPlantId,
              error: countError,
              errorCode: countError.code,
              errorMessage: countError.message,
            }
          )
        }

        // Log duplicate detection
        const duplicateCount = allMatchingAlerts?.length || 0
        if (duplicateCount > 1) {
          const oldestAlert = allMatchingAlerts?.[duplicateCount - 1]
          const newestAlert = allMatchingAlerts?.[0]
          const timeSpanHours = oldestAlert && newestAlert
            ? Math.round((new Date(newestAlert.created_at).getTime() - new Date(oldestAlert.created_at).getTime()) / (1000 * 60 * 60))
            : 0

          logger.warn(
            `⚠️ Found ${duplicateCount} duplicate alerts for vendor ${vendor.id} (${vendor.name || "Unknown"})`,
            {
              vendorId: vendor.id,
              vendorName: vendor.name,
              vendorAlertId: vendorAlertId,
              plantId: mapping.plantId,
              vendorPlantId: mapping.vendorPlantId,
              duplicateCount: duplicateCount,
              alertIds: allMatchingAlerts?.map((a: any) => a.id) || [],
              oldestCreatedAt: oldestAlert?.created_at,
              newestCreatedAt: newestAlert?.created_at,
              timeSpanHours: timeSpanHours,
              action: "Using most recent alert, others will be ignored",
            }
          )
        }

        // Get the first (most recent) alert if multiple exist
        const existing = allMatchingAlerts && allMatchingAlerts.length > 0 ? allMatchingAlerts[0] : null

        if (existing) {
          logger.debug(
            `Found existing alert for vendor ${vendor.id} (${vendor.name || "Unknown"})`,
            {
              vendorId: vendor.id,
              vendorName: vendor.name,
              vendorAlertId: vendorAlertId,
              plantId: mapping.plantId,
              existingAlertId: existing.id,
              willUpdate: true,
            }
          )
        }

        const payload: any = {
          vendor_id: vendor.id,
          plant_id: mapping.plantId,
          vendor_plant_id: mapping.vendorPlantId,
          vendor_alert_id: vendorAlertId,
          title: raw.alertName || "Alert",
          description: raw.alertName === "No Mains Voltage" || raw.alertName === "There is no mains voltage" ? "GRID_DOWN" : raw.alertName || null,
          severity,
          status,
          alert_time: alertTimeDate ? alertTimeDate.toISOString() : null,
          end_time: endTimeDate ? endTimeDate.toISOString() : null,
          grid_down_seconds: gridDownSeconds,
          grid_down_benefit_kwh: gridDownBenefitKwh,
        }

        if (existing) {
          // Compare existing alert data with new payload to avoid unnecessary updates
          const existingAlertTime = existing.alert_time ? new Date(existing.alert_time).toISOString() : null
          const existingEndTime = existing.end_time ? new Date(existing.end_time).toISOString() : null
          const newAlertTime = payload.alert_time
          const newEndTime = payload.end_time

          const hasChanges = 
            existing.title !== payload.title ||
            existing.description !== payload.description ||
            existing.severity !== payload.severity ||
            existing.status !== payload.status ||
            existingAlertTime !== newAlertTime ||
            existingEndTime !== newEndTime ||
            existing.grid_down_seconds !== payload.grid_down_seconds ||
            (existing.grid_down_benefit_kwh !== null && payload.grid_down_benefit_kwh !== null && 
             Math.abs(Number(existing.grid_down_benefit_kwh) - Number(payload.grid_down_benefit_kwh)) > 0.001) ||
            (existing.grid_down_benefit_kwh === null && payload.grid_down_benefit_kwh !== null) ||
            (existing.grid_down_benefit_kwh !== null && payload.grid_down_benefit_kwh === null)

          if (!hasChanges) {
            logger.debug(
              `⏭️ Skipping update for alert ${existing.id} - no changes detected`,
              {
                vendorId: vendor.id,
                vendorAlertId: vendorAlertId,
                existingAlertId: existing.id,
              }
            )
            // Don't increment updated count, but still count as synced (processed) and skipped
            result.synced += 1
            result.skipped += 1
          } else {
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
              logger.debug(
                `✅ Updated alert ${existing.id} - changes detected`,
                {
                  vendorId: vendor.id,
                  vendorAlertId: vendorAlertId,
                  changes: {
                    title: existing.title !== payload.title,
                    description: existing.description !== payload.description,
                    severity: existing.severity !== payload.severity,
                    status: existing.status !== payload.status,
                    alert_time: existingAlertTime !== newAlertTime,
                    end_time: existingEndTime !== newEndTime,
                    grid_down_seconds: existing.grid_down_seconds !== payload.grid_down_seconds,
                    grid_down_benefit_kwh: existing.grid_down_benefit_kwh !== payload.grid_down_benefit_kwh,
                  },
                }
              )
            }
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
      `✅ Solarman alert sync complete for vendor ${vendor.name} (${vendor.id}): ${result.synced}/${result.total} alerts processed (${result.created} created, ${result.updated} updated, ${result.skipped} skipped) in ${duration}ms`
    )

    // Update vendor's last_alert_synced_at whenever sync completes successfully
    // This tracks when we last checked for alerts, even if none were found
    if (result.success) {
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
    skipped: 0,
    total: 0,
  }

  try {
    logger.info(`🚀 Starting SolarDM alert sync for vendor ${vendor.name} (${vendor.id})`)


    const vendorConfig: VendorConfig = {
      id: vendor.id,
      name: vendor.name,
      vendorType: vendor.vendor_type as "SOLARDM" | "SOLARMAN" | "SHINEMONITOR" | "PVBLINK" | "FOXESSCLOUD" | "OTHER",
      credentials: vendor.credentials as Record<string, any>,
      isActive: vendor.is_active,
    }

    logger.info(`🔧 Initializing adapter for vendor ${vendor.id}`)
    const adapter: any = VendorManager.getAdapter(vendorConfig)

    // If adapter supports DB-backed token storage, wire it up
    if (typeof adapter.setTokenStorage === "function") {
      adapter.setTokenStorage(vendor.id, supabase)
      logger.info(`💾 Token storage configured for vendor ${vendor.id}`)
    }

    // Authenticate (uses DB token if valid)
    logger.info(`🔐 Authenticating for vendor ${vendor.id}`)
    await adapter.authenticate()
    logger.info(`✅ Authentication successful for vendor ${vendor.id}`)

    // Build plant mapping: SolarDM plantId -> internal plant_id
    logger.info(`🌱 Fetching plants for vendor ${vendor.id}`)
    const { data: plants, error: plantsError } = await supabase
      .from("plants")
      .select("id, vendor_plant_id, capacity_kw")
      .eq("vendor_id", vendor.id)

    if (plantsError) {
      logger.error(`❌ Failed to fetch plants:`, plantsError)
      throw new Error(`Failed to fetch plants for vendor ${vendor.id}: ${plantsError.message}`)
    }

    logger.info(`📊 Found ${plants?.length || 0} plants for vendor ${vendor.id}`)

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
        logger.debug(`🗺️ Mapped plant: vendor_plant_id=${vendorPlantId} -> internal_id=${p.id}`)
      }
    })

    if (plantIdToPlant.size === 0) {
      logger.info(
        `ℹ️ No plants found for vendor ${vendor.id} when syncing alerts; nothing to do.`
      )
      result.success = true
      return result
    }

    logger.info(`🗺️ Built plant mapping: ${plantIdToPlant.size} plants mapped`)
    // Log plant IDs for debugging
    const mappedPlantIds = Array.from(plantIdToPlant.keys())
    logger.info(`📋 Mapped plant IDs (vendor_plant_id): ${mappedPlantIds.slice(0, 10).join(", ")}${mappedPlantIds.length > 10 ? ` ... (${mappedPlantIds.length} total)` : ""}`)

    // Determine lookback window
    const startDate = getVendorAlertsStartDate(vendor)
    const endDate = new Date()

    logger.info(
      `📥 Syncing SolarDM alerts for vendor ${vendor.name} (${vendor.id}) from ${startDate.toISOString()} to ${endDate.toISOString()}`
    )
    logger.info(`🌱 Plant mapping: ${plantIdToPlant.size} plants available for alert matching`)

    // Fetch all alerts with pagination (don't filter by date in adapter - do it here for better logging)
    logger.info(`📡 Fetching alerts from SolarDM API...`)
    logger.info(`📅 Date range filter: ${startDate.toISOString()} to ${endDate.toISOString()}`)
    
    let allAlerts: any[] = []
    try {
      allAlerts = await adapter.getAllAlerts()
      logger.info(`📦 Received ${allAlerts.length} total alerts from SolarDM API`)
      
      if (allAlerts.length === 0) {
        logger.warn(`⚠️ No alerts returned from SolarDM API. Possible reasons:`)
        logger.warn(`   1. No alerts exist for "There is no mains voltage" fault`)
        logger.warn(`   2. API authentication issue`)
        logger.warn(`   3. API endpoint issue`)
        logger.warn(`   4. All alerts are outside the date range`)
      } else {
        // Log sample alert for debugging
        logger.info(`📋 Sample alert (first of ${allAlerts.length}):`, {
          id: allAlerts[0]?.id,
          plantId: allAlerts[0]?.plantId,
          plantIdType: typeof allAlerts[0]?.plantId,
          happenTime: allAlerts[0]?.happenTime,
          recoverTime: allAlerts[0]?.recoverTime,
          faultInfo: allAlerts[0]?.faultInfo,
          faultLevel: allAlerts[0]?.faultLevel,
        })
        
        // Log unique plant IDs from alerts
        const alertPlantIds = [...new Set(allAlerts.map((a: any) => a.plantId?.toString()).filter(Boolean))]
        logger.info(`📋 Plant IDs from alerts: ${alertPlantIds.slice(0, 10).join(", ")}${alertPlantIds.length > 10 ? ` ... (${alertPlantIds.length} unique)` : ""}`)
        
        // Check overlap
        const mappedIds = Array.from(plantIdToPlant.keys())
        const overlap = alertPlantIds.filter(id => mappedIds.includes(id))
        logger.info(`🔍 Plant ID overlap: ${overlap.length} alerts match mapped plants out of ${alertPlantIds.length} unique plant IDs in alerts`)
      }
    } catch (apiError: any) {
      logger.error(`❌ Error fetching alerts from SolarDM API:`, {
        error: apiError.message,
        stack: apiError.stack,
        vendorId: vendor.id,
      })
      throw apiError
    }

    result.total = allAlerts.length

    let skippedNoPlant = 0
    let skippedDateRange = 0
    let skippedInvalidDate = 0
    const skippedDateRangeDetails: Array<{ alertId: string; alertDate: string; reason: string; startDate: string; endDate: string }> = []
    const skippedNoPlantDetails: Array<{ alertId: string; vendorPlantId: string | null; vendorPlantIdType: string }> = []
    const skippedInvalidDateDetails: Array<{ alertId: string; rawDate: string; reason: string }> = []
    let processedCount = 0

    // Process and upsert alerts
    logger.info(`🔄 Processing ${allAlerts.length} alerts...`)
    for (const raw of allAlerts) {
      const vendorPlantId = raw.plantId?.toString()
      const mapping = vendorPlantId ? plantIdToPlant.get(vendorPlantId) : null
      
      if (!mapping) {
        // We don't have this plant mapped yet; skip
        skippedNoPlant++
        skippedNoPlantDetails.push({
          alertId: raw.id?.toString() || "unknown",
          vendorPlantId: vendorPlantId || null,
          vendorPlantIdType: typeof raw.plantId,
        })
        if (skippedNoPlant <= 5) {
          // Log first few skipped alerts for debugging
          logger.warn(`⏭️ Skipping alert ${raw.id} - plant ${vendorPlantId} (type: ${typeof raw.plantId}) not found in mapping. Available plant IDs: ${Array.from(plantIdToPlant.keys()).slice(0, 5).join(", ")}`)
        }
        continue
      }

      // Parse timestamps
      // SolarDM format: "2025-11-29 06:58:21"
      let alertTimeDate: Date | null = null
      let endTimeDate: Date | null = null

      if (raw.happenTime) {
        // Convert "2025-11-29 06:58:21" to ISO format
        // SolarDM returns dates in format "YYYY-MM-DD HH:mm:ss" (assumed to be local time)
        // We'll parse it as-is and let JavaScript handle it
        const happenTimeStr = raw.happenTime.replace(" ", "T")
        alertTimeDate = new Date(happenTimeStr)
        
        if (Number.isNaN(alertTimeDate.getTime())) {
          skippedInvalidDate++
          skippedInvalidDateDetails.push({
            alertId: raw.id?.toString() || "unknown",
            rawDate: raw.happenTime || "null",
            reason: "invalid_happenTime_format",
          })
          logger.warn(`⚠️ Invalid happenTime format: ${raw.happenTime} for alert ${raw.id}`)
          continue
        }
        
        logger.debug(`📅 Parsed happenTime: ${raw.happenTime} -> ${alertTimeDate.toISOString()}`)
      } else {
        skippedInvalidDate++
        skippedInvalidDateDetails.push({
          alertId: raw.id?.toString() || "unknown",
          rawDate: "null",
          reason: "missing_happenTime",
        })
        logger.warn(`⚠️ Missing happenTime for alert ${raw.id}`)
        continue
      }

      if (raw.recoverTime) {
        const recoverTimeStr = raw.recoverTime.replace(" ", "T")
        endTimeDate = new Date(recoverTimeStr)
        if (Number.isNaN(endTimeDate.getTime())) {
          logger.warn(`⚠️ Invalid recoverTime format: ${raw.recoverTime} for alert ${raw.id}`)
          endTimeDate = null
        } else {
          logger.debug(`📅 Parsed recoverTime: ${raw.recoverTime} -> ${endTimeDate.toISOString()}`)
        }
      }

      // Filter by date range
      if (alertTimeDate) {
        if (alertTimeDate < startDate) {
          skippedDateRange++
          const reason = `Alert date (${alertTimeDate.toISOString()}) is before configured start date (${startDate.toISOString()})`
          skippedDateRangeDetails.push({
            alertId: raw.id?.toString() || "unknown",
            alertDate: alertTimeDate.toISOString(),
            reason: "before_start_date",
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          })
          logger.debug(`⏭️ Skipping alert ${raw.id} - ${reason}`)
          continue
        }
        if (alertTimeDate > endDate) {
          skippedDateRange++
          const reason = `Alert date (${alertTimeDate.toISOString()}) is after configured end date (${endDate.toISOString()})`
          skippedDateRangeDetails.push({
            alertId: raw.id?.toString() || "unknown",
            alertDate: alertTimeDate.toISOString(),
            reason: "after_end_date",
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          })
          logger.debug(`⏭️ Skipping alert ${raw.id} - ${reason}`)
          continue
        }
      }

      processedCount++

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
      // Uniqueness is based on: vendor_id, vendor_plant_id, vendor_alert_id
      // Note: plant_id is system's internal ID, vendor_plant_id is vendor's plant identifier
      // Fetch all relevant fields for comparison to avoid unnecessary updates
      const { data: allMatchingAlerts, error: countError } = await supabase
        .from("alerts")
        .select("id, created_at, title, description, severity, status, alert_time, end_time, grid_down_seconds, grid_down_benefit_kwh", { count: "exact" })
        .eq("vendor_id", vendor.id)
        .eq("vendor_alert_id", vendorAlertId)
        .eq("vendor_plant_id", mapping.vendorPlantId)
        .order("created_at", { ascending: false })

      if (countError) {
        logger.warn(
          `⚠️ Error checking existing alerts for vendor ${vendor.id} (${vendor.name || "Unknown"}):`,
          {
            vendorId: vendor.id,
            vendorName: vendor.name,
            vendorAlertId: vendorAlertId,
            plantId: mapping.plantId,
            vendorPlantId: mapping.vendorPlantId,
            error: countError,
            errorCode: countError.code,
            errorMessage: countError.message,
          }
        )
      }

      // Log duplicate detection
      const duplicateCount = allMatchingAlerts?.length || 0
      if (duplicateCount > 1) {
        const oldestAlert = allMatchingAlerts?.[duplicateCount - 1]
        const newestAlert = allMatchingAlerts?.[0]
        const timeSpanHours = oldestAlert && newestAlert
          ? Math.round((new Date(newestAlert.created_at).getTime() - new Date(oldestAlert.created_at).getTime()) / (1000 * 60 * 60))
          : 0

        logger.warn(
          `⚠️ Found ${duplicateCount} duplicate alerts for vendor ${vendor.id} (${vendor.name || "Unknown"})`,
          {
            vendorId: vendor.id,
            vendorName: vendor.name,
            vendorAlertId: vendorAlertId,
            plantId: mapping.plantId,
            vendorPlantId: mapping.vendorPlantId,
            duplicateCount: duplicateCount,
            alertIds: allMatchingAlerts?.map((a: any) => a.id) || [],
            oldestCreatedAt: oldestAlert?.created_at,
            newestCreatedAt: newestAlert?.created_at,
            timeSpanHours: timeSpanHours,
            action: "Using most recent alert, others will be ignored",
          }
        )
      }

      // Get the first (most recent) alert if multiple exist
      const existing = allMatchingAlerts && allMatchingAlerts.length > 0 ? allMatchingAlerts[0] : null

      if (existing) {
        logger.debug(
          `Found existing alert for vendor ${vendor.id} (${vendor.name || "Unknown"})`,
          {
            vendorId: vendor.id,
            vendorName: vendor.name,
            vendorAlertId: vendorAlertId,
            plantId: mapping.plantId,
            existingAlertId: existing.id,
            willUpdate: true,
          }
        )
      }

      const payload: any = {
        vendor_id: vendor.id,
        plant_id: mapping.plantId,
        vendor_plant_id: mapping.vendorPlantId,
        vendor_alert_id: vendorAlertId,
        title: raw.faultInfo || "Alert",
        description: raw.faultInfo === "No Mains Voltage" || raw.faultInfo === "There is no mains voltage" ? "GRID_DOWN" : raw.faultInfo || null,
        severity,
        status,
        alert_time: alertTimeDate ? alertTimeDate.toISOString() : null,
        end_time: endTimeDate ? endTimeDate.toISOString() : null,
        grid_down_seconds: gridDownSeconds,
        grid_down_benefit_kwh: gridDownBenefitKwh,
      }

      if (existing) {
        // Compare existing alert data with new payload to avoid unnecessary updates
        const existingAlertTime = existing.alert_time ? new Date(existing.alert_time).toISOString() : null
        const existingEndTime = existing.end_time ? new Date(existing.end_time).toISOString() : null
        const newAlertTime = payload.alert_time
        const newEndTime = payload.end_time

        const hasChanges = 
          existing.title !== payload.title ||
          existing.description !== payload.description ||
          existing.severity !== payload.severity ||
          existing.status !== payload.status ||
          existingAlertTime !== newAlertTime ||
          existingEndTime !== newEndTime ||
          existing.grid_down_seconds !== payload.grid_down_seconds ||
          (existing.grid_down_benefit_kwh !== null && payload.grid_down_benefit_kwh !== null && 
           Math.abs(Number(existing.grid_down_benefit_kwh) - Number(payload.grid_down_benefit_kwh)) > 0.001) ||
          (existing.grid_down_benefit_kwh === null && payload.grid_down_benefit_kwh !== null) ||
          (existing.grid_down_benefit_kwh !== null && payload.grid_down_benefit_kwh === null)

        if (!hasChanges) {
          logger.debug(
            `⏭️ Skipping update for alert ${existing.id} - no changes detected`,
            {
              vendorId: vendor.id,
              vendorAlertId: vendorAlertId,
              existingAlertId: existing.id,
            }
          )
          // Don't increment updated count, but still count as synced (processed)
          // Also track as "skipped" for consistency with Solarman vendors
          result.synced += 1
          result.skipped += 1
        } else {
          logger.debug(`🔄 Updating existing alert ${existing.id} (vendor_alert_id: ${vendorAlertId})`)
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
            logger.debug(
              `✅ Updated alert ${existing.id} - changes detected`,
              {
                vendorId: vendor.id,
                vendorAlertId: vendorAlertId,
                changes: {
                  title: existing.title !== payload.title,
                  description: existing.description !== payload.description,
                  severity: existing.severity !== payload.severity,
                  status: existing.status !== payload.status,
                  alert_time: existingAlertTime !== newAlertTime,
                  end_time: existingEndTime !== newEndTime,
                  grid_down_seconds: existing.grid_down_seconds !== payload.grid_down_seconds,
                  grid_down_benefit_kwh: existing.grid_down_benefit_kwh !== payload.grid_down_benefit_kwh,
                },
              }
            )
          }
        }
      } else {
        logger.debug(`➕ Creating new alert (vendor_alert_id: ${vendorAlertId}, plant_id: ${mapping.plantId})`)
        const { error: insertError } = await supabase.from("alerts").insert(payload)

        if (insertError) {
          logger.error(
            `❌ Failed to insert alert for vendor ${vendor.id}, plant ${mapping.plantId}`,
            insertError
          )
        } else {
          result.created += 1
          result.synced += 1
          logger.debug(`✅ Created new alert`)
        }
      }
    }

    logger.info(`📊 Alert processing summary:`)
    logger.info(`   - Total from API: ${result.total}`)
    logger.info(`   - Processed: ${processedCount}`)
    logger.info(`   - Skipped (no plant mapping): ${skippedNoPlant}`)
    if (skippedNoPlant > 0 && skippedNoPlantDetails.length > 0) {
      logger.info(`   🌱 No plant mapping skip details:`)
      skippedNoPlantDetails.slice(0, 5).forEach((detail) => {
        logger.info(`      - Alert ${detail.alertId}: vendor_plant_id=${detail.vendorPlantId || "null"} (type: ${detail.vendorPlantIdType})`)
      })
      if (skippedNoPlantDetails.length > 5) {
        logger.info(`      ... and ${skippedNoPlantDetails.length - 5} more`)
      }
      logger.info(`   🌱 Total plants in mapping: ${plantIdToPlant.size}`)
    }
    logger.info(`   - Skipped (date range): ${skippedDateRange}`)
    if (skippedDateRange > 0 && skippedDateRangeDetails.length > 0) {
      logger.info(`   📅 Date range skip details:`)
      skippedDateRangeDetails.slice(0, 5).forEach((detail) => {
        const reasonText = detail.reason === "before_start_date" 
          ? `before start date (${detail.startDate})`
          : `after end date (${detail.endDate})`
        logger.info(`      - Alert ${detail.alertId}: ${detail.alertDate} (${reasonText})`)
      })
      if (skippedDateRangeDetails.length > 5) {
        logger.info(`      ... and ${skippedDateRangeDetails.length - 5} more`)
      }
      logger.info(`   📅 Configured date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)
    }
    logger.info(`   - Skipped (invalid date): ${skippedInvalidDate}`)
    if (skippedInvalidDate > 0 && skippedInvalidDateDetails.length > 0) {
      logger.info(`   ⚠️ Invalid date skip details:`)
      skippedInvalidDateDetails.slice(0, 5).forEach((detail) => {
        const reasonText = detail.reason === "invalid_happenTime_format"
          ? "invalid happenTime format"
          : "missing happenTime"
        logger.info(`      - Alert ${detail.alertId}: ${reasonText} (raw value: ${detail.rawDate})`)
      })
      if (skippedInvalidDateDetails.length > 5) {
        logger.info(`      ... and ${skippedInvalidDateDetails.length - 5} more`)
      }
    }
    logger.info(`   - Created: ${result.created}`)
    logger.info(`   - Updated: ${result.updated}`)
    if (result.skipped > 0) {
      logger.info(`   - Skipped (no changes): ${result.skipped}`)
    }

    // Update vendor's last_alert_synced_at
    await supabase
      .from("vendors")
      .update({ last_alert_synced_at: new Date().toISOString() })
      .eq("id", vendor.id)

    result.success = true

    const duration = Date.now() - startTime
    logger.info(
      `✅ Synced ${result.synced} SolarDM alerts for vendor ${vendor.name} (${vendor.id}): ${result.created} created, ${result.updated} updated, ${result.skipped} skipped (${duration}ms)`
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
        auto_sync_enabled
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
      totalAlertsSkipped: 0,
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
      totalAlertsSkipped: 0,
      results: [],
      duration: Date.now() - startTime,
    }
  }

  // Filter vendors by org-level auto_sync_enabled
  const vendorsToSync = supportedVendors.filter((vendor: any) => {
    const org = vendor.organizations
    if (!org) {
      logger.warn(`⚠️ Organization not found for vendor ${vendor.id} (${vendor.name}), skipping alert sync`)
      return false
    }

    // Check if auto-sync is enabled for the organization
    if (!org.auto_sync_enabled) {
      logger.info(
        `⏭️ Skipping alert sync for vendor ${vendor.id} (${vendor.name}): ` +
        `auto_sync_enabled=false for org ${org.id} (${org.name})`
      )
      return false
    }

    return true
  })

  if (vendorsToSync.length === 0) {
    logger.info("No vendors to sync (all orgs have auto_sync_enabled=false or missing org)")
    return {
      totalVendors: supportedVendors.length,
      successful: 0,
      failed: 0,
      totalAlertsSynced: 0,
      totalAlertsCreated: 0,
      totalAlertsUpdated: 0,
      totalAlertsSkipped: 0,
      results: [],
      duration: Date.now() - startTime,
    }
  }

  const solarmanCount = vendorsToSync.filter((v: any) => v.vendor_type === "SOLARMAN").length
  const solardmCount = vendorsToSync.filter((v: any) => v.vendor_type === "SOLARDM").length
  logger.info(`Processing ${vendorsToSync.length} vendor(s) for alert sync (${solarmanCount} SOLARMAN, ${solardmCount} SOLARDM)`)

  const results = await Promise.all(
    vendorsToSync.map((vendor: any) =>
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
            skipped: 0,
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
  const totalAlertsSkipped = results.reduce((sum, r) => sum + (r.skipped || 0), 0)

  const summary: AlertSyncSummary = {
    totalVendors: vendorsToSync.length,
    successful,
    failed,
    totalAlertsSynced,
    totalAlertsCreated,
    totalAlertsUpdated,
    totalAlertsSkipped,
    results,
    duration: Date.now() - startTime,
  }

  logger.info(
    `✅ Alert sync complete: ${successful}/${summary.totalVendors} vendors successful, ` +
      `${totalAlertsSynced} alerts synced (${totalAlertsCreated} created, ${totalAlertsUpdated} updated, ${totalAlertsSkipped} skipped) ` +
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
        auto_sync_enabled
      )
    `
    )
    .eq("id", vendorId)
    .single()

  if (error || !vendor) {
    throw new Error(`Vendor ${vendorId} not found for alert sync`)
  }

  // Check org-level auto_sync_enabled
  const org = vendor.organizations
  if (!org) {
    throw new Error(`Organization not found for vendor ${vendorId}`)
  }

  if (!org.auto_sync_enabled) {
    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      orgId: vendor.org_id,
      orgName: org.name,
      success: true,
      synced: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      total: 0,
      error: `Alert sync disabled for organization ${org.name} (auto_sync_enabled=false)`,
    }
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
      skipped: 0,
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
    skipped: 0,
    total: 0,
    error: `Alert sync is not implemented for vendor type: ${vendor.vendor_type}`,
  }
}


