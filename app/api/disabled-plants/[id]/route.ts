import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

/**
 * DELETE /api/disabled-plants/[id]
 * - Only SUPERADMIN can delete
 * - Only allows deletion if plant is not associated with any work orders
 */
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
    requirePermission(accountType as any, "vendors", "delete")

    // Only SUPERADMIN can delete disabled plants
    if (accountType !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Access denied. Only SUPERADMIN can delete disabled plants." },
        { status: 403 }
      )
    }

    const plantId = parseInt(params.id, 10)
    if (isNaN(plantId)) {
      return NextResponse.json(
        { error: "Invalid plant ID" },
        { status: 400 }
      )
    }

    const supabase = getMainClient()

    // First, get the disabled plant record to find the original plant_id
    const { data: disabledPlant, error: fetchError } = await supabase
      .from("disabled_plants")
      .select("plant_id")
      .eq("id", plantId)
      .single()

    if (fetchError || !disabledPlant) {
      return NextResponse.json(
        { error: "Disabled plant not found" },
        { status: 404 }
      )
    }

    const originalPlantId = disabledPlant.plant_id

    // Check if plant is associated with any work orders
    const { data: workOrderPlants, error: wopError } = await supabase
      .from("work_order_plants")
      .select("id")
      .eq("plant_id", originalPlantId)
      .limit(1)

    if (wopError) {
      console.error("Error checking work order associations:", wopError)
      return NextResponse.json(
        { error: "Failed to check work order associations" },
        { status: 500 }
      )
    }

    if (workOrderPlants && workOrderPlants.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete plant. Plant is associated with one or more work orders.",
          hasWorkOrder: true,
        },
        { status: 400 }
      )
    }

    // Delete the disabled plant record
    const { error: deleteError } = await supabase
      .from("disabled_plants")
      .delete()
      .eq("id", plantId)

    if (deleteError) {
      console.error("Error deleting disabled plant:", deleteError)
      return NextResponse.json(
        { error: "Failed to delete disabled plant" },
        { status: 500 }
      )
    }

    // Also delete the original plant record (if it still exists)
    // This is safe because we've already checked for work order associations
    await supabase
      .from("plants")
      .delete()
      .eq("id", originalPlantId)

    return NextResponse.json({
      success: true,
      message: "Disabled plant deleted successfully",
    })
  } catch (error: any) {
    console.error("Delete disabled plant error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

