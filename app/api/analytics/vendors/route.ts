import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getAnalyticsVendorsRepository, getAnalyticsSnapshotRunsRepository } from "@/lib/repositories/analytics"

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

    // Use repositories to fetch vendors and snapshot runs
    const vendorsRepo = getAnalyticsVendorsRepository()
    const snapshotRunsRepo = getAnalyticsSnapshotRunsRepository()

    const filters: { orgId?: number } = {}
    if (orgIdParam) {
      const orgId = parseInt(orgIdParam)
      if (!isNaN(orgId)) {
        filters.orgId = orgId
      }
    }

    const vendorsWithOrgs = await vendorsRepo.findAllWithOrganizations(filters)

    // Get last snapshot run status for each vendor
    const vendorIds = vendorsWithOrgs.map((v) => v.id)
    const lastRuns = await snapshotRunsRepo.findLastRunsByVendors(vendorIds)

    const vendorsWithStatus = vendorsWithOrgs.map((vendor) => ({
      ...vendor,
      lastRun: lastRuns.get(vendor.id) || null,
    }))

    return NextResponse.json({ vendors: vendorsWithStatus })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

