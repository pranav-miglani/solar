import { NextRequest, NextResponse } from "next/server"
import { getServiceClient } from "@/lib/supabase/serviceClient"
import { requirePermission } from "@/lib/rbac"


export async function GET(request: NextRequest) {
  try {
    const session = request.cookies.get("session")?.value

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Decode session
    let sessionData
    try {
      sessionData = JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const accountType = sessionData.accountType as string
    const orgId = sessionData.orgId

    requirePermission(accountType as any, "plants", "read")

    // Use service role client to bypass RLS
    const supabase = getServiceClient()

    let query = supabase
      .from("plants")
      .select("*, vendors(*), organizations(*)")

    // Apply role-based filtering
    if (accountType === "ORG" && orgId) {
      query = query.eq("org_id", orgId)
    }
    // SUPERADMIN and GOVT can see all plants

    const { data: plants, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plants: plants || [] })
  } catch (error: any) {
    console.error("Plants GET error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.message?.includes("permission") ? 403 : 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = request.cookies.get("session")?.value

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Decode session
    let sessionData
    try {
      sessionData = JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const accountType = sessionData.accountType as string

    // Only SUPERADMIN can create plants
    requirePermission(accountType as any, "plants", "create")

    const body = await request.json()
    const { org_id, vendor_id, vendor_plant_id, name, capacity_kw, location } =
      body

    // Use service role client to bypass RLS for insert
    const supabase = getServiceClient()

    const { data: plant, error } = await supabase
      .from("plants")
      .insert({
        org_id,
        vendor_id,
        vendor_plant_id,
        name,
        capacity_kw,
        location: location || {},
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plant }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

