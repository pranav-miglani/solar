import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"

// For workorders plants API, we need to bypass RLS

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = request.cookies.get("session")?.value

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Decode session
    let sessionData
    try {
      sessionData = JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    // Only SUPERADMIN can add plants to work orders
    if (sessionData.accountType !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Only SUPERADMIN can modify work orders" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { plantIds } = body

    if (!plantIds || plantIds.length === 0) {
      return NextResponse.json(
        { error: "At least one plant is required" },
        { status: 400 }
      )
    }

    // Use service role client to bypass RLS
    const supabase = getMainClient()

    // Get the existing work order's plants to check their org
    const { data: existingWorkOrderPlants, error: woError } = await supabase
      .from("work_order_plants")
      .select(`
        plant_id,
        plants!inner(org_id)
      `)
      .eq("work_order_id", parseInt(params.id))
      .eq("is_active", true)

    if (woError) {
      console.error("Work order plants fetch error:", woError)
      return NextResponse.json(
        { error: "Failed to fetch work order plants" },
        { status: 500 }
      )
    }

    // Validate that all new plants belong to the same organization
    const { data: newPlants, error: plantsError } = await supabase
      .from("plants")
      .select("id, org_id")
      .in("id", plantIds)

    if (plantsError) {
      console.error("Plants validation error:", plantsError)
      return NextResponse.json(
        { error: "Failed to validate plants" },
        { status: 500 }
      )
    }

    if (!newPlants || newPlants.length !== plantIds.length) {
      return NextResponse.json(
        { error: "One or more plants not found" },
        { status: 400 }
      )
    }

    // If work order already has plants, ensure new plants belong to the same org
    if (existingWorkOrderPlants && existingWorkOrderPlants.length > 0) {
      const existingOrgIds = [
        ...new Set(
          existingWorkOrderPlants.map(
            (wop: any) => wop.plants.org_id
          )
        ),
      ]
      const newOrgIds = [...new Set(newPlants.map((p) => p.org_id))]

      // All existing plants should be from the same org (should be enforced, but check anyway)
      if (existingOrgIds.length > 1) {
        return NextResponse.json(
          { error: "Work order has plants from multiple organizations" },
          { status: 400 }
        )
      }

      // New plants must belong to the same org as existing plants
      if (newOrgIds.length > 1 || (existingOrgIds.length > 0 && newOrgIds[0] !== existingOrgIds[0])) {
        return NextResponse.json(
          { error: "All plants must belong to the same organization as existing plants in this work order" },
          { status: 400 }
        )
      }
    } else {
      // If work order has no plants yet, ensure all new plants belong to the same org
      const newOrgIds = [...new Set(newPlants.map((p) => p.org_id))]
      if (newOrgIds.length > 1) {
        return NextResponse.json(
          { error: "All plants must belong to the same organization" },
          { status: 400 }
        )
      }
    }

    // First, deactivate existing active plants for these plant IDs
    await supabase
      .from("work_order_plants")
      .update({ is_active: false })
      .in("plant_id", plantIds)
      .eq("is_active", true)

    const plantInserts = plantIds.map((plantId: number) => ({
      work_order_id: parseInt(params.id),
      plant_id: plantId,
      is_active: true,
    }))

    const { data: plants, error } = await supabase
      .from("work_order_plants")
      .insert(plantInserts)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Trigger efficiency computation (work orders are static, but we can still compute efficiency)
    // Note: compute-efficiency edge function removed (Telemetry DB removed)
    // Efficiency is now calculated differently or not used
    // If efficiency computation is needed, it should be done via vendor APIs directly

    return NextResponse.json({ plants }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

