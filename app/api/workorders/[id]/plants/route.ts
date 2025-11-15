import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { plantIds, assignedEngineer } = body

    if (!plantIds || plantIds.length === 0) {
      return NextResponse.json(
        { error: "At least one plant is required" },
        { status: 400 }
      )
    }

    const plantInserts = plantIds.map((plantId: number) => ({
      work_order_id: parseInt(params.id),
      plant_id: plantId,
      assigned_engineer: assignedEngineer || null,
      is_active: true,
    }))

    const { data: plants, error } = await supabase
      .from("work_order_plants")
      .insert(plantInserts)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Trigger efficiency computation if work order is IN_PROGRESS
    const { data: wo } = await supabase
      .from("work_orders")
      .select("status")
      .eq("id", params.id)
      .single()

    if (wo?.status === "IN_PROGRESS") {
      await supabase.functions.invoke("compute-efficiency", {
        body: { workOrderId: parseInt(params.id) },
      })
    }

    return NextResponse.json({ plants }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

