import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getAnalyticsPlantsRepository } from "@/lib/repositories/analytics"

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
    const vendorIdParam = searchParams.get("vendorId")

    // Use repository to fetch plants
    const plantsRepo = getAnalyticsPlantsRepository()

    const filters: { orgId?: number; vendorId?: number } = {}
    if (orgIdParam) {
      const orgId = parseInt(orgIdParam)
      if (!isNaN(orgId)) {
        filters.orgId = orgId
      }
    }
    if (vendorIdParam) {
      const vendorId = parseInt(vendorIdParam)
      if (!isNaN(vendorId)) {
        filters.vendorId = vendorId
      }
    }

    const plants = await plantsRepo.findAllWithRelations(filters)

    return NextResponse.json({ plants })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

