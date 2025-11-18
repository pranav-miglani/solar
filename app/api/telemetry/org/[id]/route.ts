import { NextRequest, NextResponse } from "next/server"
import { getMainClient, getTelemetryClient } from "@/lib/supabase/pooled"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orgId = parseInt(params.id)
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get("hours") || "24")

    if (isNaN(orgId)) {
      return NextResponse.json({ error: "Invalid org ID" }, { status: 400 })
    }

    // Use MAIN client for plants (main database), TELEMETRY client for telemetry (telemetry database)
    const mainSupabase = getMainClient() // Main DB - for reading plants
    const telemetrySupabase = getTelemetryClient() // Telemetry DB - for reading telemetry

    // Read plants from MAIN DB
    const { data: plants, error: plantsError } = await mainSupabase
      .from("plants")
      .select("id")
      .eq("org_id", orgId)

    if (plantsError) {
      return NextResponse.json(
        { error: "Failed to fetch plants" },
        { status: 500 }
      )
    }

    const plantIds = plants?.map((p) => p.id) || []

    if (plantIds.length === 0) {
      return NextResponse.json({
        orgId,
        data: [],
        totalGenerationKw: 0,
        period: `${hours}h`,
      })
    }

    const startTime = new Date()
    startTime.setHours(startTime.getHours() - hours)

    // Query telemetry from TELEMETRY DB (separate Supabase instance)
    const { data: telemetry, error } = await telemetrySupabase
      .from("telemetry_readings")
      .select("*")
      .in("plant_id", plantIds)
      .eq("org_id", orgId)
      .gte("ts", startTime.toISOString())
      .order("ts", { ascending: true })

    if (error) {
      console.error("Telemetry query error:", error)
      return NextResponse.json(
        { error: "Failed to fetch telemetry" },
        { status: 500 }
      )
    }

    const totalGeneration = (telemetry || []).reduce(
      (sum, t) => sum + (parseFloat(t.generation_power_kw) || 0),
      0
    )

    return NextResponse.json({
      orgId,
      data: telemetry || [],
      totalGenerationKw: totalGeneration,
      plantCount: plantIds.length,
      period: `${hours}h`,
    })
  } catch (error) {
    console.error("Telemetry error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

