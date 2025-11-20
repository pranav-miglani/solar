import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import { logApiRequest, logApiResponse, withMDCContext } from "@/lib/api-logger"

// For plants API, we need to bypass RLS for write operations

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  return withMDCContext(request, async () => {
    logApiRequest(request)
    
    try {
      const session = request.cookies.get("session")?.value

      if (!session) {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      // Decode session
      let sessionData
      try {
        sessionData = JSON.parse(Buffer.from(session, "base64").toString())
      } catch {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Invalid session" }, { status: 401 })
      }

      const accountType = sessionData.accountType as string
      const orgId = sessionData.orgId

      requirePermission(accountType as any, "plants", "read")

      // Use service role client to bypass RLS
      const supabase = getMainClient()

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
        logApiResponse(request, 500, Date.now() - startTime, error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      logApiResponse(request, 200, Date.now() - startTime)
      return NextResponse.json({ plants: plants || [] })
    } catch (error: any) {
      console.error("Plants GET error:", error)
      logApiResponse(request, error.message?.includes("permission") ? 403 : 500, Date.now() - startTime, error)
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: error.message?.includes("permission") ? 403 : 500 }
      )
    }
  })
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  return withMDCContext(request, async () => {
    logApiRequest(request)
    
    try {
      const session = request.cookies.get("session")?.value

      if (!session) {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      // Decode session
      let sessionData
      try {
        sessionData = JSON.parse(Buffer.from(session, "base64").toString())
      } catch {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Invalid session" }, { status: 401 })
      }

      const accountType = sessionData.accountType as string

      // Only SUPERADMIN can create plants
      requirePermission(accountType as any, "plants", "create")

      const body = await request.json()
      const { org_id, vendor_id, vendor_plant_id, name, capacity_kw, location } =
        body

      // Use MAIN client - plants are stored in the main database
      const supabase = getMainClient()

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
        logApiResponse(request, 500, Date.now() - startTime, error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      logApiResponse(request, 201, Date.now() - startTime, { plantId: plant.id, name: plant.name })
      return NextResponse.json({ plant }, { status: 201 })
    } catch (error: any) {
      logApiResponse(request, 500, Date.now() - startTime, error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  })
}

