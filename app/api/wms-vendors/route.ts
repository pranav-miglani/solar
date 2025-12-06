import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"
import { requirePermission } from "@/lib/rbac"

/**
 * GET /api/wms-vendors
 * List all WMS vendors (filtered by org for ORG users)
 */
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
    const orgId = sessionData.orgId as number | null

    requirePermission(accountType as any, "wms_vendors", "read")

    const supabase = getMainClient()
    let query = supabase.from("wms_vendors").select(`
      *,
      organizations (
        id,
        name
      )
    `)

    // ORG users can only see their own org's vendors
    if (accountType === "ORG" && orgId) {
      query = query.eq("org_id", orgId)
    }

    const { data, error } = await query.order("created_at", { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ vendors: data || [] })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch WMS vendors" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/wms-vendors
 * Create a new WMS vendor
 */
export async function POST(request: NextRequest) {
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

    requirePermission(accountType as any, "wms_vendors", "create")

    const body = await request.json()
    const { name, vendor_type, credentials, org_id, is_active = true } = body

    if (!name || !vendor_type || !credentials || !org_id) {
      return NextResponse.json(
        { error: "Missing required fields: name, vendor_type, credentials, org_id" },
        { status: 400 }
      )
    }

    // Validate vendor type
    if (vendor_type !== "INTELLO") {
      return NextResponse.json(
        { error: `Unsupported WMS vendor type: ${vendor_type}` },
        { status: 400 }
      )
    }

    // Validate credentials for INTELLO
    if (!credentials.email || !credentials.password_hash) {
      return NextResponse.json(
        { error: "INTELLO requires email and password_hash in credentials" },
        { status: 400 }
      )
    }

    const supabase = getMainClient()

    // Verify organization exists
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", org_id)
      .single()

    if (orgError || !org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    // Create WMS vendor
    const { data, error } = await supabase
      .from("wms_vendors")
      .insert({
        name,
        vendor_type: vendor_type,
        credentials,
        org_id,
        is_active,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ vendor: data }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create WMS vendor" },
      { status: 500 }
    )
  }
}

