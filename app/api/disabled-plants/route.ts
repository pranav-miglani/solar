import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

/**
 * GET /api/disabled-plants
 * - Only SUPERADMIN can access
 * - Returns list of disabled plants with work order association info
 */
export async function GET(request: NextRequest) {
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
    requirePermission(accountType as any, "vendors", "read")

    // Only SUPERADMIN can view disabled plants
    if (accountType !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Access denied. Only SUPERADMIN can view disabled plants." },
        { status: 403 }
      )
    }

    const supabase = getMainClient()

    // Fetch disabled plants with organization and vendor info
    // Also check if plant is associated with any work orders
    const { data: disabledPlants, error } = await supabase
      .from("disabled_plants")
      .select(`
        *,
        organizations:org_id (
          id,
          name
        ),
        vendors:vendor_id (
          id,
          name,
          vendor_type
        )
      `)
      .order("disabled_at", { ascending: false })

    if (error) {
      console.error("Error fetching disabled plants:", error)
      return NextResponse.json(
        { error: "Failed to fetch disabled plants" },
        { status: 500 }
      )
    }

    // Check which plants are associated with work orders
    const plantIds = disabledPlants?.map((dp: any) => dp.plant_id) || []
    
    let plantsWithWorkOrders: Set<number> = new Set()
    if (plantIds.length > 0) {
      const { data: workOrderPlants, error: wopError } = await supabase
        .from("work_order_plants")
        .select("plant_id")
        .in("plant_id", plantIds)

      if (!wopError && workOrderPlants) {
        plantsWithWorkOrders = new Set(
          workOrderPlants.map((wop: any) => wop.plant_id)
        )
      }
    }

    // Add work order association info to each disabled plant
    const plantsWithInfo = disabledPlants?.map((plant: any) => ({
      ...plant,
      hasWorkOrder: plantsWithWorkOrders.has(plant.plant_id),
    })) || []

    return NextResponse.json({
      plants: plantsWithInfo,
      total: plantsWithInfo.length,
    })
  } catch (error: any) {
    console.error("Disabled plants error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

