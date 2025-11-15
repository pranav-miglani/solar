import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get("hours") || "24")

    const supabase = await createClient()

    const startTime = new Date()
    startTime.setHours(startTime.getHours() - hours)

    // Query all telemetry (global view)
    const { data: telemetry, error } = await supabase
      .from("telemetry_readings")
      .select("*")
      .gte("ts", startTime.toISOString())
      .order("ts", { ascending: true })

    if (error) {
      console.error("Telemetry query error:", error)
      return NextResponse.json(
        { error: "Failed to fetch telemetry" },
        { status: 500 }
      )
    }

    // Aggregate by org
    const orgMap = new Map<number, any[]>()

    for (const reading of telemetry || []) {
      const orgId = reading.org_id
      if (!orgMap.has(orgId)) {
        orgMap.set(orgId, [])
      }
      orgMap.get(orgId)!.push(reading)
    }

    const orgBreakdown = Array.from(orgMap.entries()).map(([orgId, readings]) => {
      const totalGeneration = readings.reduce(
        (sum, r) => sum + (parseFloat(r.generation_power_kw) || 0),
        0
      )

      return {
        orgId,
        totalGenerationKw: totalGeneration,
        dataPoints: readings.length,
      }
    })

    const totalGeneration = (telemetry || []).reduce(
      (sum, t) => sum + (parseFloat(t.generation_power_kw) || 0),
      0
    )

    return NextResponse.json({
      data: telemetry || [],
      totalGenerationKw: totalGeneration,
      orgBreakdown,
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

