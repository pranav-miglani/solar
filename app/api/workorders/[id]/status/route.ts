import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { validateStatusTransition } from "@/lib/statusMachine"
import type { work_order_status } from "@/types/database"

export async function PUT(
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
    const { status } = body

    if (!status) {
      return NextResponse.json(
        { error: "Status is required" },
        { status: 400 }
      )
    }

    // Get current work order
    const { data: workOrder, error: woError } = await supabase
      .from("work_orders")
      .select("status")
      .eq("id", params.id)
      .single()

    if (woError || !workOrder) {
      return NextResponse.json(
        { error: "Work order not found" },
        { status: 404 }
      )
    }

    // Validate transition
    if (
      !validateStatusTransition(
        workOrder.status as work_order_status,
        status as work_order_status
      )
    ) {
      return NextResponse.json(
        {
          error: `Invalid status transition from ${workOrder.status} to ${status}`,
        },
        { status: 400 }
      )
    }

    // Update status
    const { data: updated, error: updateError } = await supabase
      .from("work_orders")
      .update({ status })
      .eq("id", params.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // If moving to IN_PROGRESS, trigger efficiency computation
    if (status === "IN_PROGRESS") {
      await supabase.functions.invoke("compute-efficiency", {
        body: { workOrderId: parseInt(params.id) },
      })
    }

    return NextResponse.json({ workOrder: updated })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

