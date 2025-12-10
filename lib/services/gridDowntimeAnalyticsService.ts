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
  plant_id: number
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

/**
 * Compute daily grid downtime seconds for a single alert
 * 
 * CORRECTNESS GUARANTEES:
 * 1. Open alerts (end_time = null): Capped at windowEnd
 * 2. Multi-day alerts: Split per IST day, each day gets only its portion
 * 3. 9-16 IST window: Only counts overlap with 9 AM - 4 PM IST
 * 4. Date boundaries: Strict IST day boundaries (00:00-23:59 IST)
 * 5. Zero contribution: Returns empty map if alert doesn't contribute
 */
function computeDailySecondsForAlert(alert: AlertRecord, windowStart: Date, windowEnd: Date): Map<string, number> {
  const daily = new Map<string, number>()

  // CORRECTNESS: Skip alerts without start time
  if (!alert.alert_time) {
    return daily
  }

  const start = new Date(alert.alert_time)
  const rawEnd = alert.end_time ? new Date(alert.end_time) : null
  // CORRECTNESS: Open alerts (end_time = null) are capped at windowEnd
  const end = rawEnd && rawEnd.getTime() > 0 ? rawEnd : windowEnd

  // CORRECTNESS: Clamp alert to overall window boundaries
  // This ensures we only count downtime within the 100-day window
  const clampedStart = start.getTime() < windowStart.getTime() ? windowStart : start
  const clampedEnd = end.getTime() > windowEnd.getTime() ? windowEnd : end

  // CORRECTNESS: Skip if alert doesn't overlap with window at all
  if (clampedEnd <= clampedStart) {
    return daily
  }

  // CORRECTNESS: Iterate through each IST day the alert spans
  // Multi-day alerts are split per day, each day gets only its portion
  let cursor = clampedStart
  while (cursor <= clampedEnd) {
    const { dayStartUtc, dayEndUtc, windowStartUtc, windowEndUtc } = getIstDayBounds(cursor)

    // CORRECTNESS: Segment for this IST day (00:00-23:59 IST)
    const segmentStart = new Date(Math.max(clampedStart.getTime(), dayStartUtc.getTime()))
    const segmentEnd = new Date(Math.min(clampedEnd.getTime(), dayEndUtc.getTime()))

    if (segmentEnd > segmentStart) {
      // CORRECTNESS: Only count overlap with 9-16 IST window (9 AM - 4 PM IST)
      // This is the benefit calculation window
      const overlapStart = new Date(Math.max(segmentStart.getTime(), windowStartUtc.getTime()))
      const overlapEnd = new Date(Math.min(segmentEnd.getTime(), windowEndUtc.getTime()))

      if (overlapEnd > overlapStart) {
        // CORRECTNESS: Calculate seconds in the 9-16 IST overlap
        const seconds = Math.max(0, Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / 1000))
        if (seconds > 0) {
          const dateKey = toIstDateString(segmentStart)
          // CORRECTNESS: Add to daily map (multiple alerts on same day are additive)
          daily.set(dateKey, (daily.get(dateKey) || 0) + seconds)
        }
      }
    }

    // CORRECTNESS: Move to next IST day
    // This ensures we process each day the alert spans
    const nextDay = addDays(dayStartUtc, 1)
    if (nextDay.getTime() <= cursor.getTime()) {
      // Safety: If next day calculation fails, advance by 1 minute
      cursor = new Date(cursor.getTime() + 60 * 1000)
    } else {
      cursor = nextDay
    }
  }

  return daily
}

type PlantProcessingResult = {
  plantId: number
  rows: {
    org_id: number
    vendor_id: number
    plant_id: number
    vendor_plant_id: string
    reading_date: string
    daily_grid_down_seconds: number
    total_grid_down_seconds: number
  }[]
  daysProcessed: number
}

/**
 * Process a single plant to compute grid downtime rows
 */
