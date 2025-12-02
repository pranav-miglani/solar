import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import ExcelJS from "exceljs"

// Mark route as dynamic to prevent static generation (uses cookies)
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

    // Only SUPERADMIN and DEVELOPER can export vendors
    if (accountType !== "SUPERADMIN" && accountType !== "DEVELOPER") {
      return NextResponse.json(
        { error: "Only SUPERADMIN and DEVELOPER can export vendors" },
        { status: 403 }
      )
    }

    // Get orgId from query parameter if provided (for filtering by organization)
    const { searchParams } = new URL(request.url)
    const filterOrgId = searchParams.get("orgId")
    const targetOrgId = filterOrgId ? parseInt(filterOrgId, 10) : null

    // Use service role client to bypass RLS
    const supabase = getMainClient()

    let query = supabase
      .from("vendors")
      .select(`
        id,
        name,
        vendor_type,
        credentials,
        is_active,
        org_id,
        plant_sync_mode,
        per_plant_sync_interval_minutes,
        plant_list_sync_morning_ist,
        plant_list_sync_evening_ist,
        telemetry_sync_mode,
        telemetry_sync_interval,
        organizations(id, name)
      `)
      .order("name")

    // Filter by organization if orgId query parameter is provided
    if (targetOrgId) {
      query = query.eq("org_id", targetOrgId)
    }

    const { data: vendors, error } = await query

    if (error) {
      console.error("Vendors query error:", error)
      return NextResponse.json(
        { error: "Failed to fetch vendors" },
        { status: 500 }
      )
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Vendors")

    // Define columns
    worksheet.columns = [
      { header: "Vendor ID", key: "vendor_id", width: 15 },
      { header: "Name", key: "name", width: 30 },
      { header: "Vendor Type", key: "vendor_type", width: 20 },
      { header: "Organization ID", key: "org_id", width: 15 },
      { header: "Organization Name", key: "org_name", width: 30 },
      { header: "Is Active", key: "is_active", width: 12 },
      { header: "Credentials (JSON)", key: "credentials", width: 50 },
      { header: "Plant Sync Mode", key: "plant_sync_mode", width: 20 },
      { header: "Per Plant Sync Interval (minutes)", key: "per_plant_sync_interval_minutes", width: 30 },
      { header: "Plant List Sync Morning (IST)", key: "plant_list_sync_morning_ist", width: 25 },
      { header: "Plant List Sync Evening (IST)", key: "plant_list_sync_evening_ist", width: 25 },
      { header: "Telemetry Sync Mode", key: "telemetry_sync_mode", width: 20 },
      { header: "Telemetry Sync Interval (minutes)", key: "telemetry_sync_interval", width: 30 },
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
          vendor_id: vendor.id,
          name: vendor.name,
          vendor_type: vendor.vendor_type,
          org_id: vendor.org_id || "",
          org_name: orgName,
          is_active: vendor.is_active ? "Yes" : "No",
          credentials: JSON.stringify(vendor.credentials),
          plant_sync_mode: vendor.plant_sync_mode || "",
          per_plant_sync_interval_minutes: vendor.per_plant_sync_interval_minutes || "",
          plant_list_sync_morning_ist: vendor.plant_list_sync_morning_ist || "",
          plant_list_sync_evening_ist: vendor.plant_list_sync_evening_ist || "",
          telemetry_sync_mode: vendor.telemetry_sync_mode || "",
          telemetry_sync_interval: vendor.telemetry_sync_interval || "",
        })
      }
    }

    // Generate Excel file buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Return Excel file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="vendors_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error("Vendors export error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

