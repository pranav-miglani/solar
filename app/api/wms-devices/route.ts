import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"

/**
 * GET /api/wms-devices
 * List all WMS devices (with optional filters)
 * Query params: vendorId, siteId, orgId
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
    const siteIdParam = searchParams.get("siteId")
    const orgIdParam = searchParams.get("orgId")

    let query = supabase
      .from("wms_devices")
      .select(`
        *,
        wms_sites!inner (
          id,
          site_name,
          vendor_site_id,
          org_id,
          wms_vendor_id,
          wms_vendors!inner (
            id,
            name,
            vendor_type
          ),
          organizations (
            id,
            name
          )
        )
      `)

    // Apply filters
    if (siteIdParam) {
      const siteId = parseInt(siteIdParam)
      if (!isNaN(siteId)) {
        query = query.eq("wms_site_id", siteId)
      }
    }

    if (vendorIdParam) {
      const vendorId = parseInt(vendorIdParam)
      if (!isNaN(vendorId)) {
        query = query.eq("wms_sites.wms_vendor_id", vendorId)
      }
    }

    if (orgIdParam) {
      const orgIdNum = parseInt(orgIdParam)
      if (!isNaN(orgIdNum)) {
        query = query.eq("wms_sites.org_id", orgIdNum)
      }
    } else if (accountType === "ORG" && orgId) {
      // ORG users can only see their own org's devices
      query = query.eq("wms_sites.org_id", orgId)
    }

    const { data: devices, error: devicesError } = await query.order("device_name")

    if (devicesError) {
      return NextResponse.json(
        { error: "Failed to fetch devices", details: devicesError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
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

