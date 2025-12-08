import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getAnalyticsClient } from "@/lib/supabase/pooled"

export const dynamic = "force-dynamic"

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
    // Only SUPERADMIN and DEVELOPER can view analytics
    if (accountType !== "SUPERADMIN" && accountType !== "DEVELOPER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const analytics = getAnalyticsClient()
    const { searchParams } = new URL(request.url)
    const orgIdParam = searchParams.get("orgId")
    const vendorIdParam = searchParams.get("vendorId")

    let query = analytics
      .from("plants")
      .select(`
        *,
        organizations (
          id,
          name
        ),
        vendors (
          id,
          name,
          vendor_type
        )
      `)
      .order("id", { ascending: true })

    if (orgIdParam) {
      const orgId = parseInt(orgIdParam)
      if (!isNaN(orgId)) {
        query = query.eq("org_id", orgId)
      }
    }

    if (vendorIdParam) {
      const vendorId = parseInt(vendorIdParam)
      if (!isNaN(vendorId)) {
        query = query.eq("vendor_id", vendorId)
      }
    }

    const { data: plants, error } = await query

    if (error) {
      return NextResponse.json({ error: "Failed to fetch plants", details: error.message }, { status: 500 })
    }

    return NextResponse.json({ plants: plants || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

