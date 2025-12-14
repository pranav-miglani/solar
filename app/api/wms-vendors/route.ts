import { NextRequest, NextResponse } from "next/server"
import { getWmsVendorsRepository, getOrganizationsRepository } from "@/lib/repositories/main"
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

    // Use repository to fetch WMS vendors
    const wmsVendorsRepo = getWmsVendorsRepository()

    const filters = accountType === "ORG" && orgId ? { orgId } : undefined
    const vendors = await wmsVendorsRepo.findAllWithOrganizations(filters)

    return NextResponse.json({ vendors })
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
    if (vendor_type !== "INTELLO" && vendor_type !== "SCADA" && vendor_type !== "TRACKSO") {
      return NextResponse.json(
        { error: `Unsupported WMS vendor type: ${vendor_type}` },
        { status: 400 }
      )
    }

    // Validate credentials based on vendor type
    if (vendor_type === "INTELLO") {
      if (!credentials.email || !credentials.password_hash) {
        return NextResponse.json(
          { error: "INTELLO requires email and password_hash in credentials" },
          { status: 400 }
        )
      }
    } else if (vendor_type === "SCADA") {
      if (!credentials.loginId || !credentials.password || !credentials.userName || !credentials.userType) {
        return NextResponse.json(
          { error: "SCADA requires loginId, password, userName, and userType in credentials" },
          { status: 400 }
        )
      }
    }

    // Use repositories to verify org and create WMS vendor
    const orgsRepo = getOrganizationsRepository()
    const wmsVendorsRepo = getWmsVendorsRepository()

    // Verify organization exists
    const org = await orgsRepo.findById(org_id)
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      )
    }

    // Create WMS vendor
    const vendor = await wmsVendorsRepo.create({
      name,
      vendor_type: vendor_type as "INTELLO" | "SCADA" | "TRACKSO",
      credentials,
      org_id,
      is_active,
    })

    return NextResponse.json({ vendor }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create WMS vendor" },
      { status: 500 }
    )
  }
}

