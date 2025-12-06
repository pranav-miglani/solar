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

    // Only SUPERADMIN and DEVELOPER can export work orders
    requirePermission(accountType as any, "work_orders", "read")

    // Get orgId from query parameter if provided (for filtering by organization)
    const { searchParams } = new URL(request.url)
    const filterOrgId = searchParams.get("orgId")
    const targetOrgId = filterOrgId ? parseInt(filterOrgId, 10) : null

    // Use service role client to bypass RLS
    const supabase = getMainClient()

    let query = supabase
      .from("work_orders")
      .select(`
        id,
        title,
        description,
        location,
        created_at,
        updated_at,
        org_id,
        organizations(id, name),
        work_order_plants(
          *,
          plants:plant_id (
            id,
            name,
            vendor_plant_id,
            org_id,
            capacity_kw,
            vendors(id, name, vendor_type),
            organizations(id, name)
          )
        )
      `)
      .order("created_at", { ascending: false })

    // Filter by organization if orgId query parameter is provided
    if (targetOrgId) {
      query = query.eq("org_id", targetOrgId)
    }

    const { data: workOrders, error } = await query

    if (error) {
      console.error("Work orders query error:", error)
      return NextResponse.json(
        { error: "Failed to fetch work orders" },
        { status: 500 }
      )
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Work Orders")

    // Define columns - Include Plant ID (internal ID) for easier re-import
    worksheet.columns = [
      { header: "Work Order ID", key: "work_order_id", width: 15 },
      { header: "Title", key: "title", width: 30 },
      { header: "Description", key: "description", width: 40 },
      { header: "Location", key: "location", width: 30 },
      { header: "Organization ID", key: "org_id", width: 15 },
      { header: "Organization Name", key: "org_name", width: 30 },
      { header: "Plant ID", key: "plant_id", width: 15 },
      { header: "Vendor Plant ID", key: "vendor_plant_id", width: 20 },
      { header: "Plant Name", key: "plant_name", width: 30 },
      { header: "Vendor ID", key: "vendor_id", width: 15 },
      { header: "Vendor Name", key: "vendor_name", width: 25 },
      { header: "Vendor Type", key: "vendor_type", width: 20 },
      { header: "Capacity (kW)", key: "capacity_kw", width: 15 },
      { header: "Created At", key: "created_at", width: 20 },
      { header: "Updated At", key: "updated_at", width: 20 },
    ]

    // Style header row
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }

    // Add data rows
    if (workOrders && workOrders.length > 0) {
      for (const workOrder of workOrders) {
        const orgName = (workOrder.organizations as any)?.name || ""
        const workOrderPlants = workOrder.work_order_plants as any[] || []

        if (workOrderPlants.length === 0) {
          // Work order with no plants
          worksheet.addRow({
            work_order_id: workOrder.id,
            title: workOrder.title,
            description: workOrder.description || "",
            location: workOrder.location || "",
            org_id: workOrder.org_id,
            org_name: orgName,
            plant_id: "",
            vendor_plant_id: "",
            plant_name: "",
            vendor_id: "",
            vendor_name: "",
            vendor_type: "",
            capacity_kw: "",
            created_at: workOrder.created_at ? new Date(workOrder.created_at).toISOString() : "",
            updated_at: workOrder.updated_at ? new Date(workOrder.updated_at).toISOString() : "",
          })
        } else {
          // One row per plant
          for (const workOrderPlant of workOrderPlants) {
            const plant = workOrderPlant.plants as any
            const vendor = plant?.vendors || {}
            
            worksheet.addRow({
              work_order_id: workOrder.id,
              title: workOrder.title,
              description: workOrder.description || "",
              location: workOrder.location || "",
              org_id: workOrder.org_id,
              org_name: orgName,
              plant_id: plant?.id || "",
              vendor_plant_id: plant?.vendor_plant_id || "",
              plant_name: plant?.name || "",
              vendor_id: vendor?.id || "",
              vendor_name: vendor?.name || "",
              vendor_type: vendor?.vendor_type || "",
              capacity_kw: plant?.capacity_kw || "",
              created_at: workOrder.created_at ? new Date(workOrder.created_at).toISOString() : "",
              updated_at: workOrder.updated_at ? new Date(workOrder.updated_at).toISOString() : "",
            })
          }
        }
      }
    }

    // Generate Excel file buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Return Excel file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="work_orders_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error("Work orders export error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

