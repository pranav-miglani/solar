import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"

/**
 * GET /api/wms-sites
 * List all WMS sites (with optional filters)
 * Query params: vendorId, orgId
 */

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

    requirePermission(accountType as any, "wms_vendors", "read")

    const supabase = getMainClient()
    const { searchParams } = new URL(request.url)
    const vendorIdParam = searchParams.get("vendorId")
    const orgIdParam = searchParams.get("orgId")

    let query = supabase
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

    // Apply filters
    if (vendorIdParam) {
      const vendorId = parseInt(vendorIdParam)
      if (!isNaN(vendorId)) {
        query = query.eq("wms_vendor_id", vendorId)
      }
    }

    if (orgIdParam) {
      const orgIdNum = parseInt(orgIdParam)
      if (!isNaN(orgIdNum)) {
        query = query.eq("org_id", orgIdNum)
      }
    } else if (accountType === "ORG" && orgId) {
      // ORG users can only see their own org's sites
      query = query.eq("org_id", orgId)
    }

    const { data: sites, error: sitesError } = await query.order("site_name")

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

