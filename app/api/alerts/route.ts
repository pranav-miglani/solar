import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// For alerts API, we need to bypass RLS
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase service role key")
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

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

    const accountType = sessionData.accountType
    const orgId = sessionData.orgId

    // Use service role client to bypass RLS
    const supabase = createServiceClient()

    let query = supabase.from("alerts").select(`
      *,
      plants:plant_id (
        id,
        name,
        org_id
      )
    `)

    // Filter based on role
    if (accountType === "ORG" && orgId) {
      // Get plant IDs for this org
      const { data: orgPlants } = await supabase
        .from("plants")
        .select("id")
        .eq("org_id", orgId)

      const plantIds = orgPlants?.map((p) => p.id) || []

      if (plantIds.length > 0) {
        query = query.in("plant_id", plantIds)
      } else {
        // No plants, return empty
        return NextResponse.json({ alerts: [] })
      }
    }
    // SUPERADMIN and GOVT see all alerts

    const { data: alerts, error } = await query
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      console.error("Alerts query error:", error)
      return NextResponse.json(
        { error: "Failed to fetch alerts" },
        { status: 500 }
      )
    }

    return NextResponse.json({ alerts: alerts || [] })
  } catch (error) {
    console.error("Alerts error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

