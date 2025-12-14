import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import { logApiRequest, logApiResponse, withMDCContext } from "@/lib/api-logger"

// For vendors API, we need to bypass RLS for write operations

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

/**
 * GET /api/vendors
 * - Validates the custom session cookie
 * - Enforces RBAC (read permission)
 * - Returns both vendors and organizations so the UI can cross-link
 */
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

      // Fetch vendors and organizations directly from Supabase
      const supabase = getMainClient()

      // Fetch vendors with organizations join
      const { data: vendors, error: vendorsError } = await supabase
        .from("vendors")
        .select(`
          *,
          organizations (
            id,
            name
          )
        `)
        .order("name", { ascending: true })

      if (vendorsError) {
        throw vendorsError
      }

      // Fetch organizations separately
      const { data: orgs, error: orgsError } = await supabase
        .from("organizations")
        .select("*")
        .order("name", { ascending: true })

      if (orgsError) {
        throw orgsError
      }

      logApiResponse(request, 200, Date.now() - startTime)
      return NextResponse.json({
        vendors,
        orgs,
      })
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

/**
 * POST /api/vendors
 * - Authenticates + enforces "create" permission
 * - Inserts a vendor (credentials JSON lives as-is)
 * - Responds with the created vendor record
 */
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
      const {
        name,
        vendor_type,
        credentials,
        is_active,
        org_id,
        plant_sync_mode,
        per_plant_sync_interval_minutes,
        plant_sync_time_ist,
        telemetry_sync_mode,
        telemetry_sync_interval,
      } = body

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

      // Create vendor directly in Supabase
      const supabase = getMainClient()
      const { data: vendor, error: insertError } = await supabase
        .from("vendors")
        .insert({
          name,
          vendor_type,
          credentials,
          org_id,
          is_active: is_active ?? true,
          plant_sync_mode: plant_sync_mode || null,
          per_plant_sync_interval_minutes: per_plant_sync_interval_minutes ?? 15,
          plant_sync_time_ist: plant_sync_time_ist || '02:00',
          telemetry_sync_mode: telemetry_sync_mode || 'LIST_PLANTS',
          telemetry_sync_interval: telemetry_sync_interval ?? 15,
        })
        .select()
        .single()

      if (insertError) {
        throw insertError
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

/**
 * PATCH /api/vendors/[id]
 * Vendor update route lives in app/api/vendors/[id]/route.ts. This file only
 * handles collection-level POST/GET. Plant sync configuration fields are
 * passed through there as well.
 */
