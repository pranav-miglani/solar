import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import { logApiRequest, logApiResponse, withMDCContext } from "@/lib/api-logger"

// For vendors API, we need to bypass RLS for write operations

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

      requirePermission(accountType as any, "vendors", "read")

      // Use service role client to bypass RLS
      const supabase = getMainClient()

      const { data: vendors, error } = await supabase
        .from("vendors")
        .select("*, organizations(id, name, auto_sync_enabled, sync_interval_minutes)")
        .order("name")

      if (error) {
        console.error("Vendors query error:", error)
        logApiResponse(request, 500, Date.now() - startTime, error)
        return NextResponse.json(
          { error: "Failed to fetch vendors" },
          { status: 500 }
        )
      }

      logApiResponse(request, 200, Date.now() - startTime)
      return NextResponse.json({ vendors: vendors || [] })
    } catch (error: any) {
      console.error("Vendors error:", error)
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

      requirePermission(accountType as any, "vendors", "create")

      const body = await request.json()
      const { name, vendor_type, credentials, is_active, org_id } = body

      if (!name || !vendor_type || !credentials) {
        logApiResponse(request, 400, Date.now() - startTime)
        return NextResponse.json(
          { error: "Name, vendor_type, and credentials are required" },
          { status: 400 }
        )
      }

      if (!org_id) {
        logApiResponse(request, 400, Date.now() - startTime)
        return NextResponse.json(
          { error: "org_id is required" },
          { status: 400 }
        )
      }

      // Use service role client to bypass RLS for insert
      const supabase = getMainClient()

      const { data: vendor, error } = await supabase
        .from("vendors")
        .insert({
          name,
          vendor_type,
          // api_base_url removed - now stored in environment variables
          credentials,
          is_active: is_active ?? true,
          org_id,
        })
        .select()
        .single()

      if (error) {
        console.error("Vendor creation error:", error)
        logApiResponse(request, 500, Date.now() - startTime, error)
        return NextResponse.json(
          { error: "Failed to create vendor" },
          { status: 500 }
        )
      }

      logApiResponse(request, 201, Date.now() - startTime, { vendorId: vendor.id, name: vendor.name })
      return NextResponse.json({ vendor }, { status: 201 })
    } catch (error: any) {
      console.error("Vendor creation error:", error)
      logApiResponse(request, 403, Date.now() - startTime, error)
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 403 }
      )
    }
  })
}
