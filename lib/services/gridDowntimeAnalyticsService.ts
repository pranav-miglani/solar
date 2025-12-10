import { logger } from "@/lib/context/logger"
import { getAnalyticsClient, getMainClient } from "@/lib/supabase/pooled"
import { calculateGridDownHoursWithinWindow } from "@/lib/services/alertSyncService"

type GridDowntimeSummary = {
  plantsProcessed: number
  daysProcessed: number
  rowsUpserted: number
  rowsDeleted: number
}

const WINDOW_DAYS = 100
const TIME_ZONE = "Asia/Kolkata"

type AlertRecord = {
  alert_time: string | null
  end_time: string | null
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime())
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function toIstDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function getIstDayBounds(date: Date) {
  // Given a Date (any time), return the UTC Date objects representing
  // the start/end of that IST day and the 9-16 IST window.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year = Number(parts.find((p) => p.type === "year")?.value)
  const month = Number(parts.find((p) => p.type === "month")?.value)
  const day = Number(parts.find((p) => p.type === "day")?.value)

  const toUtc = (h: number, m: number, s: number) => {
    // Construct an ISO string in IST and parse as UTC to get UTC instant
    const pad = (n: number) => n.toString().padStart(2, "0")
    return new Date(`${year}-${pad(month)}-${pad(day)}T${pad(h)}:${pad(m)}:${pad(s)}+05:30`)
  }

  const dayStartUtc = toUtc(0, 0, 0)
  const dayEndUtc = toUtc(23, 59, 59)
  const windowStartUtc = toUtc(9, 0, 0)
  const windowEndUtc = toUtc(16, 0, 0)

  return { dayStartUtc, dayEndUtc, windowStartUtc, windowEndUtc }
}

function computeDailySecondsForAlert(alert: AlertRecord, windowStart: Date, windowEnd: Date): Map<string, number> {
  const daily = new Map<string, number>()

  if (!alert.alert_time) {
    return daily
  }

  const start = new Date(alert.alert_time)
  const rawEnd = alert.end_time ? new Date(alert.end_time) : null
  const end = rawEnd && rawEnd.getTime() > 0 ? rawEnd : windowEnd

  // Clamp to overall window
  const clampedStart = start.getTime() < windowStart.getTime() ? windowStart : start
  const clampedEnd = end.getTime() > windowEnd.getTime() ? windowEnd : end

  if (clampedEnd <= clampedStart) {
    return daily
  }

  let cursor = clampedStart
  while (cursor <= clampedEnd) {
    const { dayStartUtc, dayEndUtc, windowStartUtc, windowEndUtc } = getIstDayBounds(cursor)

    // Segment for this IST day
    const segmentStart = new Date(Math.max(clampedStart.getTime(), dayStartUtc.getTime()))
    const segmentEnd = new Date(Math.min(clampedEnd.getTime(), dayEndUtc.getTime()))

    if (segmentEnd > segmentStart) {
      // Overlap with 9-16 IST window
      const overlapStart = new Date(Math.max(segmentStart.getTime(), windowStartUtc.getTime()))
      const overlapEnd = new Date(Math.min(segmentEnd.getTime(), windowEndUtc.getTime()))

      if (overlapEnd > overlapStart) {
        const seconds = Math.max(0, Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 1000))
        if (seconds > 0) {
          const dateKey = toIstDateString(segmentStart)
          daily.set(dateKey, (daily.get(dateKey) || 0) + seconds)
        }
      }
    }

    // Move to next IST day
    const nextDay = addDays(dayStartUtc, 1)
    if (nextDay.getTime() <= cursor.getTime()) {
      cursor = new Date(cursor.getTime() + 60 * 1000)
    } else {
      cursor = nextDay
    }
  }

  return daily
}

