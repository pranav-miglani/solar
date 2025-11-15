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

    let sessionData
    try {
      sessionData = JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const accountType = sessionData.accountType as string
    const orgId = sessionData.orgId

    requirePermission(accountType as any, "plants", "read")

    const supabase = createServiceClient()

    // Check access - ORG can only see their own org
    if (accountType === "ORG" && orgId !== parseInt(params.id)) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      )
    }

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", params.id)
      .single()

    if (orgError || !org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    // Get all plants for this organization
    const { data: plants, error: plantsError } = await supabase
      .from("plants")
      .select(`
        *,
        vendors(id, name, vendor_type),
        work_order_plants!left(
          is_active,
          added_at,
          work_orders(
            id,
            title,
            description,
            priority,
            created_at,
            created_by_account:accounts!work_orders_created_by_fkey(id, email)
          )
        )
      `)
      .eq("org_id", params.id)

    if (plantsError) {
      console.error("Error fetching plants:", plantsError)
      return NextResponse.json(
        { error: "Failed to fetch plants" },
        { status: 500 }
      )
    }

    // Transform data to include active work orders
    const plantsWithWorkOrders = (plants || []).map((plant: any) => {
      const activeWorkOrders = (plant.work_order_plants || [])
        .filter((wop: any) => wop.is_active && wop.work_orders)
        .map((wop: any) => wop.work_orders)

      return {
        ...plant,
        activeWorkOrders: activeWorkOrders,
      }
    })

    return NextResponse.json({
      organization: org,
      plants: plantsWithWorkOrders,
      totalPlants: plantsWithWorkOrders.length,
    })
  } catch (error: any) {
    console.error("Error in org plants endpoint:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

