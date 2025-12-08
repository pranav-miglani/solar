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

    let query = analytics
      .from("vendors")
      .select(`
        *,
        organizations (
          id,
          name
        )
      `)
      .order("id", { ascending: true })

    if (orgIdParam) {
      const orgId = parseInt(orgIdParam)
      if (!isNaN(orgId)) {
        query = query.eq("org_id", orgId)
      }
    }

    const { data: vendors, error } = await query

    if (error) {
      return NextResponse.json({ error: "Failed to fetch vendors", details: error.message }, { status: 500 })
    }

    // Get last snapshot run status for each vendor
    const vendorIds = (vendors || []).map((v) => v.id)
    const { data: lastRuns } = await analytics
      .from("analytics_snapshot_runs")
      .select("vendor_id, status, error_message, completed_at")
      .in("vendor_id", vendorIds)
      .order("started_at", { ascending: false })

    const runsByVendor = new Map()
    for (const run of lastRuns || []) {
      if (!runsByVendor.has(run.vendor_id)) {
        runsByVendor.set(run.vendor_id, run)
      }
    }

    const vendorsWithStatus = (vendors || []).map((vendor) => ({
      ...vendor,
      lastRun: runsByVendor.get(vendor.id) || null,
    }))

    return NextResponse.json({ vendors: vendorsWithStatus })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

