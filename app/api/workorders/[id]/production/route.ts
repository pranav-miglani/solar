import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

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
    requirePermission(accountType as any, "work_orders", "read")

    const supabase = getMainClient()

    // Get all plants for this work order
    const { data: workOrderPlants, error: woError } = await supabase
      .from("work_order_plants")
      .select(`
        plant_id,
        plants (*)
      `)
      .eq("work_order_id", params.id)
      .eq("is_active", true)

    if (woError) {
      return NextResponse.json(
        { error: "Failed to fetch work order plants" },
        { status: 500 }
      )
    }

    if (!workOrderPlants || workOrderPlants.length === 0) {
      return NextResponse.json({
        totalPlants: 0,
        aggregated: {
          installedCapacityKw: 0,
          currentPowerKw: 0,
          dailyEnergyMwh: 0,
          monthlyEnergyMwh: 0,
          yearlyEnergyMwh: 0,
          totalEnergyMwh: 0,
          averagePerformanceRatio: 0,
          averageFullPowerHoursDay: 0,
        },
        plants: [],
      })
    }

    const plants = workOrderPlants.map((wop: any) => wop.plants).filter(Boolean)

    // Aggregate metrics (only those shown in Production Overview)
    const aggregated = {
      totalPlants: plants.length,
      installedCapacityKw: plants.reduce((sum: number, p: any) => sum + (p.capacity_kw || 0), 0),
      currentPowerKw: plants.reduce((sum: number, p: any) => sum + (p.current_power_kw || 0), 0),
      dailyEnergyMwh: plants.reduce((sum: number, p: any) => sum + (p.daily_energy_mwh || 0), 0),
      monthlyEnergyMwh: plants.reduce((sum: number, p: any) => sum + (p.monthly_energy_mwh || 0), 0),
      yearlyEnergyMwh: plants.reduce((sum: number, p: any) => sum + (p.yearly_energy_mwh || 0), 0),
      totalEnergyMwh: plants.reduce((sum: number, p: any) => sum + (p.total_energy_mwh || 0), 0),
      averagePerformanceRatio: plants
        .filter((p: any) => p.performance_ratio !== null)
        .reduce((sum: number, p: any, _: any, arr: any[]) => sum + (p.performance_ratio || 0) / arr.length, 0),
    }

    return NextResponse.json({
      totalPlants: plants.length,
      aggregated,
      plants: plants.map((p: any) => ({
        id: p.id,
        name: p.name,
        capacityKw: p.capacity_kw,
        currentPowerKw: p.current_power_kw,
        dailyEnergyMwh: p.daily_energy_mwh,
        monthlyEnergyMwh: p.monthly_energy_mwh,
        yearlyEnergyMwh: p.yearly_energy_mwh,
        totalEnergyMwh: p.total_energy_mwh,
        performanceRatio: p.performance_ratio,
        lastUpdateTime: p.last_update_time,
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

