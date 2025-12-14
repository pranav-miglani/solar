import { NextRequest, NextResponse } from "next/server"
import { getWmsVendorsRepository } from "@/lib/repositories/main"
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

    const wmsVendorsRepo = getWmsVendorsRepository()
    const vendor = await wmsVendorsRepo.findByIdWithOrganization(vendorId)

    if (!vendor) {
      return NextResponse.json(
        { error: "WMS vendor not found" },
        { status: 404 }
      )
    }

    // ORG users can only see their own org's vendors
    if (accountType === "ORG" && orgId && vendor.org_id !== orgId) {
      return NextResponse.json(
        { error: "WMS vendor not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ vendor })
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

    // Check if any fields to update
    if (name === undefined && vendor_type === undefined && credentials === undefined && 
        org_id === undefined && is_active === undefined) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      )
    }

    const wmsVendorsRepo = getWmsVendorsRepository()
    const vendor = await wmsVendorsRepo.update(vendorId, {
      name,
      vendor_type,
      credentials,
      org_id,
      is_active,
    })

    return NextResponse.json({ vendor })
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

    const wmsVendorsRepo = getWmsVendorsRepository()
    await wmsVendorsRepo.deleteById(vendorId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete WMS vendor" },
      { status: 500 }
    )
  }
}

