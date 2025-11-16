import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase service role key")
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

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

    const plantId = parseInt(params.id)
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get("hours") || "24")

    if (isNaN(plantId)) {
      return NextResponse.json({ error: "Invalid plant ID" }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Query telemetry from main DB (telemetry_readings table)
    // In production, you might use a separate telemetry DB
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
      // Return empty array instead of error if table doesn't exist
      return NextResponse.json({
        plantId,
        data: [],
        period: `${hours}h`,
      })
    }

    return NextResponse.json({
      plantId,
      data: telemetry || [],
      period: `${hours}h`,
    })
  } catch (error: any) {
    console.error("Telemetry error:", error)
    // Return empty array on error to allow page to load
    return NextResponse.json({
      plantId: parseInt(params.id),
      data: [],
      period: "24h",
    })
  }
}

