import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/wms-sites/[id]
 * Delete a WMS site
 * Prevents deletion if any devices under the site are assigned to work orders
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

    // Only SUPERADMIN/DEVELOPER can delete WMS sites
    requirePermission(accountType as any, "wms_vendors", "delete")

    const siteId = parseInt(params.id)
    if (isNaN(siteId)) {
      return NextResponse.json(
        { error: "Invalid site ID" },
        { status: 400 }
      )
    }

    const supabase = getMainClient()

    // Get all devices under this site
    const { data: devices, error: devicesError } = await supabase
      .from("wms_devices")
      .select("id")
      .eq("wms_site_id", siteId)

    if (devicesError) {
      console.error("Error fetching devices:", devicesError)
      return NextResponse.json(
        { error: "Failed to fetch devices for site" },
        { status: 500 }
      )
    }

    if (!devices || devices.length === 0) {
      // No devices, safe to delete site
      const { error: deleteError } = await supabase
        .from("wms_sites")
        .delete()
        .eq("id", siteId)

      if (deleteError) {
        if (deleteError.code === "PGRST116") {
          return NextResponse.json(
            { error: "WMS site not found" },
            { status: 404 }
          )
        }
        throw deleteError
      }

      return NextResponse.json({ success: true })
    }

    // Check if any devices are assigned to work orders
    const deviceIds = devices.map((d) => d.id)
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
      .in("wms_device_id", deviceIds)

    if (workOrdersError) {
      console.error("Error checking work orders:", workOrdersError)
      return NextResponse.json(
        { error: "Failed to check work order assignments" },
        { status: 500 }
      )
    }

    // If any devices are assigned to work orders, prevent deletion
    if (workOrders && workOrders.length > 0) {
      const workOrderList = workOrders
        .map((wo: any) => `"${wo.title}" in ${wo.organizations.name}`)
        .join(", ")

      return NextResponse.json(
        {
          error: `Cannot delete WMS site. It has devices assigned to ${workOrders.length} work order(s): ${workOrderList}. Please remove the devices from these work orders first.`,
        },
        { status: 400 }
      )
    }

    // No devices assigned to work orders, safe to delete site (cascade will delete devices)
    const { error: deleteError } = await supabase
      .from("wms_sites")
      .delete()
      .eq("id", siteId)

    if (deleteError) {
      if (deleteError.code === "PGRST116") {
        return NextResponse.json(
          { error: "WMS site not found" },
          { status: 404 }
        )
      }
      throw deleteError
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Delete WMS site error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete WMS site" },
      { status: 500 }
    )
  }
}

