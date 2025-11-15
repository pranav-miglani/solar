import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// For workorders plants API, we need to bypass RLS
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase service role key")
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = request.cookies.get("session")?.value

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Decode session
    let sessionData
    try {
      sessionData = JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    // Only SUPERADMIN can add plants to work orders
    if (sessionData.accountType !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Only SUPERADMIN can modify work orders" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { plantIds } = body

    if (!plantIds || plantIds.length === 0) {
      return NextResponse.json(
        { error: "At least one plant is required" },
        { status: 400 }
      )
    }

    // Use service role client to bypass RLS
    const supabase = createServiceClient()

    // First, deactivate existing active plants for these plant IDs
    await supabase
      .from("work_order_plants")
      .update({ is_active: false })
      .in("plant_id", plantIds)
      .eq("is_active", true)

    const plantInserts = plantIds.map((plantId: number) => ({
      work_order_id: parseInt(params.id),
      plant_id: plantId,
      is_active: true,
    }))

    const { data: plants, error } = await supabase
      .from("work_order_plants")
      .insert(plantInserts)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Trigger efficiency computation (work orders are static, but we can still compute efficiency)
    try {
      await supabase.functions.invoke("compute-efficiency", {
        body: { workOrderId: parseInt(params.id) },
      })
    } catch (efficiencyError) {
      // Log but don't fail the request
      console.error("Efficiency computation error:", efficiencyError)
    }

    return NextResponse.json({ plants }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

