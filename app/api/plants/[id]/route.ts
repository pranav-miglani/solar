import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

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

    const supabase = getMainClient()

    // Fetch plant with related data
    const { data: plant, error } = await supabase
      .from("plants")
      .select(`
        *,
        vendors (
          id,
          name,
          vendor_type
        ),
        organizations (
          id,
          name
        )
      `)
      .eq("id", params.id)
      .single()

    if (error || !plant) {
      return NextResponse.json(
        { error: "Plant not found" },
        { status: 404 }
      )
    }

    // Check permissions based on account type
    const accountType = sessionData.accountType as string
    const orgId = sessionData.orgId

    // ORG users can only see their own org's plants
    if (accountType === "ORG" && plant.org_id !== orgId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // Log to verify last_refreshed_at is included
    console.log(`[Plant API] Plant ${params.id} - last_refreshed_at:`, plant.last_refreshed_at)
    
    return NextResponse.json(plant)
  } catch (error: any) {
    console.error("Get plant error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

