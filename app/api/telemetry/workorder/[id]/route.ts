import { NextRequest, NextResponse } from "next/server"
import { getMainClient, getTelemetryClient } from "@/lib/supabase/pooled"

// Mark route as dynamic to prevent static generation (uses request.url)
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workOrderId = parseInt(params.id)
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get("hours") || "24")

    if (isNaN(workOrderId)) {
      return NextResponse.json(
        { error: "Invalid work order ID" },
        { status: 400 }
      )
    }

    // Use MAIN client for work orders (main database), TELEMETRY client for telemetry (telemetry database)
    const mainSupabase = getMainClient() // Main DB - for reading work orders
    const telemetrySupabase = getTelemetryClient() // Telemetry DB - for reading telemetry

    // Read work order plants from MAIN DB
    const { data: workOrderPlants, error: woError } = await mainSupabase
      .from("work_order_plants")
      .select("plant_id")
      .eq("work_order_id", workOrderId)
      .eq("is_active", true)

    if (woError || !workOrderPlants || workOrderPlants.length === 0) {
      return NextResponse.json(
        { error: "Work order not found or has no plants" },
        { status: 404 }
      )
    }

    const plantIds = workOrderPlants.map((wop) => wop.plant_id)
    const startTime = new Date()
    startTime.setHours(startTime.getHours() - hours)

    // Query telemetry from TELEMETRY DB (separate Supabase instance)
    const { data: telemetry, error } = await telemetrySupabase
      .from("telemetry_readings")
      .select("*")
      .in("plant_id", plantIds)
      .eq("work_order_id", workOrderId)
      .gte("ts", startTime.toISOString())
      .order("ts", { ascending: true })

    if (error) {
      console.error("Telemetry query error:", error)
      return NextResponse.json(
        { error: "Failed to fetch telemetry" },
        { status: 500 }
      )
    }

    // Aggregate by plant
    const aggregated = plantIds.map((plantId) => {
      const plantTelemetry = telemetry?.filter((t) => t.plant_id === plantId) || []
      const totalGeneration = plantTelemetry.reduce(
        (sum, t) => sum + (parseFloat(t.generation_power_kw) || 0),
        0
      )

      return {
        plantId,
        dataPoints: plantTelemetry.length,
        totalGenerationKw: totalGeneration,
        telemetry: plantTelemetry,
      }
    })

    return NextResponse.json({
      workOrderId,
      plants: aggregated,
      totalGenerationKw: aggregated.reduce(
        (sum, p) => sum + p.totalGenerationKw,
        0
      ),
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

