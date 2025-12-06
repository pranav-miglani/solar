import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import ExcelJS from "exceljs"

/**
 * GET /api/wms-vendors/export
 * Export WMS vendors to Excel file
 * Only SUPERADMIN and DEVELOPER can export
 */

export const dynamic = 'force-dynamic'

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

    // Only SUPERADMIN and DEVELOPER can export WMS vendors
    requirePermission(accountType as any, "wms_vendors", "read")

    // Get orgId from query parameter if provided (for filtering by organization)
    const { searchParams } = new URL(request.url)
    const filterOrgId = searchParams.get("orgId")
    const targetOrgId = filterOrgId ? parseInt(filterOrgId, 10) : null

    const supabase = getMainClient()

    let query = supabase
      .from("wms_vendors")
      .select(`
        id,
        name,
        vendor_type,
        credentials,
        is_active,
        org_id,
        last_sites_synced_at,
        last_insolation_synced_at,
        created_at,
        organizations(id, name)
      `)
      .order("name")

    // Filter by organization if orgId query parameter is provided
    if (targetOrgId) {
      query = query.eq("org_id", targetOrgId)
    }

    const { data: vendors, error } = await query

    if (error) {
      console.error("WMS vendors query error:", error)
      return NextResponse.json(
        { error: "Failed to fetch WMS vendors" },
        { status: 500 }
      )
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("WMS Vendors")

    // Define columns
    worksheet.columns = [
      { header: "WMS Vendor ID", key: "wms_vendor_id", width: 15 },
      { header: "Name", key: "name", width: 30 },
      { header: "Vendor Type", key: "vendor_type", width: 20 },
      { header: "Organization ID", key: "org_id", width: 15 },
      { header: "Organization Name", key: "org_name", width: 30 },
      { header: "Is Active", key: "is_active", width: 12 },
      { header: "Credentials (JSON)", key: "credentials", width: 50 },
      { header: "Last Sites Sync", key: "last_sites_synced_at", width: 25 },
      { header: "Last Insolation Sync", key: "last_insolation_synced_at", width: 25 },
      { header: "Created At", key: "created_at", width: 25 },
    ]

    // Style header row
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }

    // Add data rows
    if (vendors && vendors.length > 0) {
      for (const vendor of vendors) {
        const orgName = (vendor.organizations as any)?.name || ""
        
        worksheet.addRow({
          wms_vendor_id: vendor.id,
          name: vendor.name,
          vendor_type: vendor.vendor_type,
          org_id: vendor.org_id || "",
          org_name: orgName,
          is_active: vendor.is_active ? "Yes" : "No",
          credentials: JSON.stringify(vendor.credentials),
          last_sites_synced_at: vendor.last_sites_synced_at 
            ? new Date(vendor.last_sites_synced_at).toISOString() 
            : "",
          last_insolation_synced_at: vendor.last_insolation_synced_at 
            ? new Date(vendor.last_insolation_synced_at).toISOString() 
            : "",
          created_at: vendor.created_at 
            ? new Date(vendor.created_at).toISOString() 
            : "",
        })
      }
    }

    // Generate Excel file buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Return Excel file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="wms_vendors_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error("WMS vendors export error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

