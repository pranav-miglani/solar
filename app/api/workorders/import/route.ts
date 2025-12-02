import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import ExcelJS from "exceljs"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

interface ImportRow {
  work_order_id?: number
  title: string
  description?: string
  location?: string
  org_id: number
  org_name?: string
  vendor_plant_id: string
  vendor_type: string
  plant_name?: string
  vendor_id?: number
  vendor_name?: string
  capacity_kw?: number
}

interface ImportResult {
  rowNumber: number
  workOrderId?: number
  success: boolean
  error?: string
}

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

    // Only SUPERADMIN and DEVELOPER can import work orders
    requirePermission(accountType as any, "work_orders", "create")

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an Excel file (.xlsx or .xls)" },
        { status: 400 }
      )
    }

    // Read Excel file
    const buffer = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const worksheet = workbook.getWorksheet(1) // Get first worksheet
    if (!worksheet) {
      return NextResponse.json(
        { error: "Excel file is empty" },
        { status: 400 }
      )
    }

    // Parse rows (skip header row)
    const rows: ImportRow[] = []
    const headers: string[] = []
    
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        // Header row
        row.eachCell((cell, colNumber) => {
          headers[colNumber] = cell.value?.toString() || ""
        })
      } else {
        // Data row
        const rowData: any = {}
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber]
          if (header) {
            rowData[header] = cell.value
          }
        })
        
        // Map to ImportRow structure
        const importRow: ImportRow = {
          work_order_id: rowData["Work Order ID"] ? parseInt(rowData["Work Order ID"]) : undefined,
          title: rowData["Title"]?.toString() || "",
          description: rowData["Description"]?.toString() || "",
          location: rowData["Location"]?.toString() || "",
          org_id: rowData["Organization ID"] ? parseInt(rowData["Organization ID"]) : 0,
          org_name: rowData["Organization Name"]?.toString() || "",
          vendor_plant_id: rowData["Vendor Plant ID"]?.toString() || "",
          vendor_type: rowData["Vendor Type"]?.toString() || "",
          plant_name: rowData["Plant Name"]?.toString() || "",
          vendor_id: rowData["Vendor ID"] ? parseInt(rowData["Vendor ID"]) : undefined,
          vendor_name: rowData["Vendor Name"]?.toString() || "",
          capacity_kw: rowData["Capacity (kW)"] ? parseFloat(rowData["Capacity (kW)"]) : undefined,
        }
        
        // Only add rows with required fields: title, org_id, vendor_plant_id, vendor_type
        if (importRow.title && importRow.org_id && importRow.vendor_plant_id && importRow.vendor_type) {
          rows.push(importRow)
        }
      }
    })

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid data rows found in Excel file" },
        { status: 400 }
      )
    }

    // Use service role client to bypass RLS
    const supabase = getMainClient()

    // Group rows by work order (title + org_id combination)
    const workOrderGroups = new Map<string, ImportRow[]>()
    for (const row of rows) {
      const key = `${row.title}|${row.org_id}`
      if (!workOrderGroups.has(key)) {
        workOrderGroups.set(key, [])
      }
      workOrderGroups.get(key)!.push(row)
    }

    const results: ImportResult[] = []
    let totalProcessed = 0
    let totalErrors = 0

    // Process each work order group
    for (const [key, groupRows] of workOrderGroups.entries()) {
      const firstRow = groupRows[0]
      
      // Validate organization exists
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id")
        .eq("id", firstRow.org_id)
        .single()

      if (orgError || !org) {
        for (const row of groupRows) {
          results.push({
            rowNumber: rows.indexOf(row) + 2, // +2 for header row and 1-based index
            success: false,
            error: `Organization ID ${firstRow.org_id} not found`,
          })
          totalErrors++
        }
        continue
      }

      // Validate all plants exist and belong to the same org
      // Look up plants by vendor_plant_id and vendor_type (vendor_plant_id is unique per vendor_type)
      const vendorPlantIds = groupRows.map(r => r.vendor_plant_id)
      const vendorTypes = [...new Set(groupRows.map(r => r.vendor_type))]
      
      // Get vendors for the specified vendor types
      const { data: vendors, error: vendorsError } = await supabase
        .from("vendors")
        .select("id, vendor_type")
        .in("vendor_type", vendorTypes)
      
      if (vendorsError || !vendors || vendors.length === 0) {
        for (const row of groupRows) {
          results.push({
            rowNumber: rows.indexOf(row) + 2,
            success: false,
            error: `Vendor type "${row.vendor_type}" not found`,
          })
          totalErrors++
        }
        continue
      }
      
      // Create map of vendor_type to vendor_id
      const vendorTypeToId = new Map(vendors.map(v => [v.vendor_type, v.id]))
      
      // Get all plants with matching vendor_plant_ids and vendor_ids
      const vendorIds = Array.from(vendorTypeToId.values())
      const { data: plants, error: plantsError } = await supabase
        .from("plants")
        .select("id, org_id, vendor_id, vendor_plant_id, name")
        .in("vendor_plant_id", vendorPlantIds)
        .in("vendor_id", vendorIds)

      if (plantsError) {
        for (const row of groupRows) {
          results.push({
            rowNumber: rows.indexOf(row) + 2,
            success: false,
            error: "Failed to validate plants",
          })
          totalErrors++
        }
        continue
      }

      // Match plants by vendor_plant_id and vendor_type (vendor_plant_id is unique per vendor_type)
      const matchedPlants: Array<{ row: ImportRow; plant: any }> = []
      const unmatchedRows: ImportRow[] = []

      for (const row of groupRows) {
        const vendorId = vendorTypeToId.get(row.vendor_type)
        if (!vendorId) {
          unmatchedRows.push(row)
          continue
        }
        
        const plant = plants?.find(
          (p: any) => 
            p.vendor_plant_id === row.vendor_plant_id && 
            p.vendor_id === vendorId
        )
        
        if (plant) {
          matchedPlants.push({ row, plant })
        } else {
          unmatchedRows.push(row)
        }
      }

      if (unmatchedRows.length > 0) {
        for (const row of unmatchedRows) {
          const vendorId = vendorTypeToId.get(row.vendor_type)
          if (!vendorId) {
            results.push({
              rowNumber: rows.indexOf(row) + 2,
              success: false,
              error: `Vendor type "${row.vendor_type}" not found`,
            })
          } else {
            results.push({
              rowNumber: rows.indexOf(row) + 2,
              success: false,
              error: `Plant not found: Vendor Plant ID "${row.vendor_plant_id}" for vendor type "${row.vendor_type}"`,
            })
          }
          totalErrors++
        }
      }

      if (matchedPlants.length === 0) {
        continue
      }

      const plantIds = matchedPlants.map(mp => mp.plant.id)
      const validatedPlants = matchedPlants.map(mp => mp.plant)

      // Check that all plants belong to the same org
      const plantOrgIds = [...new Set(validatedPlants.map(p => p.org_id))]
      if (plantOrgIds.length > 1 || plantOrgIds[0] !== firstRow.org_id) {
        for (const matched of matchedPlants) {
          results.push({
            rowNumber: rows.indexOf(matched.row) + 2,
            success: false,
            error: "All plants must belong to the same organization as the work order",
          })
          totalErrors++
        }
        continue
      }

      // Check if work order already exists (by title and org_id)
      const { data: existingWorkOrder } = await supabase
        .from("work_orders")
        .select("id")
        .eq("title", firstRow.title)
        .eq("org_id", firstRow.org_id)
        .single()

      if (existingWorkOrder) {
        // Work order already exists - skip (no updates allowed)
        // Note: We haven't matched plants yet, so we can't use matchedPlants here
        // But we can still report the error for all rows
        for (const row of groupRows) {
          results.push({
            rowNumber: rows.indexOf(row) + 2,
            workOrderId: existingWorkOrder.id,
            success: false,
            error: "Work order already exists (no updates allowed)",
          })
          totalErrors++
        }
        continue
      }

      // Check if any plant is already in another active work order
      const { data: existingPlantMappings } = await supabase
        .from("work_order_plants")
        .select("plant_id, work_order_id")
        .in("plant_id", plantIds)
        .eq("is_active", true)

      const plantsInOtherWorkOrders = new Map(
        (existingPlantMappings || []).map(m => [m.plant_id, m.work_order_id])
      )

      if (plantsInOtherWorkOrders.size > 0) {
        for (const matched of matchedPlants) {
          if (plantsInOtherWorkOrders.has(matched.plant.id)) {
            results.push({
              rowNumber: rows.indexOf(matched.row) + 2,
              success: false,
              error: `Plant (Vendor Plant ID: ${matched.row.vendor_plant_id}, Vendor Type: ${matched.row.vendor_type}) is already mapped to work order ${plantsInOtherWorkOrders.get(matched.plant.id)}`,
            })
            totalErrors++
          }
        }
        continue
      }

      // All validations passed - create work order and plant mappings
      try {
        const { data: newWorkOrder, error: woError } = await supabase
          .from("work_orders")
          .insert({
            title: firstRow.title,
            description: firstRow.description || null,
            location: firstRow.location || null,
            org_id: firstRow.org_id,
            priority: "MEDIUM",
            created_by: sessionData.accountId,
          })
          .select()
          .single()

        if (woError || !newWorkOrder) {
          for (const matched of matchedPlants) {
            results.push({
              rowNumber: rows.indexOf(matched.row) + 2,
              success: false,
              error: `Failed to create work order: ${woError?.message || "Unknown error"}`,
            })
            totalErrors++
          }
          continue
        }

        // Create plant mappings using matched plants
        const plantInserts = matchedPlants.map(matched => ({
          work_order_id: newWorkOrder.id,
          plant_id: matched.plant.id,
          is_active: true,
        }))

        const { error: plantError } = await supabase
          .from("work_order_plants")
          .insert(plantInserts)

        if (plantError) {
          for (const matched of matchedPlants) {
            results.push({
              rowNumber: rows.indexOf(matched.row) + 2,
              workOrderId: newWorkOrder.id,
              success: false,
              error: `Failed to create plant mapping: ${plantError.message}`,
            })
            totalErrors++
          }
          continue
        }

        // Success
        for (const matched of matchedPlants) {
          results.push({
            rowNumber: rows.indexOf(matched.row) + 2,
            workOrderId: newWorkOrder.id,
            success: true,
          })
          totalProcessed++
        }
      } catch (createError: any) {
        for (const matched of matchedPlants) {
          results.push({
            rowNumber: rows.indexOf(matched.row) + 2,
            success: false,
            error: `Failed to create work order: ${createError.message}`,
          })
          totalErrors++
        }
      }
    }

    return NextResponse.json({
      message: "Import complete",
      summary: {
        totalRows: rows.length,
        processed: totalProcessed,
        errors: totalErrors,
      },
      results: results.slice(0, 100), // Limit to first 100 results for response size
      note: "Existing work orders and plant mappings were not updated. Only new work orders were created.",
    })
  } catch (error: any) {
    console.error("Work orders import error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

