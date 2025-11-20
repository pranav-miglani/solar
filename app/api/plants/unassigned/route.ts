import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

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
    const orgId = sessionData.orgId

    requirePermission(accountType as any, "plants", "read")

    const { searchParams } = new URL(request.url)
    const orgIdsParam = searchParams.get("orgIds")

    if (!orgIdsParam) {
      return NextResponse.json(
        { error: "orgIds parameter is required" },
        { status: 400 }
      )
    }

    const orgIds = orgIdsParam.split(",").map((id) => parseInt(id.trim()))

    // Use service role client to bypass RLS
    const supabase = getMainClient()

    // Get all plants for the specified organizations
    // Include metadata which may contain networkStatus
    let query = supabase
      .from("plants")
      .select("*, vendors(id, name, vendor_type)")
      .in("org_id", orgIds)

    // Apply role-based filtering
    if (accountType === "ORG" && orgId) {
      query = query.eq("org_id", orgId)
    }

    const { data: plants, error: plantsError } = await query

    if (plantsError) {
      return NextResponse.json({ error: plantsError.message }, { status: 500 })
    }

    if (!plants || plants.length === 0) {
      return NextResponse.json({ plants: [] })
    }

    // Get all plant IDs that are in active work orders
    const plantIds = plants.map((p) => p.id)
    const { data: activeWorkOrderPlants, error: woError } = await supabase
      .from("work_order_plants")
      .select("plant_id")
      .in("plant_id", plantIds)
      .eq("is_active", true)

    if (woError) {
      console.error("Error fetching active work order plants:", woError)
      // Continue anyway, but log the error
    }

    // Filter out plants that are in active work orders
    const assignedPlantIds = new Set(
      (activeWorkOrderPlants || []).map((wop) => wop.plant_id)
    )

    const unassignedPlants = plants.filter(
      (plant) => !assignedPlantIds.has(plant.id)
    )

    return NextResponse.json({
      plants: unassignedPlants,
      total: unassignedPlants.length,
      assigned: assignedPlantIds.size,
    })
  } catch (error: any) {
    console.error("Unassigned plants GET error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

