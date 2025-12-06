import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"

/**
 * GET /api/wms-vendors/[id]/devices
 * Fetch all devices for a specific WMS vendor (across all sites)
 */

export const dynamic = 'force-dynamic'

export async function GET(
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
    const orgId = sessionData.orgId

    requirePermission(accountType as any, "wms_vendors", "read")

    const supabase = getMainClient()
    const vendorId = parseInt(params.id)

    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: "Invalid vendor ID" },
        { status: 400 }
      )
    }

    // Get vendor to check permissions
    const { data: vendor, error: vendorError } = await supabase
      .from("wms_vendors")
      .select("id, org_id")
      .eq("id", vendorId)
      .single()

    if (vendorError || !vendor) {
      return NextResponse.json(
        { error: "WMS vendor not found" },
        { status: 404 }
      )
    }

    // ORG users can only see their own org's devices
    if (accountType === "ORG" && vendor.org_id !== orgId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // Fetch devices with site information
    const { data: devices, error: devicesError } = await supabase
      .from("wms_devices")
      .select(`
        *,
        wms_sites!inner (
          id,
          site_name,
          vendor_site_id,
          wms_vendor_id,
          wms_vendors!inner (
            id,
            name,
            vendor_type
          )
        )
      `)
      .eq("wms_sites.wms_vendor_id", vendorId)
      .order("device_name")

    if (devicesError) {
      return NextResponse.json(
        { error: "Failed to fetch devices", details: devicesError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      vendorId,
      devices: devices || [],
      count: devices?.length || 0,
    })
  } catch (error: any) {
    console.error("Get WMS devices error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

