import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
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

    const workOrderId = parseInt(params.id)

    if (isNaN(workOrderId)) {
      return NextResponse.json(
        { error: "Invalid work order ID" },
        { status: 400 }
      )
    }

    const { data: efficiency, error } = await supabase
      .from("work_order_plant_eff")
      .select(`
        *,
        plants:plant_id (
          id,
          name,
          org_id
        )
      `)
      .eq("work_order_id", workOrderId)
      .order("recorded_at", { ascending: false })

    if (error) {
      console.error("Efficiency query error:", error)
      return NextResponse.json(
        { error: "Failed to fetch efficiency data" },
        { status: 500 }
      )
    }

    return NextResponse.json({ efficiency: efficiency || [] })
  } catch (error) {
    console.error("Efficiency error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