export async function runGridDowntimeAnalytics(days: number = WINDOW_DAYS): Promise<GridDowntimeSummary> {
  const main = getMainClient()
  const analytics = getAnalyticsClient()

  const summary: GridDowntimeSummary = {
    plantsProcessed: 0,
    daysProcessed: 0,
    rowsUpserted: 0,
    rowsDeleted: 0,
  }

  // Define window (IST)
  const todayUtc = new Date()
  const windowEnd = getIstDayBounds(todayUtc).dayEndUtc
  const windowStart = addDays(getIstDayBounds(todayUtc).dayStartUtc, -(days - 1))

  // Cleanup old rows (global delete older than window start)
  const { error: deleteError } = await analytics
    .from("plant_grid_downtime_readings")
    .delete()
    .lt("reading_date", toIstDateString(windowStart))

  if (deleteError) {
    logger.error("[Grid Downtime] Failed to cleanup old rows", { error: deleteError.message })
  }

  // Fetch plants from main DB
  const { data: plants, error: plantError } = await main
    .from("plants")
    .select("id, org_id, vendor_id, vendor_plant_id, name, capacity_kw")

  if (plantError) {
    logger.error("[Grid Downtime] Failed to fetch plants", { error: plantError.message })
    throw plantError
  }

  logger.info("[Grid Downtime] Starting computation", {
    plantCount: plants?.length || 0,
    windowDays: days,
  })

  for (const plant of plants || []) {
    summary.plantsProcessed++

    // Fetch relevant alerts for this plant within window
    const { data: alerts, error: alertError } = await main
      .from("alerts")
      .select("alert_time, end_time")
      .eq("plant_id", plant.id)
      .eq("description", "GRID_DOWN")
      .lte("alert_time", windowEnd.toISOString())
      .or(`end_time.is.null,end_time.gte.${windowStart.toISOString()}`)

    if (alertError) {
      logger.error("[Grid Downtime] Failed to fetch alerts", { plantId: plant.id, error: alertError.message })
      continue
    }

    // Build daily map
    const dailySeconds = new Map<string, number>()

    for (const alert of alerts as AlertRecord[]) {
      const contribution = computeDailySecondsForAlert(alert, windowStart, windowEnd)
      for (const [dateKey, seconds] of contribution.entries()) {
        dailySeconds.set(dateKey, (dailySeconds.get(dateKey) || 0) + seconds)
      }
    }

    // Prepare ordered dates for window
    const dates: string[] = []
    let cursor = windowStart
    while (cursor <= windowEnd) {
      dates.push(toIstDateString(cursor))
      cursor = addDays(cursor, 1)
    }

    // Get baseline total from the last reading before windowStart
    let lastTotal: number | null = null
    const { data: baselineRow, error: baselineError } = await analytics
      .from("plant_grid_downtime_readings")
      .select("total_grid_down_seconds, reading_date")
      .eq("plant_id", plant.id)
      .lt("reading_date", toIstDateString(windowStart))
      .order("reading_date", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (baselineError) {
      logger.error("[Grid Downtime] Failed to fetch baseline total", {
        plantId: plant.id,
        error: baselineError.message,
      })
    } else if (baselineRow && typeof baselineRow.total_grid_down_seconds === "number") {
      lastTotal = baselineRow.total_grid_down_seconds
    }

    const rows: {
      org_id: number
      vendor_id: number
      plant_id: number
      vendor_plant_id: string
      reading_date: string
      daily_grid_down_seconds: number
      total_grid_down_seconds: number
    }[] = []
    for (const dateKey of dates) {
      const daily = dailySeconds.get(dateKey) || 0
      summary.daysProcessed++
      const total: number = lastTotal === null ? daily : lastTotal + daily
      lastTotal = total

      rows.push({
        org_id: plant.org_id,
        vendor_id: plant.vendor_id,
        plant_id: plant.id,
        vendor_plant_id: plant.vendor_plant_id,
        reading_date: dateKey,
        daily_grid_down_seconds: daily,
        total_grid_down_seconds: total,
      })
    }

    // Upsert in batches of 100 to avoid payload limits
    const BATCH_SIZE = 100
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)
      const { error: upsertError } = await analytics
        .from("plant_grid_downtime_readings")
        .upsert(batch, { onConflict: "plant_id,reading_date" })

      if (upsertError) {
        logger.error("[Grid Downtime] Failed to upsert batch", {
          plantId: plant.id,
          batchStart: i,
          batchSize: batch.length,
          error: upsertError.message,
        })
        continue
      }

      summary.rowsUpserted += batch.length
    }
  }

  return summary
}

