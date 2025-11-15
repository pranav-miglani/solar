import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requirePermission } from "@/lib/rbac"
import { VendorManager } from "@/lib/vendors/vendorManager"
import type { VendorConfig } from "@/lib/vendors/types"

// For vendors API, we need to bypass RLS
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase service role key")
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = request.cookies.get("session")?.value

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let sessionData
    try {
      sessionData = JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const accountType = sessionData.accountType as string

    // Only SUPERADMIN can sync plants
    requirePermission(accountType as any, "vendors", "update")

    const supabase = createServiceClient()

    // Get vendor details
    const { data: vendor, error: vendorError } = await supabase
      .from("vendors")
      .select("*")
      .eq("id", params.id)
      .single()

    if (vendorError || !vendor) {
      return NextResponse.json(
        { error: "Vendor not found" },
        { status: 404 }
      )
    }

    if (!vendor.org_id) {
      return NextResponse.json(
        { error: "Vendor must be assigned to an organization" },
        { status: 400 }
      )
    }

    // Create vendor adapter
    const vendorConfig: VendorConfig = {
      id: vendor.id,
      name: vendor.name,
      vendorType: vendor.vendor_type as "SOLARMAN" | "SUNGROW" | "OTHER",
      apiBaseUrl: vendor.api_base_url,
      credentials: vendor.credentials as Record<string, any>,
      isActive: vendor.is_active,
    }

    const adapter = VendorManager.getAdapter(vendorConfig)

    // Set token storage for Solarman adapter (if it supports it)
    if (adapter && typeof (adapter as any).setTokenStorage === 'function') {
      (adapter as any).setTokenStorage(vendor.id, supabase)
    }

    // Fetch plants from vendor
    let vendorPlants
    try {
      vendorPlants = await adapter.listPlants()
    } catch (error: any) {
      console.error("Error fetching plants from vendor:", error)
      return NextResponse.json(
        { error: `Failed to fetch plants from vendor: ${error.message}` },
        { status: 500 }
      )
    }

    if (!vendorPlants || vendorPlants.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No plants found from vendor",
        synced: 0,
        total: 0,
      })
    }

    console.log(`🔄 [Sync] Starting batch sync for ${vendorPlants.length} plants`)

    // Prepare all plant data
    const plantDataArray = vendorPlants.map((plant) => {
      const metadata = plant.metadata || {}
      const lastUpdateTime = metadata.lastUpdateTime 
        ? new Date(metadata.lastUpdateTime).toISOString()
        : null

      return {
        org_id: vendor.org_id,
        vendor_id: vendor.id,
        vendor_plant_id: plant.id.toString(),
        name: plant.name || `Plant ${plant.id}`,
        capacity_kw: plant.capacityKw || 0,
        location: plant.location || {},
        current_power_kw: metadata.currentPowerKw || null,
        daily_energy_mwh: metadata.dailyEnergyMwh || null,
        monthly_energy_mwh: metadata.monthlyEnergyMwh || null,
        yearly_energy_mwh: metadata.yearlyEnergyMwh || null,
        total_energy_mwh: metadata.totalEnergyMwh || null,
        performance_ratio: metadata.performanceRatio || null,
        last_update_time: lastUpdateTime,
      }
    })

    // Batch size for database operations
    const BATCH_SIZE = 100
    let synced = 0
    let created = 0
    let updated = 0
    const errors: string[] = []

    // Get existing plant IDs for counting (to distinguish created vs updated)
    const vendorPlantIds = plantDataArray.map((p) => p.vendor_plant_id)
    const { data: existingPlants } = await supabase
      .from("plants")
      .select("vendor_plant_id")
      .eq("vendor_id", vendor.id)
      .in("vendor_plant_id", vendorPlantIds)

    const existingIds = new Set(
      (existingPlants || []).map((p) => p.vendor_plant_id)
    )

    // Process in batches using upsert (inserts new, updates existing)
    for (let i = 0; i < plantDataArray.length; i += BATCH_SIZE) {
      const batch = plantDataArray.slice(i, i + BATCH_SIZE)
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1
      const totalBatches = Math.ceil(plantDataArray.length / BATCH_SIZE)
      
      console.log(`📦 [Sync] Processing batch ${batchNumber}/${totalBatches} (${batch.length} plants)`)

      try {
        // Use upsert to handle both inserts and updates in one operation
        // The unique constraint on (vendor_id, vendor_plant_id) will be used for conflict resolution
        const { data, error } = await supabase
          .from("plants")
          .upsert(batch, {
            onConflict: "vendor_id,vendor_plant_id",
          })
          .select()

        if (error) {
          console.error(`❌ [Sync] Batch ${batchNumber} upsert error:`, error)
          errors.push(`Batch ${batchNumber}: ${error.message}`)
          
          // Fallback: try individual upserts
          console.log(`🔄 [Sync] Falling back to individual operations for batch ${batchNumber}`)
          for (const plantData of batch) {
            try {
              const { error: individualError } = await supabase
                .from("plants")
                .upsert(plantData, {
                  onConflict: "vendor_id,vendor_plant_id",
                })

              if (individualError) {
                console.error(`❌ [Sync] Error upserting plant ${plantData.vendor_plant_id}:`, individualError)
                errors.push(`Plant ${plantData.vendor_plant_id}: ${individualError.message}`)
              } else {
                // Count as created or updated
                if (existingIds.has(plantData.vendor_plant_id)) {
                  updated++
                } else {
                  created++
                }
                synced++
              }
            } catch (individualException: any) {
              console.error(`❌ [Sync] Exception upserting plant ${plantData.vendor_plant_id}:`, individualException)
              errors.push(`Plant ${plantData.vendor_plant_id}: ${individualException.message}`)
            }
          }
        } else {
          // Count created vs updated based on whether they existed before
          const batchCreated = batch.filter((p) => !existingIds.has(p.vendor_plant_id)).length
          const batchUpdated = batch.length - batchCreated
          
          created += batchCreated
          updated += batchUpdated
          synced += batch.length
          
          console.log(`✅ [Sync] Batch ${batchNumber} completed: ${batch.length} plants (${batchCreated} created, ${batchUpdated} updated)`)
        }
      } catch (batchError: any) {
        console.error(`❌ [Sync] Batch ${batchNumber} exception:`, batchError)
        errors.push(`Batch ${batchNumber}: ${batchError.message}`)
      }
    }

    console.log(`✅ [Sync] Completed: ${synced}/${vendorPlants.length} plants synced (${created} created, ${updated} updated)`)

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${synced} plants in batches`,
      synced,
      total: vendorPlants.length,
      created,
      updated,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Return first 10 errors if any
    })
  } catch (error: any) {
    console.error("Sync plants error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

