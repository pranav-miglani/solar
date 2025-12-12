/**
 * Script to check for duplicate alerts in the database
 * Run with: npx tsx scripts/check-duplicate-alerts.ts
 * 
 * Make sure .env.local exists with:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

// Load environment variables
import { config } from "dotenv"
import { resolve } from "path"
config({ path: resolve(process.cwd(), ".env.local") })

import { getMainClient } from "../lib/supabase/pooled"

async function checkDuplicates() {
  const supabase = getMainClient()

  console.log("=".repeat(80))
  console.log("CHECKING FOR DUPLICATE ALERTS")
  console.log("Uniqueness constraint: (vendor_id, vendor_plant_id, vendor_alert_id)")
  console.log("=".repeat(80))
  console.log()

  // Step 1: Find all duplicate groups
  console.log("Step 1: Finding duplicate groups...")
  const { data: duplicates, error: dupError } = await supabase.rpc("check_duplicate_alerts")

  if (dupError) {
    // If RPC doesn't exist, use direct query
    const { data: alerts, error: alertsError } = await supabase
      .from("alerts")
      .select("id, vendor_id, vendor_plant_id, vendor_alert_id, plant_id, title, description, created_at, updated_at")
      .not("vendor_id", "is", null)
      .not("vendor_plant_id", "is", null)
      .not("vendor_alert_id", "is", null)

    if (alertsError) {
      console.error("Error fetching alerts:", alertsError)
      return
    }

    // Group by uniqueness key
    const grouped = new Map<string, any[]>()
    alerts?.forEach((alert) => {
      const key = `${alert.vendor_id}|${alert.vendor_plant_id}|${alert.vendor_alert_id}`
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(alert)
    })

    // Find duplicates
    const duplicateGroups: Array<{
      vendor_id: number
      vendor_plant_id: string
      vendor_alert_id: string
      count: number
      alerts: any[]
      system_plant_ids: number[]
    }> = []

    grouped.forEach((alerts, key) => {
      if (alerts.length > 1) {
        const [vendorId, vendorPlantId, vendorAlertId] = key.split("|")
        duplicateGroups.push({
          vendor_id: parseInt(vendorId),
          vendor_plant_id: vendorPlantId,
          vendor_alert_id: vendorAlertId,
          count: alerts.length,
          alerts: alerts.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ),
          system_plant_ids: [...new Set(alerts.map(a => a.plant_id))],
        })
      }
    })

    duplicateGroups.sort((a, b) => b.count - a.count)

    console.log(`Found ${duplicateGroups.length} duplicate groups`)
    console.log()

    // Step 2: Get vendor names
    const vendorIds = [...new Set(duplicateGroups.map(d => d.vendor_id))]
    const { data: vendors } = await supabase
      .from("vendors")
      .select("id, name")
      .in("id", vendorIds)

    const vendorMap = new Map<number, string>()
    vendors?.forEach((v) => vendorMap.set(v.id, v.name))

    // Step 3: Display results
    console.log("=".repeat(80))
    console.log("DUPLICATE ALERT GROUPS")
    console.log("=".repeat(80))
    console.log()

    duplicateGroups.forEach((group, index) => {
      const vendorName = vendorMap.get(group.vendor_id) || "Unknown"
      console.log(`${index + 1}. Vendor: ${group.vendor_id} (${vendorName})`)
      console.log(`   Vendor Plant ID: ${group.vendor_plant_id}`)
      console.log(`   Vendor Alert ID: ${group.vendor_alert_id}`)
      console.log(`   Duplicate Count: ${group.count}`)
      console.log(`   System Plant IDs: ${group.system_plant_ids.join(", ")}`)
      console.log(`   Alert IDs: ${group.alerts.map(a => a.id).join(", ")}`)
      console.log()

      // Show time span
      const oldest = new Date(group.alerts[group.alerts.length - 1].created_at)
      const newest = new Date(group.alerts[0].created_at)
      const hoursDiff = Math.round((newest.getTime() - oldest.getTime()) / (1000 * 60 * 60))
      console.log(`   Time Span: ${hoursDiff} hours between oldest and newest`)
      console.log(`   Oldest: ${oldest.toISOString()}`)
      console.log(`   Newest: ${newest.toISOString()}`)
      console.log()

      // Show alert details
      console.log("   Alert Details:")
      group.alerts.forEach((alert, idx) => {
        console.log(`     ${idx + 1}. ID: ${alert.id}, Created: ${alert.created_at}`)
        console.log(`        Title: ${alert.title || "N/A"}`)
        console.log(`        Description: ${alert.description || "N/A"}`)
        console.log(`        System Plant ID: ${alert.plant_id}`)
      })
      console.log()
      console.log("-".repeat(80))
      console.log()
    })

    // Step 4: Summary
    console.log("=".repeat(80))
    console.log("SUMMARY")
    console.log("=".repeat(80))
    console.log(`Total duplicate groups: ${duplicateGroups.length}`)
    console.log(`Total duplicate alerts: ${duplicateGroups.reduce((sum, g) => sum + g.count - 1, 0)}`)
    console.log(`Total alerts to keep: ${duplicateGroups.length}`)
    console.log(`Total alerts to delete: ${duplicateGroups.reduce((sum, g) => sum + g.count - 1, 0)}`)
    console.log()

    // Step 5: Analysis
    console.log("=".repeat(80))
    console.log("ROOT CAUSE ANALYSIS")
    console.log("=".repeat(80))
    console.log()

    // Check if same system plant_id appears multiple times
    const sameSystemPlant = duplicateGroups.filter(g => g.system_plant_ids.length === 1)
    const differentSystemPlants = duplicateGroups.filter(g => g.system_plant_ids.length > 1)

    console.log(`Groups with same system plant_id: ${sameSystemPlant.length}`)
    console.log(`Groups with different system plant_ids: ${differentSystemPlants.length}`)
    console.log()

    if (sameSystemPlant.length > 0) {
      console.log("These duplicates have the same system plant_id but different vendor_plant_id:")
      sameSystemPlant.forEach((g, idx) => {
        console.log(`  ${idx + 1}. Vendor ${g.vendor_id}, Vendor Plant ${g.vendor_plant_id}, System Plant ${g.system_plant_ids[0]}`)
      })
      console.log()
    }

    if (differentSystemPlants.length > 0) {
      console.log("These duplicates have different system plant_ids:")
      differentSystemPlants.forEach((g, idx) => {
        console.log(`  ${idx + 1}. Vendor ${g.vendor_id}, Vendor Plant ${g.vendor_plant_id}, System Plants: ${g.system_plant_ids.join(", ")}`)
      })
      console.log()
    }

    // Check time patterns
    const recentDuplicates = duplicateGroups.filter(g => {
      const newest = new Date(g.alerts[0].created_at)
      const hoursAgo = (Date.now() - newest.getTime()) / (1000 * 60 * 60)
      return hoursAgo < 24
    })

    console.log(`Duplicates created in last 24 hours: ${recentDuplicates.length}`)
    if (recentDuplicates.length > 0) {
      console.log("This suggests active duplicate insertion happening now!")
    }
    console.log()

  } else {
    console.log("Duplicates found:", duplicates)
  }
}

checkDuplicates()
  .then(() => {
    console.log("\n✅ Check complete")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Error:", error)
    process.exit(1)
  })

