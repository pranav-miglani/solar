/**
 * Backfill grid downtime metrics for existing alerts.
 *
 * Usage:
 *   npx tsx scripts/backfill-grid-downtime.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from "dotenv"
import { resolve } from "path"
import { createClient } from "@supabase/supabase-js"
import { calculateGridDownBenefitKwh } from "@/lib/services/alertSyncService"

const envPath = resolve(process.cwd(), ".env.local")
config({ path: envPath })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase environment variables.")
  console.error("Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

type AlertPlant =
  | {
      capacity_kw: number | null
    }
  | {
      capacity_kw: number | null
    }[]
  | null

type AlertRecord = {
  id: number
  alert_time: string | null
  end_time: string | null
  grid_down_seconds: number | null
  grid_down_benefit_kwh: number | null
  metadata: Record<string, any> | null
  plants: AlertPlant
}

const BATCH_SIZE = 200

function getTimezone(metadata: Record<string, any> | null): string {
  if (!metadata) return "Asia/Calcutta"
  return (
    metadata.timezone ||
    metadata.timeZone ||
    metadata.time_zone ||
    "Asia/Calcutta"
  )
}

function normalizeCapacityKw(input: AlertPlant): number | null {
  if (!input) return null
  const source = Array.isArray(input) ? input[0] : input
  if (!source) return null
  return parseCapacityKw(source.capacity_kw)
}

function parseCapacityKw(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number" && !Number.isNaN(value)) return value
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

async function backfillGridDowntime() {
  console.log("⚙️  Backfilling grid downtime metrics...")
  let totalProcessed = 0
  let totalUpdated = 0

  while (true) {
    const { data, error } = await supabase
      .from("alerts")
      .select(
        `
          id,
          alert_time,
          end_time,
          grid_down_seconds,
          grid_down_benefit_kwh,
          metadata,
          plants:plant_id (
            capacity_kw
          )
        `
      )
      .or("grid_down_seconds.is.null,grid_down_benefit_kwh.is.null")
      .order("id", { ascending: true })
      .limit(BATCH_SIZE)

    if (error) {
      console.error("❌ Failed to fetch alerts:", error.message)
      process.exit(1)
    }

    if (!data || data.length === 0) {
      break
    }

    for (const alert of data as AlertRecord[]) {
      totalProcessed += 1

      const start = alert.alert_time ? new Date(alert.alert_time) : null
      const end = alert.end_time ? new Date(alert.end_time) : null
      const capacityKw = normalizeCapacityKw(alert.plants)
      const timezone = getTimezone(alert.metadata)

      const updates: Record<string, any> = {}

      if (start && end) {
        const computedSeconds = Math.max(
          0,
          Math.floor((end.getTime() - start.getTime()) / 1000)
        )
        if (alert.grid_down_seconds !== computedSeconds) {
          updates.grid_down_seconds = computedSeconds
        }
      }

      const benefit = calculateGridDownBenefitKwh(
        start,
        end,
        capacityKw,
        timezone
      )

      if (benefit !== null && benefit !== alert.grid_down_benefit_kwh) {
        updates.grid_down_benefit_kwh = benefit
      }

      if (Object.keys(updates).length === 0) {
        continue
      }

      const { error: updateError } = await supabase
        .from("alerts")
        .update(updates)
        .eq("id", alert.id)

      if (updateError) {
        console.error(`❌ Failed to update alert ${alert.id}:`, updateError.message)
      } else {
        totalUpdated += 1
      }
    }

    if (data.length < BATCH_SIZE) {
      break
    }
  }

  console.log(`✅ Backfill complete. Processed ${totalProcessed} alerts, updated ${totalUpdated}.`)
}

backfillGridDowntime().catch((err) => {
  console.error("❌ Unexpected error during backfill:", err)
  process.exit(1)
})

