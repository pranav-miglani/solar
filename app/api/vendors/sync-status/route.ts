import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"

export async function GET(request: NextRequest) {
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

    // Only SUPERADMIN can view vendor sync status
    requirePermission(accountType as any, "vendors", "read")

    if (accountType !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Forbidden - SUPERADMIN only" },
        { status: 403 }
      )
    }

    const supabase = getMainClient()

    // Fetch all vendors with their organization and sync status
    const { data: vendors, error } = await supabase
      .from("vendors")
      .select(`
        id,
        name,
        vendor_type,
        is_active,
        last_synced_at,
        created_at,
        organizations (
          id,
          name,
          auto_sync_enabled,
          sync_interval_minutes
        )
      `)
      .order("name")

    if (error) {
      console.error("Vendor sync status query error:", error)
      return NextResponse.json(
        { error: "Failed to fetch vendor sync status" },
        { status: 500 }
      )
    }

    return NextResponse.json({ vendors: vendors || [] })
  } catch (error: any) {
    console.error("Vendor sync status error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.message?.includes("permission") ? 403 : 500 }
    )
  }
}

