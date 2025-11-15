import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/rbac"

export async function GET(request: NextRequest) {
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

    const accountType = sessionData.accountType
    const orgId = sessionData.orgId

    const { searchParams } = new URL(request.url)
    const priority = searchParams.get("priority")

    let query = supabase
      .from("work_orders")
      .select(`
        *,
        created_by_account:accounts!work_orders_created_by_fkey(id, email),
        work_order_plants(
          *,
          plants:plant_id (
            id,
            name,
            org_id,
            capacity_kw
          )
        )
      `)
      .order("created_at", { ascending: false })

    if (priority) {
      query = query.eq("priority", priority)
    }

    // Filter based on role
    if (accountType === "ORG" && orgId) {
      // Get plant IDs for this org
      const { data: orgPlants } = await supabase
        .from("plants")
        .select("id")
        .eq("org_id", orgId)

      const plantIds = orgPlants?.map((p) => p.id) || []

      if (plantIds.length > 0) {
        // Get work orders that have plants from this org
        const { data: workOrderPlants } = await supabase
          .from("work_order_plants")
          .select("work_order_id")
          .in("plant_id", plantIds)

        const workOrderIds = [
          ...new Set(workOrderPlants?.map((wop) => wop.work_order_id) || []),
        ]

        if (workOrderIds.length > 0) {
          query = query.in("id", workOrderIds)
        } else {
          // No work orders, return empty
          return NextResponse.json({ workOrders: [] })
        }
      } else {
        return NextResponse.json({ workOrders: [] })
    }
    }
    // SUPERADMIN and GOVT see all work orders

    const { data: workOrders, error } = await query

    if (error) {
      console.error("Work orders query error:", error)
      return NextResponse.json(
        { error: "Failed to fetch work orders" },
        { status: 500 }
      )
    }

    return NextResponse.json({ workOrders: workOrders || [] })
  } catch (error) {
    console.error("Work orders error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const accountType = sessionData.accountType as string

    // Only SUPERADMIN can create work orders
    requirePermission(accountType as any, "work_orders", "create")

    const body = await request.json()
    const { title, description, priority, plantIds } = body

    if (!title || !plantIds || plantIds.length === 0) {
      return NextResponse.json(
        { error: "Title and at least one plant are required" },
        { status: 400 }
      )
    }

    // Create work order (static, no status)
    const { data: workOrder, error: woError } = await supabase
      .from("work_orders")
      .insert({
        title,
        description,
        priority: priority || "MEDIUM",
        created_by: sessionData.accountId,
      })
      .select()
      .single()

    if (woError) {
      console.error("Work order creation error:", woError)
      return NextResponse.json(
        { error: "Failed to create work order" },
        { status: 500 }
      )
    }

    // Create work_order_plants
    // First, deactivate any existing active work orders for these plants
    const { error: deactivateError } = await supabase
      .from("work_order_plants")
      .update({ is_active: false })
      .in("plant_id", plantIds)
      .eq("is_active", true)

    if (deactivateError) {
      console.error("Deactivate error:", deactivateError)
      // Continue anyway
    }

    // Insert new work_order_plants
      const plantInserts = plantIds.map((plantId: number) => ({
        work_order_id: workOrder.id,
        plant_id: plantId,
        is_active: true,
      }))

      const { error: plantError } = await supabase
        .from("work_order_plants")
        .insert(plantInserts)

      if (plantError) {
      console.error("Plant insert error:", plantError)
      return NextResponse.json(
        { error: "Failed to associate plants with work order" },
        { status: 500 }
      )
    }

    return NextResponse.json({ workOrder }, { status: 201 })
  } catch (error: any) {
    console.error("Work order creation error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