/**
 * Process a single plant to compute grid downtime rows
 * 
 * CORRECTNESS GUARANTEES:
 * 1. All alerts are processed and their contributions summed (overlapping alerts are additive per requirements)
 * 2. Daily seconds are calculated only for 9-16 IST window overlap
 * 3. Multi-day alerts are split correctly per IST day
 * 4. Open alerts (end_time = null) are capped at windowEnd
 * 5. Total counter accumulates monotonically from baseline
 * 6. All dates in window are processed (even if no alerts, daily = 0)
 * 7. Baseline NULL means first-time computation (starts from 0)
 */
function processPlant(
  plant: { id: number; org_id: number; vendor_id: number; vendor_plant_id: string; name: string },
  alerts: AlertRecord[],
  baselineTotal: number | null,
  dates: string[],
  windowStart: Date,
  windowEnd: Date
): PlantProcessingResult {
  // Build daily map from alerts
  // CORRECTNESS: Multiple alerts for same day are additive (vendor is source of truth)
  // Overlapping alerts are counted as-is (no deduplication)
  const dailySeconds = new Map<string, number>()
  
  for (const alert of alerts) {
    const contribution = computeDailySecondsForAlert(alert, windowStart, windowEnd)
    for (const [dateKey, seconds] of contribution.entries()) {
      // Additive: If multiple alerts overlap on same day, sum their seconds
      dailySeconds.set(dateKey, (dailySeconds.get(dateKey) || 0) + seconds)
    }
  }

  // Generate rows for all dates in window
  // CORRECTNESS: Process dates in order to ensure monotonic total accumulation
  const rows: PlantProcessingResult["rows"] = []
  let currentTotal: number | null = baselineTotal
  
  for (const dateKey of dates) {
    const daily = dailySeconds.get(dateKey) || 0
    
    // CORRECTNESS: Total counter logic
    // - If baseline is NULL (first-time): start from daily
    // - If baseline exists: accumulate from baseline
    // - Total is monotonically increasing
    const total: number = currentTotal === null ? daily : currentTotal + daily
    currentTotal = total

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

  return {
    plantId: plant.id,
    rows,
    daysProcessed: dates.length,
  }
}

export async function runGridDowntimeAnalytics(days: number = WINDOW_DAYS): Promise<GridDowntimeSummary> {
  const startTime = Date.now()
  const main = getMainClient()
  const analytics = getAnalyticsClient()

  logger.info("[Grid Downtime] Starting grid downtime analytics computation", {
    windowDays: days,
    timestamp: new Date().toISOString(),
  })

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

  logger.info("[Grid Downtime] Window defined", {
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    windowStartIST: toIstDateString(windowStart),
    windowEndIST: toIstDateString(windowEnd),
  })

  // Cleanup old rows (global delete older than window start)
  logger.info("[Grid Downtime] Starting cleanup of old rows", {
    cutoffDate: toIstDateString(windowStart),
  })
  const cleanupStartTime = Date.now()
  const { data: deletedData, error: deleteError } = await analytics
    .from("plant_grid_downtime_readings")
    .delete()
    .lt("reading_date", toIstDateString(windowStart))
    .select()

  if (deleteError) {
    logger.error("[Grid Downtime] Failed to cleanup old rows", { error: deleteError.message })
  } else {
    const deletedCount = deletedData?.length || 0
    summary.rowsDeleted = deletedCount
    logger.info("[Grid Downtime] Cleanup completed", {
      deletedRows: deletedCount,
      duration: `${Date.now() - cleanupStartTime}ms`,
    })
  }

  // Fetch plants from main DB
  logger.info("[Grid Downtime] Fetching plants from main DB")
  const plantsFetchStartTime = Date.now()
  const { data: plants, error: plantError } = await main
    .from("plants")
    .select("id, org_id, vendor_id, vendor_plant_id, name, capacity_kw")

  if (plantError) {
    logger.error("[Grid Downtime] Failed to fetch plants", { error: plantError.message })
    throw plantError
  }

  const plantCount = plants?.length || 0
  logger.info("[Grid Downtime] Plants fetched", {
    plantCount,
    duration: `${Date.now() - plantsFetchStartTime}ms`,
  })

  logger.info("[Grid Downtime] Starting computation for all plants", {
    plantCount,
    windowDays: days,
    totalDatesToProcess: days,
  })

  // ============================================
  // PHASE 2: BATCH QUERIES (Optimization)
  // ============================================
  // Instead of 3514 individual queries, fetch all data in 2 batch queries:
  // 1. All alerts for all plants (1 query)
  // 2. All baselines for all plants (1 query)
  // ============================================

  // Batch fetch all alerts for all plants
  // CORRECTNESS: Query must include all alerts that overlap with the window:
  // 1. Alerts that started before/at windowEnd (lte alert_time)
  // 2. AND either:
  //    - Have no end_time (open alerts) OR
  //    - Ended after windowStart (gte end_time)
  // This ensures we capture:
  // - Alerts that started before window but ended during/after window
  // - Alerts that started during window
  // - Open alerts that started before/during window
  // The computeDailySecondsForAlert function will clamp to window boundaries
  logger.info("[Grid Downtime] Batch fetching all alerts for all plants")
  const alertsBatchStartTime = Date.now()
  const { data: allAlerts, error: alertsBatchError } = await main
    .from("alerts")
    .select("plant_id, alert_time, end_time")
    .eq("description", "GRID_DOWN")
    .lte("alert_time", windowEnd.toISOString())
    .or(`end_time.is.null,end_time.gte.${windowStart.toISOString()}`)

  if (alertsBatchError) {
    logger.error("[Grid Downtime] Failed to batch fetch alerts", {
      error: alertsBatchError.message,
    })
    throw alertsBatchError
  }

  const totalAlerts = allAlerts?.length || 0
  logger.info("[Grid Downtime] Batch alerts fetched", {
    totalAlerts,
    duration: `${Date.now() - alertsBatchStartTime}ms`,
  })

  // Group alerts by plant_id in memory
  const alertsByPlant = new Map<number, AlertRecord[]>()
  for (const alert of allAlerts || []) {
    if (!alert.plant_id) continue
    if (!alertsByPlant.has(alert.plant_id)) {
      alertsByPlant.set(alert.plant_id, [])
    }
    alertsByPlant.get(alert.plant_id)!.push({
      plant_id: alert.plant_id,
      alert_time: alert.alert_time,
      end_time: alert.end_time,
    })
  }

  logger.info("[Grid Downtime] Alerts grouped by plant", {
    plantsWithAlerts: alertsByPlant.size,
    totalAlerts,
  })

  // Batch fetch all baselines for all plants
  // CRITICAL: Use RPC function with DISTINCT ON - this is the performance bottleneck fix
  logger.info("[Grid Downtime] Batch fetching all baselines for all plants (optimized)")
  const baselineBatchStartTime = Date.now()
  const windowStartIST = toIstDateString(windowStart)
  
  // Use RPC function to get latest baseline per plant efficiently
  // This uses DISTINCT ON at database level - only returns 1 row per plant
  // Without this, we'd fetch potentially millions of historical rows
  let allBaselines: any[] = []
  let baselineBatchError: any = null
  
  try {
    const { data, error } = await analytics.rpc(
      'get_latest_grid_downtime_baselines',
      { cutoff_date: windowStartIST }
    )
    
    if (error) {
      baselineBatchError = error
      throw error
    }
    
    allBaselines = data || []
    logger.info("[Grid Downtime] RPC function executed successfully", {
      baselineCount: allBaselines.length,
      duration: `${Date.now() - baselineBatchStartTime}ms`,
    })
  } catch (rpcError: any) {
    // Fallback: If RPC doesn't exist or fails, log warning and use empty baselines
    // This allows the process to continue (plants without baselines will start from 0)
    logger.warn("[Grid Downtime] RPC function failed or not found, proceeding without baselines", {
      error: rpcError?.message || 'Unknown error',
      note: "Plants will start from 0 if no baseline exists. Run migration 047 to fix this.",
    })
    allBaselines = []
    baselineBatchError = null // Don't throw - allow process to continue
  }

  // Create baseline map from results
  const baselineMap = new Map<number, number | null>()
  const plantBaselineDates = new Map<number, string>()
  
  for (const baseline of allBaselines || []) {
    if (!baseline?.plant_id) continue
    
    baselineMap.set(
      baseline.plant_id,
      typeof baseline.total_grid_down_seconds === "number"
        ? baseline.total_grid_down_seconds
        : null
    )
    if (baseline.reading_date) {
      plantBaselineDates.set(baseline.plant_id, baseline.reading_date)
    }
  }

  logger.info("[Grid Downtime] Baselines fetched and grouped", {
    plantsWithBaselines: baselineMap.size,
    totalBaselineRows: allBaselines?.length || 0,
    duration: `${Date.now() - baselineBatchStartTime}ms`,
  })

  // Prepare ordered dates for window (compute once, reuse for all plants)
  // CORRECTNESS: Generate all dates in the window sequentially
  // This ensures every day in the 100-day window is processed
  const dates: string[] = []
  let cursor = new Date(windowStart.getTime()) // Clone to avoid mutation
  const endDate = new Date(windowEnd.getTime())
  
  while (cursor <= endDate) {
    dates.push(toIstDateString(cursor))
    cursor = addDays(cursor, 1)
  }
  
  // Verify we have exactly the expected number of dates
  if (dates.length !== days) {
    logger.warn("[Grid Downtime] Date count mismatch", {
      expected: days,
      actual: dates.length,
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
    })
  }

  logger.info("[Grid Downtime] Date range prepared", {
    dateCount: dates.length,
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
  })

  // ============================================
  // PHASE 3: PARALLEL PROCESSING (Optimization)
  // ============================================
  // Process plants in parallel chunks to utilize CPU and reduce total time
  // ============================================
  
  // Optimize for 6000+ plants: Increase batch sizes for better throughput
  const PLANT_BATCH_SIZE = 50 // Process 50 plants per batch (increased from 20)
  const CONCURRENT_BATCHES = 20 // 20 batches in parallel = 1000 plants concurrently (increased from 10)
  const PROGRESS_LOG_INTERVAL = 200 // Log progress every N plants (reduced logging overhead)
  
  logger.info("[Grid Downtime] Starting parallel plant processing", {
    plantCount,
    plantBatchSize: PLANT_BATCH_SIZE,
    concurrentBatches: CONCURRENT_BATCHES,
    maxConcurrentPlants: PLANT_BATCH_SIZE * CONCURRENT_BATCHES,
  })

  const processingStartTime = Date.now()
  const allRows: PlantProcessingResult["rows"] = []
  let processedCount = 0

  // Process plants in chunks with concurrency limit
  for (let i = 0; i < (plants || []).length; i += PLANT_BATCH_SIZE * CONCURRENT_BATCHES) {
    const chunk = (plants || []).slice(i, i + PLANT_BATCH_SIZE * CONCURRENT_BATCHES)
    const chunkNumber = Math.floor(i / (PLANT_BATCH_SIZE * CONCURRENT_BATCHES)) + 1
    const totalChunks = Math.ceil((plants || []).length / (PLANT_BATCH_SIZE * CONCURRENT_BATCHES))
    
    logger.info("[Grid Downtime] Processing plant chunk", {
      chunkNumber,
      totalChunks,
      chunkSize: chunk.length,
      startIndex: i,
      endIndex: i + chunk.length - 1,
    })

    // Process batches within chunk in parallel
    const batchPromises: Promise<PlantProcessingResult[]>[] = []
    
    for (let j = 0; j < chunk.length; j += PLANT_BATCH_SIZE) {
      const plantBatch = chunk.slice(j, j + PLANT_BATCH_SIZE)
      const batchNumber = Math.floor(j / PLANT_BATCH_SIZE) + 1
      
      const batchPromise = Promise.all(
        plantBatch.map(async (plant) => {
          try {
            const alerts = alertsByPlant.get(plant.id) || []
            const baselineTotal = baselineMap.get(plant.id) ?? null
            
            // Process plant (CPU-bound computation, no I/O)
            const result = processPlant(
              plant,
              alerts,
              baselineTotal,
              dates,
              windowStart,
              windowEnd
            )
            
            processedCount++
            
            // Log progress periodically
            if (processedCount % PROGRESS_LOG_INTERVAL === 0 || processedCount === 1) {
              logger.info("[Grid Downtime] Plant processed (parallel)", {
                plantIndex: processedCount,
                totalPlants: plantCount,
                progress: `${((processedCount / plantCount) * 100).toFixed(1)}%`,
                plantId: plant.id,
                plantName: plant.name,
                alertCount: alerts.length,
                rowsGenerated: result.rows.length,
              })
            }
            
            return result
          } catch (error: any) {
            logger.error("[Grid Downtime] Error processing plant", {
              plantId: plant.id,
              plantName: plant.name,
              error: error?.message,
            })
            // Return empty result on error to continue processing
            return {
              plantId: plant.id,
              rows: [],
              daysProcessed: 0,
            }
          }
        })
      )
      
      batchPromises.push(batchPromise)
    }

    // Wait for all batches in this chunk to complete
    const chunkResults = await Promise.all(batchPromises)
    
    // Collect all rows from this chunk
    for (const batchResults of chunkResults) {
      for (const result of batchResults) {
        allRows.push(...result.rows)
        summary.plantsProcessed++
        summary.daysProcessed += result.daysProcessed
      }
    }

    logger.info("[Grid Downtime] Chunk processing completed", {
      chunkNumber,
      totalChunks,
      plantsProcessed: processedCount,
      totalRowsCollected: allRows.length,
      chunkDuration: `${Date.now() - processingStartTime}ms`,
    })
  }

  logger.info("[Grid Downtime] All plants processed in parallel", {
    totalPlants: summary.plantsProcessed,
    totalRows: allRows.length,
    processingDuration: `${Date.now() - processingStartTime}ms`,
  })

  // ============================================
  // PHASE 4: BATCH UPSERTS (Optimization)
  // ============================================
  // Collect all rows from all plants and upsert in larger batches
  // ============================================
  
  logger.info("[Grid Downtime] Starting batch upsert of all rows", {
    totalRows: allRows.length,
  })

  const upsertStartTime = Date.now()
  const UPSERT_BATCH_SIZE = 2000 // Larger batch size for better throughput (increased from 1000)
  
  // Upsert all rows in large batches
  for (let i = 0; i < allRows.length; i += UPSERT_BATCH_SIZE) {
    const batch = allRows.slice(i, i + UPSERT_BATCH_SIZE)
    const batchNumber = Math.floor(i / UPSERT_BATCH_SIZE) + 1
    const totalBatches = Math.ceil(allRows.length / UPSERT_BATCH_SIZE)
    const batchStartTime = Date.now()

    const { error: upsertError } = await analytics
      .from("plant_grid_downtime_readings")
      .upsert(batch, { onConflict: "plant_id,reading_date" })

    if (upsertError) {
      logger.error("[Grid Downtime] Failed to upsert batch", {
        batchNumber,
        totalBatches,
        batchStart: i,
        batchSize: batch.length,
        error: upsertError.message,
      })
      // Continue with next batch instead of failing completely
      continue
    }

    summary.rowsUpserted += batch.length

    logger.info("[Grid Downtime] Batch upserted", {
      batchNumber,
      totalBatches,
      batchSize: batch.length,
      rowsUpserted: summary.rowsUpserted,
      totalRows: allRows.length,
      duration: `${Date.now() - batchStartTime}ms`,
      progress: `${((summary.rowsUpserted / allRows.length) * 100).toFixed(1)}%`,
    })
  }

  logger.info("[Grid Downtime] All rows upserted", {
    totalRowsUpserted: summary.rowsUpserted,
    upsertDuration: `${Date.now() - upsertStartTime}ms`,
  })

  const totalDuration = Date.now() - startTime
  logger.info("[Grid Downtime] Computation completed", {
    summary: {
      plantsProcessed: summary.plantsProcessed,
      daysProcessed: summary.daysProcessed,
      rowsUpserted: summary.rowsUpserted,
      rowsDeleted: summary.rowsDeleted,
    },
    totalDuration: `${totalDuration}ms`,
    averageTimePerPlant: `${Math.round(totalDuration / (summary.plantsProcessed || 1))}ms`,
    timestamp: new Date().toISOString(),
  })

  return summary
}

