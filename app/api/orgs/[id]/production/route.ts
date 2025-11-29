import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

/**
 * Get aggregated production metrics for an organization
 * This sums up metrics from all work orders belonging to the organization
 */
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

    const orgId = parseInt(params.id, 10)
    if (isNaN(orgId)) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 })
    }

    const supabase = getMainClient()

    // Get all work orders for this organization
    const { data: workOrders, error: woError } = await supabase
      .from("work_orders")
      .select("id")
      .eq("org_id", orgId)

    if (woError) {
      return NextResponse.json(
        { error: "Failed to fetch work orders" },
        { status: 500 }
      )
    }

    if (!workOrders || workOrders.length === 0) {
      return NextResponse.json({
        totalWorkOrders: 0,
        totalPlants: 0,
        aggregated: {
          installedCapacityKw: 0,
          currentPowerKw: 0,
          dailyEnergyKwh: 0,
          monthlyEnergyMwh: 0,
          yearlyEnergyMwh: 0,
          totalEnergyMwh: 0,
        },
      })
    }

    const workOrderIds = workOrders.map((wo) => wo.id)

    // Get all active plants for all work orders in this organization
    const { data: workOrderPlants, error: wopError } = await supabase
      .from("work_order_plants")
      .select(`
        plant_id,
        plants (*)
      `)
      .in("work_order_id", workOrderIds)
      .eq("is_active", true)

    if (wopError) {
      return NextResponse.json(
        { error: "Failed to fetch work order plants" },
        { status: 500 }
      )
    }

    if (!workOrderPlants || workOrderPlants.length === 0) {
      return NextResponse.json({
        totalWorkOrders: workOrders.length,
        totalPlants: 0,
        aggregated: {
          installedCapacityKw: 0,
          currentPowerKw: 0,
          dailyEnergyKwh: 0,
          monthlyEnergyMwh: 0,
          yearlyEnergyMwh: 0,
          totalEnergyMwh: 0,
        },
      })
    }

    const plants = workOrderPlants.map((wop: any) => wop.plants).filter(Boolean)

    // Aggregate metrics across all plants in all work orders for this organization
    const aggregated = {
      totalWorkOrders: workOrders.length,
      totalPlants: plants.length,
      installedCapacityKw: plants.reduce((sum: number, p: any) => sum + (p.capacity_kw || 0), 0),
      currentPowerKw: plants.reduce((sum: number, p: any) => sum + (p.current_power_kw || 0), 0),
      dailyEnergyKwh: plants.reduce((sum: number, p: any) => sum + (p.daily_energy_kwh || 0), 0),
      monthlyEnergyMwh: plants.reduce((sum: number, p: any) => sum + (p.monthly_energy_mwh || 0), 0),
      yearlyEnergyMwh: plants.reduce((sum: number, p: any) => sum + (p.yearly_energy_mwh || 0), 0),
      totalEnergyMwh: plants.reduce((sum: number, p: any) => sum + (p.total_energy_mwh || 0), 0),
    }

    return NextResponse.json({
      totalWorkOrders: workOrders.length,
      totalPlants: plants.length,
      aggregated,
    })
  } catch (error: any) {
    console.error("Organization production error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

