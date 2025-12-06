import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"
import { requirePermission } from "@/lib/rbac"

/**
 * GET /api/wms-vendors/[id]
 * Get a single WMS vendor
 */
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

    const accountType = sessionData.accountType as string
    const orgId = sessionData.orgId as number | null

    requirePermission(accountType as any, "wms_vendors", "read")

    const vendorId = parseInt(params.id)

    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: "Invalid vendor ID" },
        { status: 400 }
      )
    }

    const supabase = getMainClient()
    let query = supabase
      .from("wms_vendors")
      .select(`
        *,
        organizations (
          id,
          name
        )
      `)
      .eq("id", vendorId)

    // ORG users can only see their own org's vendors
    if (accountType === "ORG" && orgId) {
      query = query.eq("org_id", orgId)
    }

    const { data, error } = await query.single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "WMS vendor not found" },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ vendor: data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch WMS vendor" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/wms-vendors/[id]
 * Update a WMS vendor
 */
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

    requirePermission(accountType as any, "wms_vendors", "update")

    const vendorId = parseInt(params.id)
    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: "Invalid vendor ID" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, vendor_type, credentials, org_id, is_active } = body

    const supabase = getMainClient()

    // Build update object
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (vendor_type !== undefined) updateData.vendor_type = vendor_type
    if (credentials !== undefined) updateData.credentials = credentials
    if (org_id !== undefined) updateData.org_id = org_id
    if (is_active !== undefined) updateData.is_active = is_active

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("wms_vendors")
      .update(updateData)
      .eq("id", vendorId)
      .select()
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "WMS vendor not found" },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ vendor: data })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update WMS vendor" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/wms-vendors/[id]
 * Delete a WMS vendor
 */
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

    requirePermission(accountType as any, "wms_vendors", "delete")

    const vendorId = parseInt(params.id)
    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: "Invalid vendor ID" },
        { status: 400 }
      )
    }

    const supabase = getMainClient()

    const { error } = await supabase
      .from("wms_vendors")
      .delete()
      .eq("id", vendorId)

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "WMS vendor not found" },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete WMS vendor" },
      { status: 500 }
    )
  }
}

