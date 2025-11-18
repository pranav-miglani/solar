import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = request.cookies.get("session")?.value

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Decode session (middleware already validates)
    try {
      JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    // Use service role client to bypass RLS
    const supabase = getMainClient()

    const { data: workOrder, error } = await supabase
      .from("work_orders")
      .select(`
        id,
        title,
        description,
        location,
        created_at,
        updated_at,
        work_order_plants(
          *,
          plants(
            *,
            organizations(id, name),
            vendors(id, name, vendor_type)
          )
        )
      `)
      .eq("id", params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Extract networkStatus from plant metadata if available
    if (workOrder?.work_order_plants) {
      for (const wop of workOrder.work_order_plants) {
        if (wop.plants) {
          // networkStatus might be in metadata JSONB field
          const metadata = (wop.plants as any).metadata || {}
          ;(wop.plants as any).networkStatus =
            metadata.networkStatus || metadata.network_status || null
        }
      }
    }

    return NextResponse.json({ workOrder })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
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

    // Only SUPERADMIN can update work orders
    requirePermission(accountType as any, "work_orders", "update")

    const body = await request.json()
    const { title, description, location, plantIds } = body

    if (!title || !plantIds || plantIds.length === 0) {
      return NextResponse.json(
        { error: "Title and at least one plant are required" },
        { status: 400 }
      )
    }

    const supabase = getMainClient()

    // Validate that all plants belong to the same organization
    const { data: plants, error: plantsError } = await supabase
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

    if (!plants || plants.length !== plantIds.length) {
      return NextResponse.json(
        { error: "One or more plants not found" },
        { status: 400 }
      )
    }

    // Check that all plants belong to the same org
    const orgIds = [...new Set(plants.map((p) => p.org_id))]
    if (orgIds.length > 1) {
      return NextResponse.json(
        { error: "All plants must belong to the same organization" },
        { status: 400 }
      )
    }

    const orgId = orgIds[0] // All plants belong to the same org

    // Update work order
    const { data: workOrder, error: woError } = await supabase
      .from("work_orders")
      .update({
        title,
        description,
        location,
        org_id: orgId, // Update the organization ID for cascade delete
      })
      .eq("id", params.id)
      .select()
      .single()

    if (woError) {
      console.error("Work order update error:", woError)
      return NextResponse.json(
        { error: "Failed to update work order" },
        { status: 500 }
      )
    }

    // Get all existing work_order_plants for this work order (both active and inactive)
    const { data: existingWorkOrderPlants, error: existingError } = await supabase
      .from("work_order_plants")
      .select("plant_id, is_active")
      .eq("work_order_id", parseInt(params.id))

    if (existingError) {
      console.error("Error fetching existing work order plants:", existingError)
      return NextResponse.json(
        { error: "Failed to fetch existing plants" },
        { status: 500 }
      )
    }

    const existingPlantIds = new Set(
      (existingWorkOrderPlants || []).map((wop) => wop.plant_id)
    )
    const selectedPlantIdsSet = new Set(plantIds)

    // Separate plants into: to insert (new), to activate (existing but inactive), to deactivate (not in selection)
    const plantsToInsert: Array<{ work_order_id: number; plant_id: number; is_active: boolean }> = []
    const plantsToActivate: number[] = []
    const plantsToDeactivate: number[] = []

    // Process selected plants
    plantIds.forEach((plantId: number) => {
      if (existingPlantIds.has(plantId)) {
        // Plant already exists - check if it needs to be activated
        const existingWop = existingWorkOrderPlants?.find((wop) => wop.plant_id === plantId)
        if (existingWop && !existingWop.is_active) {
          plantsToActivate.push(plantId)
        }
        // If already active, no action needed
      } else {
        // New plant - needs to be inserted
        plantsToInsert.push({
          work_order_id: parseInt(params.id),
          plant_id: plantId,
          is_active: true,
        })
      }
    })

    // Process existing plants that are not in the selection - deactivate them
    existingWorkOrderPlants?.forEach((wop) => {
      if (!selectedPlantIdsSet.has(wop.plant_id) && wop.is_active) {
        plantsToDeactivate.push(wop.plant_id)
      }
    })

    // Execute updates and inserts
    const errors: string[] = []

    // Deactivate plants that are no longer selected
    if (plantsToDeactivate.length > 0) {
      const { error: deactivateError } = await supabase
        .from("work_order_plants")
        .update({ is_active: false })
        .eq("work_order_id", parseInt(params.id))
        .in("plant_id", plantsToDeactivate)

      if (deactivateError) {
        console.error("Error deactivating plants:", deactivateError)
        errors.push(`Failed to deactivate ${plantsToDeactivate.length} plants`)
      }
    }

    // Activate plants that were previously inactive
    if (plantsToActivate.length > 0) {
      const { error: activateError } = await supabase
        .from("work_order_plants")
        .update({ is_active: true })
        .eq("work_order_id", parseInt(params.id))
        .in("plant_id", plantsToActivate)

      if (activateError) {
        console.error("Error activating plants:", activateError)
        errors.push(`Failed to activate ${plantsToActivate.length} plants`)
      }
    }

    // Insert new plants (only those that don't exist)
    if (plantsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("work_order_plants")
        .insert(plantsToInsert)

      if (insertError) {
        console.error("Plant insert error:", insertError)
        errors.push(`Failed to insert ${plantsToInsert.length} new plants`)
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: `Failed to update plants: ${errors.join('; ')}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ workOrder })
  } catch (error: any) {
    console.error("Update work order error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Only SUPERADMIN can delete work orders
    requirePermission(accountType as any, "work_orders", "delete")

    const supabase = getMainClient()

    // Delete the work order (cascade will handle work_order_plants)
    const { error: deleteError } = await supabase
      .from("work_orders")
      .delete()
      .eq("id", params.id)

    if (deleteError) {
      console.error("Delete work order error:", deleteError)
      return NextResponse.json(
        { error: "Failed to delete work order" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Work order deleted successfully",
    })
  } catch (error: any) {
    console.error("Delete work order error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.message?.includes("permission") ? 403 : 500 }
    )
  }
}
