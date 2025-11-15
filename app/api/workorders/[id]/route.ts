import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requirePermission } from "@/lib/rbac"

function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase service role key")
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = request.cookies.get("session")?.value

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Decode session (middleware already validates)
    try {
      JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    // Use service role client to bypass RLS
    const supabase = createServiceClient()

    const { data: workOrder, error } = await supabase
      .from("work_orders")
      .select(`
        *,
        created_by_account:accounts!work_orders_created_by_fkey(id, email),
        work_order_plants(
          *,
          plants(
            *,
            organizations(id, name),
            vendors(id, name, vendor_type)
          )
        )
      `)
      .eq("id", params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Extract networkStatus from plant metadata if available
    if (workOrder?.work_order_plants) {
      for (const wop of workOrder.work_order_plants) {
        if (wop.plants) {
          // networkStatus might be in metadata JSONB field
          const metadata = (wop.plants as any).metadata || {}
          ;(wop.plants as any).networkStatus =
            metadata.networkStatus || metadata.network_status || null
        }
      }
    }

    return NextResponse.json({ workOrder })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(
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

    // Only SUPERADMIN can update work orders
    requirePermission(accountType as any, "work_orders", "update")

    const body = await request.json()
    const { title, description, location, plantIds } = body

    if (!title || !plantIds || plantIds.length === 0) {
      return NextResponse.json(
        { error: "Title and at least one plant are required" },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Validate that all plants belong to the same organization
    const { data: plants, error: plantsError } = await supabase
      .from("plants")
      .select("id, org_id")
      .in("id", plantIds)

    if (plantsError) {
      console.error("Plants validation error:", plantsError)
      return NextResponse.json(
        { error: "Failed to validate plants" },
        { status: 500 }
      )
    }

    if (!plants || plants.length !== plantIds.length) {
      return NextResponse.json(
        { error: "One or more plants not found" },
        { status: 400 }
      )
    }

    // Check that all plants belong to the same org
    const orgIds = [...new Set(plants.map((p) => p.org_id))]
    if (orgIds.length > 1) {
      return NextResponse.json(
        { error: "All plants must belong to the same organization" },
        { status: 400 }
      )
    }

    // Update work order
    const { data: workOrder, error: woError } = await supabase
      .from("work_orders")
      .update({
        title,
        description,
        location,
      })
      .eq("id", params.id)
      .select()
      .single()

    if (woError) {
      console.error("Work order update error:", woError)
      return NextResponse.json(
        { error: "Failed to update work order" },
        { status: 500 }
      )
    }

    // Deactivate existing plants
    await supabase
      .from("work_order_plants")
      .update({ is_active: false })
      .eq("work_order_id", params.id)
      .eq("is_active", true)

    // Add new plants
    const plantInserts = plantIds.map((plantId: number) => ({
      work_order_id: parseInt(params.id),
      plant_id: plantId,
      is_active: true,
    }))

    const { error: plantError } = await supabase
      .from("work_order_plants")
      .insert(plantInserts)

    if (plantError) {
      console.error("Plant insert error:", plantError)
      return NextResponse.json(
        { error: "Failed to update plants" },
        { status: 500 }
      )
    }

    return NextResponse.json({ workOrder })
  } catch (error: any) {
    console.error("Update work order error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
