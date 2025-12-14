import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"
import { requirePermission } from "@/lib/rbac"

// For alerts API, we need to bypass RLS

// Mark route as dynamic to prevent static generation (uses cookies)
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

    const accountType = sessionData.accountType
    const orgId = sessionData.orgId

    // Check permission - DEVELOPER, SUPERADMIN, GOVT, and ORG can read alerts
    requirePermission(accountType as any, "alerts", "read")

    const url = new URL(request.url)
    const plantIdParam = url.searchParams.get("plantId")
    const limitParam = url.searchParams.get("limit")
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 100, 200) : 100

    const supabase = getMainClient()

    // Build query for alerts with plants join
    let query = supabase
      .from("alerts")
      .select(`
        *,
        plants (
          id,
          name,
          org_id,
          vendors (
            id,
            name
          )
        )
      `)
      .order("alert_time", { ascending: false })
      .limit(limit)

    // Filter based on role
    if (accountType === "ORG" && orgId) {
      // Get plant IDs for this org first
      const { data: orgPlants } = await supabase
        .from("plants")
        .select("id")
        .eq("org_id", orgId)

      if (!orgPlants || orgPlants.length === 0) {
        return NextResponse.json({ alerts: [] })
      }

      const plantIds = orgPlants.map((p) => p.id)
      query = query.in("plant_id", plantIds)
    }

    // Apply plantId filter if provided
    if (plantIdParam) {
      const plantId = parseInt(plantIdParam, 10)
      if (!Number.isNaN(plantId)) {
        query = query.eq("plant_id", plantId)
      }
    }

    const { data: alerts, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({ alerts })
  } catch (error) {
    console.error("Alerts error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

