import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"
import { requireAuth } from "@/lib/auth/requireAuth"
import { checkPermission } from "@/lib/rbac"

/**
 * GET /api/wms-vendors/[id]
 * Get a single WMS vendor
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { account, accountType } = await requireAuth(request)
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
    if (accountType === "ORG" && account?.orgId) {
      query = query.eq("org_id", account.orgId)
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
    const { account, accountType } = await requireAuth(request)

    // Only SUPERADMIN and DEVELOPER can update WMS vendors
    if (!checkPermission(accountType, "wms_vendors", "update")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      )
    }

    const vendorId = parseInt(params.id)
    if (isNaN(vendorId)) {
      return NextResponse.json(
        { error: "Invalid vendor ID" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { name, credentials, is_active } = body

    const supabase = getMainClient()

    // Build update object
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (credentials !== undefined) updateData.credentials = credentials
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
    const { account, accountType } = await requireAuth(request)

    // Only SUPERADMIN and DEVELOPER can delete WMS vendors
    if (!checkPermission(accountType, "wms_vendors", "delete")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      )
    }

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

