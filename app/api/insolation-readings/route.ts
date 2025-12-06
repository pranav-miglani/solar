import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"

/**
 * GET /api/insolation-readings
 * Fetch insolation data with filters
 * Query params: deviceId, siteId, vendorId, orgId, startDate, endDate, limit
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
    const deviceIdParam = searchParams.get("deviceId")
    const siteIdParam = searchParams.get("siteId")
    const vendorIdParam = searchParams.get("vendorId")
    const orgIdParam = searchParams.get("orgId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const limitParam = searchParams.get("limit")

    let query = supabase
      .from("insolation_readings")
      .select(`
        *,
        wms_devices!inner (
          id,
          device_name,
          vendor_device_id,
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
        )
      `)
      .order("reading_date", { ascending: false })

    // Apply filters
    if (deviceIdParam) {
      const deviceId = parseInt(deviceIdParam)
      if (!isNaN(deviceId)) {
        query = query.eq("wms_device_id", deviceId)
      }
    }

    if (siteIdParam) {
      const siteId = parseInt(siteIdParam)
      if (!isNaN(siteId)) {
        query = query.eq("wms_devices.wms_site_id", siteId)
      }
    }

    if (vendorIdParam) {
      const vendorId = parseInt(vendorIdParam)
      if (!isNaN(vendorId)) {
        query = query.eq("wms_devices.wms_sites.wms_vendor_id", vendorId)
      }
    }

    if (orgIdParam) {
      const orgIdNum = parseInt(orgIdParam)
      if (!isNaN(orgIdNum)) {
        query = query.eq("wms_devices.wms_sites.org_id", orgIdNum)
      }
    } else if (accountType === "ORG" && orgId) {
      // ORG users can only see their own org's readings
      query = query.eq("wms_devices.wms_sites.org_id", orgId)
    }

    if (startDate) {
      query = query.gte("reading_date", startDate)
    }

    if (endDate) {
      query = query.lte("reading_date", endDate)
    }

    if (limitParam) {
      const limit = parseInt(limitParam)
      if (!isNaN(limit) && limit > 0) {
        query = query.limit(limit)
      }
    }

    const { data: readings, error: readingsError } = await query

    if (readingsError) {
      return NextResponse.json(
        { error: "Failed to fetch insolation readings", details: readingsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      readings: readings || [],
      count: readings?.length || 0,
    })
  } catch (error: any) {
    console.error("Get insolation readings error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

