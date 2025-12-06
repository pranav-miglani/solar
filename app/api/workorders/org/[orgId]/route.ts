import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { orgId: string } }
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

    // Only SUPERADMIN and DEVELOPER can delete all work orders for an org
    requirePermission(accountType as any, "work_orders", "delete")

    const orgId = parseInt(params.orgId, 10)
    if (isNaN(orgId)) {
      return NextResponse.json(
        { error: "Invalid organization ID" },
        { status: 400 }
      )
    }

    const supabase = getMainClient()

    // Verify organization exists
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", orgId)
      .single()

    if (orgError || !org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    // Get count of work orders before deletion (for response)
    const { data: workOrders, error: countError } = await supabase
      .from("work_orders")
      .select("id")
      .eq("org_id", orgId)

    if (countError) {
      console.error("Error counting work orders:", countError)
      return NextResponse.json(
        { error: "Failed to count work orders" },
        { status: 500 }
      )
    }

    const workOrderCount = workOrders?.length || 0

    // Delete all work orders for this organization
    // Cascade delete will automatically handle work_order_plants
    const { error: deleteError } = await supabase
      .from("work_orders")
      .delete()
      .eq("org_id", orgId)

    if (deleteError) {
      console.error("Delete work orders error:", deleteError)
      return NextResponse.json(
        { error: "Failed to delete work orders" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${workOrderCount} work order(s) for organization "${org.name}"`,
      deletedCount: workOrderCount,
      orgId: orgId,
      orgName: org.name,
    })
  } catch (error: any) {
    console.error("Delete all work orders error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

