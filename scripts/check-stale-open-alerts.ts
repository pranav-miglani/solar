/**
 * Script to find plants with open alerts that have more recent resolved/ended alerts
 * This identifies stale open alerts that should probably be closed
 */

// Load environment variables
import { config } from "dotenv"
import { resolve } from "path"

// Load .env.local if it exists, otherwise .env
config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { getMainClient } from "@/lib/supabase/pooled"

interface StaleAlert {
  plant_id: number
  plant_name: string
  vendor_plant_id: string
  vendor_name: string | null
  open_alert_id: number
  open_alert_time: string
  open_alert_title: string
  newer_resolved_count: number
  earliest_newer_resolved_time: string | null
  latest_newer_resolved_time: string | null
  newer_resolved_alerts: Array<{
    id: number
    title: string
    status: string
    alert_time: string
    end_time: string | null
  }>
}

async function checkStaleOpenAlerts() {
  console.log("🔍 Checking for stale open alerts...\n")
  
  const supabase = getMainClient()

  try {
    // Step 1: Get all open alerts
    console.log("📋 Fetching all open alerts...")
    const { data: openAlerts, error: openError } = await supabase
      .from("alerts")
      .select(`
        id,
        plant_id,
        alert_time,
        title,
        status,
        plants!inner (
          id,
          name,
          vendor_plant_id,
          vendors (
            name
          )
        )
      `)
      .eq("status", "ACTIVE")
      .not("alert_time", "is", null)
      .order("alert_time", { ascending: true })

    if (openError) {
      throw new Error(`Failed to fetch open alerts: ${openError.message}`)
    }

    if (!openAlerts || openAlerts.length === 0) {
      console.log("✅ No open alerts found. All alerts are resolved or acknowledged.")
      return
    }

    console.log(`   Found ${openAlerts.length} open alert(s)\n`)

    // Step 2: Get all resolved/ended alerts
    console.log("📋 Fetching all resolved/ended alerts...")
    const { data: resolvedAlerts, error: resolvedError } = await supabase
      .from("alerts")
      .select(`
        id,
        plant_id,
        alert_time,
        end_time,
        status,
        title
      `)
      .or("status.eq.RESOLVED,end_time.not.is.null")
      .not("alert_time", "is", null)
      .order("alert_time", { ascending: false })

    if (resolvedError) {
      throw new Error(`Failed to fetch resolved alerts: ${resolvedError.message}`)
    }

    console.log(`   Found ${resolvedAlerts?.length || 0} resolved/ended alert(s)\n`)

    // Step 3: Find stale open alerts
    console.log("🔎 Analyzing for stale open alerts...\n")
    
    const staleAlerts: StaleAlert[] = []
    const plantIdToResolvedAlerts = new Map<number, typeof resolvedAlerts>()

    // Group resolved alerts by plant_id
    if (resolvedAlerts) {
      for (const alert of resolvedAlerts) {
        if (!plantIdToResolvedAlerts.has(alert.plant_id)) {
          plantIdToResolvedAlerts.set(alert.plant_id, [])
        }
        plantIdToResolvedAlerts.get(alert.plant_id)!.push(alert)
      }
    }

    // Check each open alert
    for (const openAlert of openAlerts) {
      const plantId = openAlert.plant_id
      const openAlertTime = new Date(openAlert.alert_time)
      const resolvedAlertsForPlant = plantIdToResolvedAlerts.get(plantId) || []

      // Find newer resolved alerts
      const newerResolved = resolvedAlertsForPlant.filter((resolved) => {
        const resolvedTime = new Date(resolved.alert_time)
        return resolvedTime > openAlertTime
      })

      if (newerResolved.length > 0) {
        const plant = openAlert.plants as any
        const vendor = plant?.vendors as any

        staleAlerts.push({
          plant_id: plantId,
          plant_name: plant?.name || "Unknown",
          vendor_plant_id: plant?.vendor_plant_id || "Unknown",
          vendor_name: vendor?.name || null,
          open_alert_id: openAlert.id,
          open_alert_time: openAlert.alert_time,
          open_alert_title: openAlert.title,
          newer_resolved_count: newerResolved.length,
          earliest_newer_resolved_time: newerResolved[newerResolved.length - 1]?.alert_time || null,
          latest_newer_resolved_time: newerResolved[0]?.alert_time || null,
          newer_resolved_alerts: newerResolved.map((a) => ({
            id: a.id,
            title: a.title,
            status: a.status,
            alert_time: a.alert_time,
            end_time: a.end_time,
          })),
        })
      }
    }

    // Step 4: Print results
    if (staleAlerts.length === 0) {
      console.log("✅ No stale open alerts found!")
      console.log("   All open alerts are the most recent alerts for their respective plants.\n")
      return
    }

    console.log(`⚠️  Found ${staleAlerts.length} stale open alert(s) across ${new Set(staleAlerts.map(a => a.plant_id)).size} plant(s)\n`)
    console.log("=" .repeat(80))
    console.log()

    // Group by plant for better readability
    const plantGroups = new Map<number, StaleAlert[]>()
    for (const stale of staleAlerts) {
      if (!plantGroups.has(stale.plant_id)) {
        plantGroups.set(stale.plant_id, [])
      }
      plantGroups.get(stale.plant_id)!.push(stale)
    }

    let plantIndex = 1
    for (const [plantId, alerts] of plantGroups.entries()) {
      const firstAlert = alerts[0]
      console.log(`🌱 PLANT #${plantIndex}: ${firstAlert.plant_name}`)
      console.log(`   Plant ID: ${plantId}`)
      console.log(`   Vendor Plant ID: ${firstAlert.vendor_plant_id}`)
      console.log(`   Vendor: ${firstAlert.vendor_name || "N/A"}`)
      console.log(`   Stale Open Alerts: ${alerts.length}`)
      console.log()

      for (const stale of alerts) {
        console.log(`   📌 OPEN ALERT #${stale.open_alert_id}`)
        console.log(`      Title: ${stale.open_alert_title}`)
        console.log(`      Alert Time: ${new Date(stale.open_alert_time).toLocaleString()}`)
        console.log(`      Status: ACTIVE (should be closed)`)
        console.log()
        console.log(`      ⚠️  This alert has ${stale.newer_resolved_count} newer resolved/ended alert(s):`)
        
        for (let i = 0; i < stale.newer_resolved_alerts.length; i++) {
          const resolved = stale.newer_resolved_alerts[i]
          const resolvedDate = new Date(resolved.alert_time).toLocaleString()
          const endDate = resolved.end_time ? new Date(resolved.end_time).toLocaleString() : "N/A"
          
          console.log(`         ${i + 1}. Alert #${resolved.id}: ${resolved.title}`)
          console.log(`            Status: ${resolved.status}`)
          console.log(`            Alert Time: ${resolvedDate}`)
          if (resolved.end_time) {
            console.log(`            End Time: ${endDate}`)
          }
        }
        console.log()
        console.log(`      📊 Summary:`)
        console.log(`         - Earliest newer resolved: ${stale.earliest_newer_resolved_time ? new Date(stale.earliest_newer_resolved_time).toLocaleString() : "N/A"}`)
        console.log(`         - Latest newer resolved: ${stale.latest_newer_resolved_time ? new Date(stale.latest_newer_resolved_time).toLocaleString() : "N/A"}`)
        console.log()
      }

      console.log("-".repeat(80))
      console.log()
      plantIndex++
    }

    // Summary
    console.log("📊 SUMMARY")
    console.log("=" .repeat(80))
    console.log(`Total Plants with Stale Open Alerts: ${plantGroups.size}`)
    console.log(`Total Stale Open Alerts: ${staleAlerts.length}`)
    console.log(`Total Open Alerts: ${openAlerts.length}`)
    console.log(`Total Resolved/Ended Alerts: ${resolvedAlerts?.length || 0}`)
    console.log()

    // Alert IDs for easy reference
    console.log("🔢 Stale Open Alert IDs (for reference):")
    const alertIds = staleAlerts.map(a => a.open_alert_id).join(", ")
    console.log(`   ${alertIds}`)
    console.log()

  } catch (error: any) {
    console.error("❌ Error checking stale open alerts:", error.message)
    console.error(error)
    process.exit(1)
  }
}

// Run the script
checkStaleOpenAlerts()
  .then(() => {
    console.log("✅ Script completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Script failed:", error)
    process.exit(1)
  })

