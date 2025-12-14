import { NextRequest, NextResponse } from "next/server"
import { getAnalyticsVendorsRepository } from "@/lib/repositories/analytics"
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

    const { searchParams } = new URL(request.url)
    const orgIdParam = searchParams.get("orgId")

    const vendorsRepo = getAnalyticsVendorsRepository()

    // Fetch vendors with or without org filter
    let vendorsWithOrgs
    if (orgIdParam) {
      const orgId = parseInt(orgIdParam)
      if (!isNaN(orgId)) {
        vendorsWithOrgs = await vendorsRepo.findByOrgIdWithOrganization(orgId)
      } else {
        vendorsWithOrgs = await vendorsRepo.findAllWithOrganizations()
      }
    } else {
      vendorsWithOrgs = await vendorsRepo.findAllWithOrganizations()
    }

    // Get last snapshot run status for each vendor (still uses direct query for now)
    const vendorIds = vendorsWithOrgs?.map((v) => v.id) || []
    let lastRunsMap = new Map()

    if (vendorIds.length > 0) {
      const supabase = getAnalyticsClient()
      const { data: lastRuns, error: runsError } = await supabase
        .from("analytics_snapshot_runs")
        .select("*")
        .in("vendor_id", vendorIds)
        .order("created_at", { ascending: false })

      if (!runsError && lastRuns) {
        // Group by vendor_id and get the most recent for each
        for (const run of lastRuns) {
          if (!lastRunsMap.has(run.vendor_id)) {
            lastRunsMap.set(run.vendor_id, run)
          }
        }
      }
    }

    const vendorsWithStatus = (vendorsWithOrgs || []).map((vendor) => ({
      ...vendor,
      lastRun: lastRunsMap.get(vendor.id) || null,
    }))

    return NextResponse.json({ vendors: vendorsWithStatus })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

