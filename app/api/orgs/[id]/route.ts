import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"

// For orgs API, we need to bypass RLS for write operations
// We use service role key since RLS policies require auth.uid() which we don't have

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

    // Only SUPERADMIN can update organization sync settings
    requirePermission(accountType as any, "organizations", "update")

    const body = await request.json()
    const { auto_sync_enabled, sync_interval_minutes } = body

    // Validate sync_interval_minutes
    if (sync_interval_minutes !== undefined) {
      if (typeof sync_interval_minutes !== "number" || sync_interval_minutes < 1 || sync_interval_minutes > 1440) {
        return NextResponse.json(
          { error: "sync_interval_minutes must be between 1 and 1440 (24 hours)" },
          { status: 400 }
        )
      }
    }

    const supabase = getMainClient()

    // Update organization sync settings
    const updateData: any = {}
    if (auto_sync_enabled !== undefined) {
      updateData.auto_sync_enabled = Boolean(auto_sync_enabled)
    }
    if (sync_interval_minutes !== undefined) {
      updateData.sync_interval_minutes = sync_interval_minutes
    }

    const { data, error } = await supabase
      .from("organizations")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      console.error("Update organization error:", error)
      return NextResponse.json(
        { error: "Failed to update organization" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      organization: data,
    })
  } catch (error: any) {
    console.error("Update organization error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.message?.includes("permission") ? 403 : 500 }
    )
  }
}

export async function DELETE(
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

    // Only SUPERADMIN can delete organizations
    requirePermission(accountType as any, "organizations", "delete")

    const supabase = getMainClient()

    // Delete the organization
    // Cascade deletes will automatically handle:
    // - accounts (with org_id)
    // - vendors (with org_id)
    // - plants (with org_id)
    // - work_orders (with org_id)
    // - work_order_plants (through plants)
    // - alerts (through plants)
    const { error } = await supabase
      .from("organizations")
      .delete()
      .eq("id", params.id)

    if (error) {
      console.error("Delete organization error:", error)
      return NextResponse.json(
        { error: "Failed to delete organization" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Organization deleted successfully",
    })
  } catch (error: any) {
    console.error("Delete organization error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.message?.includes("permission") ? 403 : 500 }
    )
  }
}

