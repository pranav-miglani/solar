/**
 * Script to check all vendor settings including plant sync and telemetry sync configurations
 * Run with: node scripts/check-vendor-settings.js
 */

const { createClient } = require('@supabase/supabase-js')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkVendorSettings() {
  console.log('\n📊 VENDOR SETTINGS REPORT\n')
  console.log('=' .repeat(80))

  try {
    // Fetch all vendors with their organization info and plant counts
    const { data: vendors, error } = await supabase
      .from('vendors')
      .select(`
        id,
        name,
        vendor_type,
        is_active,
        org_id,
        plant_sync_mode,
        per_plant_sync_interval_minutes,
        plant_list_sync_morning_ist,
        plant_list_sync_evening_ist,
        telemetry_sync_mode,
        telemetry_sync_interval,
        last_synced_at,
        last_alert_synced_at,
        created_at,
        organizations (
          id,
          name,
          auto_sync_enabled,
          sync_interval_minutes
        )
      `)
      .order('name')

    if (error) {
      console.error('❌ Error fetching vendors:', error)
      return
    }

    if (!vendors || vendors.length === 0) {
      console.log('⚠️  No vendors found in database')
      return
    }

    // Get plant counts per vendor
    const { data: plantCounts } = await supabase
      .from('plants')
      .select('vendor_id')
    
    const plantCountMap = {}
    if (plantCounts) {
      plantCounts.forEach(p => {
        plantCountMap[p.vendor_id] = (plantCountMap[p.vendor_id] || 0) + 1
      })
    }

    console.log(`\nFound ${vendors.length} vendor(s)\n`)

    vendors.forEach((vendor, index) => {
      console.log(`\n${'─'.repeat(80)}`)
      console.log(`\n${index + 1}. ${vendor.name} (ID: ${vendor.id})`)
      console.log(`   Type: ${vendor.vendor_type}`)
      console.log(`   Status: ${vendor.is_active ? '✅ Active' : '❌ Inactive'}`)
      console.log(`   Organization: ${vendor.organizations?.name || 'N/A'} (ID: ${vendor.organizations?.id || 'N/A'})`)
      console.log(`   Plants: ${plantCountMap[vendor.id] || 0}`)
      
      // Organization-level settings
      if (vendor.organizations) {
        console.log(`\n   📋 Organization Settings:`)
        console.log(`      Auto Sync Enabled: ${vendor.organizations.auto_sync_enabled ? '✅ Yes' : '❌ No'}`)
        console.log(`      Sync Interval: ${vendor.organizations.sync_interval_minutes || 15} minutes`)
      }

      // Plant Sync Settings
      console.log(`\n   🌱 Plant Sync Settings:`)
      console.log(`      Mode: ${vendor.plant_sync_mode || 'LIST_PLANTS'} ${vendor.plant_sync_mode === 'LIST_PLANTS' ? '(all plants in single call)' : '(per-plant telemetry)'}`)
      console.log(`      Per-Plant Interval: ${vendor.per_plant_sync_interval_minutes || 15} minutes`)
      console.log(`      Morning Sync (IST): ${vendor.plant_list_sync_morning_ist || '06:00'}`)
      console.log(`      Evening Sync (IST): ${vendor.plant_list_sync_evening_ist || '23:00'}`)

      // Telemetry Sync Settings
      console.log(`\n   ⚡ Telemetry Sync Settings:`)
      console.log(`      Mode: ${vendor.telemetry_sync_mode || 'LIST_PLANTS'} ${vendor.telemetry_sync_mode === 'LIST_PLANTS' ? '(all plants in single call)' : '(per-plant calls)'}`)
      console.log(`      Interval: ${vendor.telemetry_sync_interval || 15} minutes`)

      // Last Sync Times
      console.log(`\n   🕐 Last Sync Times:`)
      console.log(`      Plants: ${vendor.last_synced_at ? new Date(vendor.last_synced_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Never'}`)
      console.log(`      Alerts: ${vendor.last_alert_synced_at ? new Date(vendor.last_alert_synced_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Never'}`)
      console.log(`      Created: ${new Date(vendor.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`)
    })

    // Summary by vendor type
    console.log(`\n${'─'.repeat(80)}`)
    console.log(`\n📈 SUMMARY BY VENDOR TYPE\n`)
    
    const byType = {}
    vendors.forEach(v => {
      if (!byType[v.vendor_type]) {
        byType[v.vendor_type] = {
          count: 0,
          active: 0,
          plantSyncModes: {},
          telemetrySyncModes: {},
          telemetryIntervals: {}
        }
      }
      byType[v.vendor_type].count++
      if (v.is_active) byType[v.vendor_type].active++
      
      const plantMode = v.plant_sync_mode || 'LIST_PLANTS'
      byType[v.vendor_type].plantSyncModes[plantMode] = (byType[v.vendor_type].plantSyncModes[plantMode] || 0) + 1
      
      const telemetryMode = v.telemetry_sync_mode || 'LIST_PLANTS'
      byType[v.vendor_type].telemetrySyncModes[telemetryMode] = (byType[v.vendor_type].telemetrySyncModes[telemetryMode] || 0) + 1
      
      const interval = v.telemetry_sync_interval || 15
      byType[v.vendor_type].telemetryIntervals[interval] = (byType[v.vendor_type].telemetryIntervals[interval] || 0) + 1
    })

    Object.entries(byType).forEach(([type, stats]) => {
      console.log(`\n${type}:`)
      console.log(`   Total: ${stats.count} (${stats.active} active)`)
      console.log(`   Plant Sync Modes: ${JSON.stringify(stats.plantSyncModes)}`)
      console.log(`   Telemetry Sync Modes: ${JSON.stringify(stats.telemetrySyncModes)}`)
      console.log(`   Telemetry Intervals: ${JSON.stringify(stats.telemetryIntervals)}`)
    })

    console.log(`\n${'='.repeat(80)}\n`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

checkVendorSettings()

