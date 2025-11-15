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

    // Sync plants to database
    let synced = 0
    let updated = 0
    let created = 0

    for (const plant of vendorPlants) {
      try {
        // Check if plant already exists (by vendor_plant_id)
        const { data: existingPlant } = await supabase
          .from("plants")
          .select("id")
          .eq("vendor_id", vendor.id)
          .eq("vendor_plant_id", plant.id)
          .single()

        // Extract production metrics from metadata (only fields shown in Production Overview)
        const metadata = plant.metadata || {}
        const lastUpdateTime = metadata.lastUpdateTime 
          ? new Date(metadata.lastUpdateTime).toISOString()
          : null

        const plantData: any = {
          org_id: vendor.org_id,
          vendor_id: vendor.id,
          vendor_plant_id: plant.id,
          name: plant.name || `Plant ${plant.id}`,
          capacity_kw: plant.capacityKw || 0, // Installed Capacity (shown in Production Overview)
          location: plant.location || {},
          // Production metrics (only those displayed in Production Overview dashboard)
          current_power_kw: metadata.currentPowerKw || null,
          daily_energy_mwh: metadata.dailyEnergyMwh || null,
          monthly_energy_mwh: metadata.monthlyEnergyMwh || null,
          yearly_energy_mwh: metadata.yearlyEnergyMwh || null,
          total_energy_mwh: metadata.totalEnergyMwh || null,
          performance_ratio: metadata.performanceRatio || null, // PR (shown as percentage in circular indicator)
          last_update_time: lastUpdateTime, // Shown as "Updated" timestamp
        }

        if (existingPlant) {
          // Update existing plant
          await supabase
            .from("plants")
            .update(plantData)
            .eq("id", existingPlant.id)
          updated++
        } else {
          // Create new plant
          await supabase.from("plants").insert(plantData)
          created++
        }
        synced++
      } catch (error: any) {
        console.error(`Error syncing plant ${plant.id}:`, error)
        // Continue with next plant
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${synced} plants`,
      synced,
      total: vendorPlants.length,
      created,
      updated,
    })
  } catch (error: any) {
    console.error("Sync plants error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

