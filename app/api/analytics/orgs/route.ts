import { NextRequest, NextResponse } from "next/server"
import { getAnalyticsOrganizationsRepository } from "@/lib/repositories/analytics"

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

    // Fetch organizations using repository
    const orgsRepo = getAnalyticsOrganizationsRepository()
    const orgs = await orgsRepo.findAll()

    return NextResponse.json({ orgs })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

