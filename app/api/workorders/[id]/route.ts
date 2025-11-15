import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
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

    const { data: workOrder, error } = await supabase
      .from("work_orders")
      .select(`
        *,
        created_by_user:users!work_orders_created_by_fkey(id, email),
        work_order_orgs(orgs(*)),
        work_order_plants(
          *,
          plants(*),
          assigned_engineer_user:users!work_order_plants_assigned_engineer_fkey(id, email)
        )
      `)
      .eq("id", params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ workOrder })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

