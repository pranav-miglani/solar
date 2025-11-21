import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"

// For alerts API, we need to bypass RLS

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = request.cookies.get("session")?.value
    const { searchParams } = new URL(request.url)
    const plantId = searchParams.get("plantId")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const offset = (page - 1) * limit

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

    // Use service role client to bypass RLS
    const supabase = getMainClient()

    // Start building query
    let query = supabase.from("alerts").select(`
      *,
      plants:plant_id (
        id,
        name,
        org_id
      )
    `, { count: 'exact' })

    // Filter by plantId if provided
    if (plantId) {
      query = query.eq("plant_id", plantId)
    }

    // Filter based on role
    if (accountType === "ORG" && orgId) {
      // Get plant IDs for this org
      const { data: orgPlants } = await supabase
        .from("plants")
        .select("id")
        .eq("org_id", orgId)

      const plantIds = orgPlants?.map((p) => p.id) || []

      if (plantIds.length > 0) {
        query = query.in("plant_id", plantIds)
      } else {
        // No plants, return empty
        return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } })
      }
    }
    // SUPERADMIN and GOVT see all alerts (or filtered by plantId)

    const { data: alerts, error, count } = await query
      .order("alert_time", { ascending: false }) // Order by alert_time desc
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Alerts query error:", error)
      return NextResponse.json(
        { error: "Failed to fetch alerts" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: alerts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: count ? Math.ceil(count / limit) : 0
      }
    })
  } catch (error) {
    console.error("Alerts error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

