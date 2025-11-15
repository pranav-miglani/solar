import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// This would connect to the separate telemetry DB
// For now, we'll use environment variables to distinguish
const TELEMETRY_DB_URL = process.env.TELEMETRY_SUPABASE_URL
const TELEMETRY_DB_KEY = process.env.TELEMETRY_SUPABASE_ANON_KEY

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const plantId = parseInt(params.id)
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get("hours") || "24")

    if (isNaN(plantId)) {
      return NextResponse.json({ error: "Invalid plant ID" }, { status: 400 })
    }

    // Connect to telemetry DB
    // In production, you'd use a separate Supabase client for telemetry DB
    const supabase = await createClient()

    // For now, we'll query the main DB's telemetry table
    // In production, replace with telemetry DB connection
    const startTime = new Date()
    startTime.setHours(startTime.getHours() - hours)

    const { data: telemetry, error } = await supabase
      .from("telemetry_readings")
      .select("*")
      .eq("plant_id", plantId)
      .gte("ts", startTime.toISOString())
      .order("ts", { ascending: true })

    if (error) {
      console.error("Telemetry query error:", error)
      return NextResponse.json(
        { error: "Failed to fetch telemetry" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      plantId,
      data: telemetry || [],
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

