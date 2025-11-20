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
    requirePermission(accountType as any, "plants", "read")

    const supabase = getMainClient()

    // Get plant details
    const { data: plant, error } = await supabase
      .from("plants")
      .select("*")
      .eq("id", params.id)
      .single()

    if (error || !plant) {
      return NextResponse.json(
        { error: "Plant not found" },
        { status: 404 }
      )
    }

    // Check access permissions
    if (accountType === "ORG" && plant.org_id !== sessionData.orgId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      )
    }

    // Calculate PR percentage
    const prPercentage = plant.performance_ratio
      ? (plant.performance_ratio * 100).toFixed(3)
      : null

    // Calculate current power percentage
    const currentPowerPercentage =
      plant.capacity_kw > 0 && plant.current_power_kw
        ? ((plant.current_power_kw / plant.capacity_kw) * 100).toFixed(3)
        : null

    return NextResponse.json({
      plant: {
        id: plant.id,
        name: plant.name,
        capacityKw: plant.capacity_kw, // Installed Capacity
        currentPowerKw: plant.current_power_kw,
        dailyEnergyMwh: plant.daily_energy_mwh,
        monthlyEnergyMwh: plant.monthly_energy_mwh,
        yearlyEnergyMwh: plant.yearly_energy_mwh,
        totalEnergyMwh: plant.total_energy_mwh,
        performanceRatio: plant.performance_ratio,
        prPercentage, // PR as percentage for display
        lastUpdateTime: plant.last_update_time,
        currentPowerPercentage, // Current power as percentage of capacity
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

