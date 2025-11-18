import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import { logApiRequest, logApiResponse, withMDCContext } from "@/lib/api-logger"

// For orgs API, we need to bypass RLS for write operations
// We use service role key since RLS policies require auth.uid() which we don't have

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

      let sessionData
      try {
        sessionData = JSON.parse(Buffer.from(session, "base64").toString())
      } catch {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Invalid session" }, { status: 401 })
      }

      const accountType = sessionData.accountType as string

      requirePermission(accountType as any, "organizations", "read")

      // Use service role client to bypass RLS
      const supabase = getMainClient()

      const { data: orgs, error } = await supabase
        .from("organizations")
        .select("*")
        .order("name")

      if (error) {
        console.error("Orgs query error:", error)
        logApiResponse(request, 500, Date.now() - startTime, error)
        return NextResponse.json(
          { error: "Failed to fetch organizations" },
          { status: 500 }
        )
      }

      logApiResponse(request, 200, Date.now() - startTime)
      return NextResponse.json({ orgs: orgs || [] })
    } catch (error: any) {
      console.error("Orgs error:", error)
      logApiResponse(request, 403, Date.now() - startTime, error)
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 403 }
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

      let sessionData
      try {
        sessionData = JSON.parse(Buffer.from(session, "base64").toString())
      } catch {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Invalid session" }, { status: 401 })
      }

      const accountType = sessionData.accountType as string

      // Only SUPERADMIN can create organizations
      requirePermission(accountType as any, "organizations", "create")

      const body = await request.json()
      const { name } = body

      if (!name) {
        logApiResponse(request, 400, Date.now() - startTime)
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        )
      }

      // Use service role client to bypass RLS for insert
      const supabase = getMainClient()

      const { data: org, error } = await supabase
        .from("organizations")
        .insert({ name })
        .select()
        .single()

      if (error) {
        console.error("Org creation error:", error)
        console.error("Error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        })
        logApiResponse(request, 500, Date.now() - startTime, error)
        return NextResponse.json(
          { error: "Failed to create organization", details: error.message },
          { status: 500 }
        )
      }

      logApiResponse(request, 201, Date.now() - startTime)
      return NextResponse.json({ org }, { status: 201 })
    } catch (error: any) {
      console.error("Org creation error:", error)
      logApiResponse(request, error.message?.includes("permission") ? 403 : 500, Date.now() - startTime, error)
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: error.message?.includes("permission") ? 403 : 500 }
      )
    }
  })
}
