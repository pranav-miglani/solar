/**
 * Check timezone values stored in alerts.metadata column.
 *
 * Usage:
 *   npx tsx scripts/check-alerts-metadata-timezone.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from "dotenv"
import { resolve } from "path"
import { existsSync } from "fs"
import { createClient } from "@supabase/supabase-js"

const envLocalPath = resolve(process.cwd(), ".env.local")
const envDefaultPath = resolve(process.cwd(), ".env")
const envPath = existsSync(envLocalPath)
  ? envLocalPath
  : existsSync(envDefaultPath)
    ? envDefaultPath
    : null

if (envPath) {
  config({ path: envPath })
} else {
  config() // fall back to process.env
  console.warn("⚠️ No .env.local or .env file found; relying on existing environment variables.")
}

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

interface AlertMetadata {
  timezone?: string
  timeZone?: string
  time_zone?: string
  [key: string]: any
}

interface AlertRecord {
  id: number
  plant_id: number
  metadata: AlertMetadata | null
}

function extractTimezone(metadata: AlertMetadata | null): string | null {
  if (!metadata) return null
  return metadata.timezone || metadata.timeZone || metadata.time_zone || null
}

async function checkAlertsMetadata() {
  console.log("🔍 Checking timezone values in alerts.metadata...")
  console.log("")

  // Fetch all alerts with metadata
  const { data: alerts, error } = await supabase
    .from("alerts")
    .select("id, plant_id, metadata")
    .order("id", { ascending: true })

  if (error) {
    console.error("❌ Failed to fetch alerts:", error.message)
    process.exit(1)
  }

  if (!alerts || alerts.length === 0) {
    console.log("ℹ️  No alerts found in database.")
    return
  }

  console.log(`📊 Total alerts: ${alerts.length}`)
  console.log("")

  // Analyze metadata
  const timezoneStats: Record<string, number> = {}
  const alertsWithMetadata: number = alerts.filter(a => a.metadata !== null && a.metadata !== undefined).length
  const alertsWithoutMetadata: number = alerts.length - alertsWithMetadata
  const alertsWithTimezone: number[] = []
  const alertsWithoutTimezone: number[] = []
  const metadataKeys: Set<string> = new Set()
  const sampleMetadata: Record<string, any> = {}

  for (const alert of alerts as AlertRecord[]) {
    const timezone = extractTimezone(alert.metadata)
    
    if (alert.metadata) {
      // Collect all keys in metadata
      Object.keys(alert.metadata).forEach(key => metadataKeys.add(key))
      
      // Store sample metadata (first 5 unique structures)
      const metadataStr = JSON.stringify(alert.metadata)
      if (Object.keys(sampleMetadata).length < 5 && !Object.values(sampleMetadata).includes(metadataStr)) {
        sampleMetadata[`Alert ${alert.id}`] = alert.metadata
      }
    }

    if (timezone) {
      alertsWithTimezone.push(alert.id)
      timezoneStats[timezone] = (timezoneStats[timezone] || 0) + 1
    } else {
      alertsWithoutTimezone.push(alert.id)
    }
  }

  // Print statistics
  console.log("📈 Metadata Statistics:")
  console.log(`   Alerts with metadata: ${alertsWithMetadata} (${((alertsWithMetadata / alerts.length) * 100).toFixed(1)}%)`)
  console.log(`   Alerts without metadata: ${alertsWithoutTimezone.length} (${((alertsWithoutMetadata / alerts.length) * 100).toFixed(1)}%)`)
  console.log("")

  console.log("🕐 Timezone Statistics:")
  console.log(`   Alerts with timezone in metadata: ${alertsWithTimezone.length} (${((alertsWithTimezone.length / alerts.length) * 100).toFixed(1)}%)`)
  console.log(`   Alerts without timezone in metadata: ${alertsWithoutTimezone.length} (${((alertsWithoutTimezone.length / alerts.length) * 100).toFixed(1)}%)`)
  console.log("")

  if (Object.keys(timezoneStats).length > 0) {
    console.log("🌍 Timezone Distribution:")
    const sortedTimezones = Object.entries(timezoneStats).sort((a, b) => b[1] - a[1])
    for (const [tz, count] of sortedTimezones) {
      const percentage = ((count / alerts.length) * 100).toFixed(1)
      console.log(`   ${tz}: ${count} alerts (${percentage}%)`)
    }
    console.log("")
  } else {
    console.log("⚠️  No timezone values found in any alert metadata!")
    console.log("")
  }

  if (metadataKeys.size > 0) {
    console.log("🔑 Metadata Keys Found:")
    const sortedKeys = Array.from(metadataKeys).sort()
    for (const key of sortedKeys) {
      const count = alerts.filter(a => a.metadata && key in a.metadata).length
      console.log(`   ${key}: present in ${count} alerts`)
    }
    console.log("")
  }

  if (Object.keys(sampleMetadata).length > 0) {
    console.log("📋 Sample Metadata Structures (first 5 unique):")
    for (const [label, metadata] of Object.entries(sampleMetadata)) {
      console.log(`\n   ${label}:`)
      console.log(JSON.stringify(metadata, null, 2))
    }
    console.log("")
  }

  // Check for alerts that would fail timezone extraction
  const alertsNeedingFallback = alertsWithoutTimezone.length
  if (alertsNeedingFallback > 0) {
    console.log(`⚠️  ${alertsNeedingFallback} alerts would use fallback timezone "Asia/Calcutta"`)
    console.log("")
  }

  console.log("✅ Analysis complete!")
}

checkAlertsMetadata().catch((error) => {
  console.error("❌ Error:", error)
  process.exit(1)
})

