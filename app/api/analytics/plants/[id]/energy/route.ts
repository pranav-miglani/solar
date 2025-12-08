import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getAnalyticsClient } from "@/lib/supabase/pooled"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const plantId = parseInt(params.id)
    if (isNaN(plantId)) {
      return NextResponse.json({ error: "Invalid plant ID" }, { status: 400 })
    }

    const analytics = getAnalyticsClient()
    
    // Get last 100 days of readings
    const endDate = new Date().toISOString().split("T")[0]
    const startDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]

    const { data: readings, error } = await analytics
      .from("plant_energy_readings")
      .select("*")
      .eq("plant_id", plantId)
      .gte("reading_date", startDate)
      .lte("reading_date", endDate)
      .order("reading_date", { ascending: true })

    if (error) {
      return NextResponse.json({ error: "Failed to fetch energy readings", details: error.message }, { status: 500 })
    }

    return NextResponse.json({
      plantId,
      readings: readings || [],
      count: readings?.length || 0,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

