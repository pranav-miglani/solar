import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/wms-devices/[id]
 * Delete a WMS device
 * Prevents deletion if device is assigned to any work orders
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

    // Only SUPERADMIN/DEVELOPER can delete WMS devices
    requirePermission(accountType as any, "wms_vendors", "delete")

    const deviceId = parseInt(params.id)
    if (isNaN(deviceId)) {
      return NextResponse.json(
        { error: "Invalid device ID" },
        { status: 400 }
      )
    }

    const supabase = getMainClient()

    // Check if device is assigned to any work orders
    const { data: workOrders, error: workOrdersError } = await supabase
      .from("work_orders")
      .select(`
        id,
        title,
        organizations!inner(
          id,
          name
        )
      `)
      .eq("wms_device_id", deviceId)

    if (workOrdersError) {
      console.error("Error checking work orders:", workOrdersError)
      return NextResponse.json(
        { error: "Failed to check work order assignments" },
        { status: 500 }
      )
    }

    // If device is assigned to work orders, prevent deletion
    if (workOrders && workOrders.length > 0) {
      const workOrderList = workOrders
        .map((wo: any) => `"${wo.title}" in ${wo.organizations.name}`)
        .join(", ")

      return NextResponse.json(
        {
          error: `Cannot delete WMS device. It is assigned to ${workOrders.length} work order(s): ${workOrderList}. Please remove the device from these work orders first.`,
        },
        { status: 400 }
      )
    }

    // Delete the device
    const { error: deleteError } = await supabase
      .from("wms_devices")
      .delete()
      .eq("id", deviceId)

    if (deleteError) {
      if (deleteError.code === "PGRST116") {
        return NextResponse.json(
          { error: "WMS device not found" },
          { status: 404 }
        )
      }
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Delete WMS device error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete WMS device" },
      { status: 500 }
    )
  }
}

