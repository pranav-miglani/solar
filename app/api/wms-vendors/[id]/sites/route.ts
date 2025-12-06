import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"

/**
 * GET /api/wms-vendors/[id]/sites
 * Fetch all sites for a specific WMS vendor
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

    // ORG users can only see their own org's sites
    if (accountType === "ORG" && vendor.org_id !== orgId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // Fetch sites with device count
    const { data: sites, error: sitesError } = await supabase
      .from("wms_sites")
      .select(`
        *,
        wms_vendors (
          id,
          name,
          vendor_type
        ),
        organizations (
          id,
          name
        ),
        wms_devices (count)
      `)
      .eq("wms_vendor_id", vendorId)
      .order("site_name")

    if (sitesError) {
      return NextResponse.json(
        { error: "Failed to fetch sites", details: sitesError.message },
        { status: 500 }
      )
    }

    // Transform to include device count
    const sitesWithDeviceCount = (sites || []).map((site: any) => ({
      ...site,
      device_count: site.wms_devices?.length || 0,
      wms_devices: undefined, // Remove the nested array
    }))

    return NextResponse.json({
      vendorId,
      sites: sitesWithDeviceCount,
      count: sitesWithDeviceCount.length,
    })
  } catch (error: any) {
    console.error("Get WMS sites error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

