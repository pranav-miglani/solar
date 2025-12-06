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
  // Option 1: Use vendor_id + vendor_plant_id
  vendor_plant_id?: string
  vendor_type?: string
  vendor_id?: number
  vendor_name?: string
  // Option 2: Use internal plant ID (plants.id)
  plant_id?: number
  // Optional fields for validation/reference
  plant_name?: string
  capacity_kw?: number
}

interface ImportResult {
  rowNumber: number
  workOrderId?: number
  success: boolean
  error?: string
  // Additional details for report
  title?: string
  orgId?: number
  orgName?: string
  plantId?: number
  vendorPlantId?: string
  plantName?: string
  vendorId?: number
  vendorName?: string
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
        // Support two formats:
        // Option 1: title, orgId, vendorId, Vendor Plant Id
        // Option 2: title, orgId, Plant ID (internal plant ID)
        const importRow: ImportRow = {
          work_order_id: rowData["Work Order ID"] ? parseInt(rowData["Work Order ID"]) : undefined,
          title: rowData["Title"]?.toString() || "",
          description: rowData["Description"]?.toString() || "",
          location: rowData["Location"]?.toString() || "",
          org_id: rowData["Organization ID"] ? parseInt(rowData["Organization ID"]) : 0,
          org_name: rowData["Organization Name"]?.toString() || "",
          // Option 1 fields
          vendor_plant_id: rowData["Vendor Plant ID"]?.toString() || rowData["Vendor Plant Id"]?.toString() || undefined,
          vendor_type: rowData["Vendor Type"]?.toString() || undefined,
          vendor_id: rowData["Vendor ID"] ? parseInt(rowData["Vendor ID"]) : undefined,
          vendor_name: rowData["Vendor Name"]?.toString() || undefined,
          // Option 2 field
          plant_id: rowData["Plant ID"] ? parseInt(rowData["Plant ID"]) : rowData["Plant Id"] ? parseInt(rowData["Plant Id"]) : undefined,
          // Optional fields
          plant_name: rowData["Plant Name"]?.toString() || undefined,
          capacity_kw: rowData["Capacity (kW)"] ? parseFloat(rowData["Capacity (kW)"]) : undefined,
        }
        
        // Validate required fields: title, org_id, and either:
        // Option 1a: vendor_id + vendor_plant_id (new format)
        // Option 1b: vendor_type + vendor_plant_id (original format - backward compatible)
        // Option 2: plant_id (internal ID)
        const hasOption1a = importRow.title && importRow.org_id && importRow.vendor_id && importRow.vendor_plant_id
        const hasOption1b = importRow.title && importRow.org_id && importRow.vendor_type && importRow.vendor_plant_id
        const hasOption2 = importRow.title && importRow.org_id && importRow.plant_id
        
        if (hasOption1a || hasOption1b || hasOption2) {
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

    // Helper function to enrich result with row data
    const enrichResult = (result: ImportResult, row?: ImportRow, plant?: any, vendor?: any): ImportResult => {
      return {
        ...result,
        title: result.title || row?.title,
        orgId: result.orgId || row?.org_id,
        orgName: result.orgName || row?.org_name,
        plantId: result.plantId || plant?.id || row?.plant_id,
        vendorPlantId: result.vendorPlantId || plant?.vendor_plant_id || row?.vendor_plant_id,
        plantName: result.plantName || plant?.name || row?.plant_name,
        vendorId: result.vendorId || vendor?.id || row?.vendor_id,
        vendorName: result.vendorName || vendor?.name || row?.vendor_name,
      }
    }

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
          results.push(enrichResult({
            rowNumber: rows.indexOf(row) + 2, // +2 for header row and 1-based index
            success: false,
            error: `Organization ID ${firstRow.org_id} not found`,
          }, row))
          totalErrors++
        }
        continue
      }

      // Separate rows by import format
      // Priority: Option 2 (Plant ID) > Option 1a (Vendor ID) > Option 1b (Vendor Type)
      // This ensures downloaded files (which have all fields) use the most direct method (Plant ID)
      const option2Rows = groupRows.filter(r => r.plant_id) // Option 2: plant_id (internal ID) - highest priority
      const option1aRows = groupRows.filter(r => !r.plant_id && r.vendor_id && r.vendor_plant_id) // Option 1a: vendor_id + vendor_plant_id (exclude if plant_id exists)
      const option1bRows = groupRows.filter(r => !r.plant_id && !r.vendor_id && r.vendor_type && r.vendor_plant_id) // Option 1b: vendor_type + vendor_plant_id (exclude if plant_id or vendor_id exists)
      const option1Rows = [...option1aRows, ...option1bRows] // Combined Option 1 rows
      
      // Validate Option 2 rows first (simpler - direct plant lookup)
      let option2Plants: any[] = []
      if (option2Rows.length > 0) {
        const plantIds = option2Rows.map(r => r.plant_id!).filter(id => id > 0)
        if (plantIds.length > 0) {
          const { data: plants, error: plantsError } = await supabase
            .from("plants")
            .select("id, org_id, vendor_id, vendor_plant_id, name")
            .in("id", plantIds)
            .eq("org_id", firstRow.org_id) // Ensure plants belong to the work order's org
          
          if (plantsError) {
            for (const row of option2Rows) {
              results.push(enrichResult({
                rowNumber: rows.indexOf(row) + 2,
                success: false,
                error: "Failed to validate plants",
              }, row))
              totalErrors++
            }
          } else {
            option2Plants = plants || []
          }
        }
      }
      
      // Validate Option 1 rows (vendor_id + vendor_plant_id)
      let option1Plants: any[] = []
      let vendors: any[] = []
      let vendorTypeToVendors = new Map<string, any[]>()
      let vendorIdToVendor = new Map<number, any>()
      
      if (option1Rows.length > 0) {
        const vendorPlantIds = option1Rows.map(r => r.vendor_plant_id!).filter(id => id)
        const vendorTypes = [...new Set(option1Rows.map(r => r.vendor_type).filter(t => t))]
        const vendorIds = [...new Set(option1Rows.map(r => r.vendor_id).filter(id => id !== undefined && id !== null))] as number[]
        
        // Build query to get vendors
        // Option 1a: If vendor_id is provided, use it (new format)
        // Option 1b: If vendor_type is provided, use it (original format - backward compatible)
        let vendorsQuery = supabase
        .from("vendors")
          .select("id, vendor_type, org_id, name")
        
        if (vendorIds.length > 0 && vendorTypes.length > 0) {
          // Both vendor_id and vendor_type provided - get vendors matching either
          vendorsQuery = vendorsQuery.or(`id.in.(${vendorIds.join(',')}),vendor_type.in.(${vendorTypes.join(',')})`)
        } else if (vendorIds.length > 0) {
          // Only vendor_ids provided (Option 1a - new format)
          vendorsQuery = vendorsQuery.in("id", vendorIds)
        } else if (vendorTypes.length > 0) {
          // Only vendor_types provided (Option 1b - original format)
          vendorsQuery = vendorsQuery.in("vendor_type", vendorTypes)
        } else {
          // Neither provided - this shouldn't happen due to validation, but handle it
          for (const row of option1Rows) {
            results.push(enrichResult({
            rowNumber: rows.indexOf(row) + 2,
            success: false,
              error: "Either Vendor ID or Vendor Type must be provided with Vendor Plant ID",
            }, row))
          totalErrors++
        }
        continue
      }
      
        // Filter by org (must belong to work order's org or be global)
        vendorsQuery = vendorsQuery.or(`org_id.eq.${firstRow.org_id},org_id.is.null`)
        
        const { data: vendorsData, error: vendorsError } = await vendorsQuery
        
        if (vendorsError || !vendorsData || vendorsData.length === 0) {
          for (const row of option1Rows) {
            if (row.vendor_id) {
              results.push(enrichResult({
                rowNumber: rows.indexOf(row) + 2,
                success: false,
                error: `Vendor ID ${row.vendor_id} not found or does not belong to organization ID ${firstRow.org_id}`,
              }, row))
            } else {
              results.push(enrichResult({
                rowNumber: rows.indexOf(row) + 2,
                success: false,
                error: `No vendors found for vendor type "${row.vendor_type}" that belong to organization ID ${firstRow.org_id} or are global vendors`,
              }, row))
            }
            totalErrors++
          }
        } else {
          vendors = vendorsData
        }
      }
      
      // If vendor_id is provided in Excel (Option 1), validate it matches vendor_type and org
      for (const row of option1Rows) {
        if (row.vendor_id) {
          const vendor = vendors.find(v => v.id === row.vendor_id)
          if (!vendor) {
            results.push(enrichResult({
              rowNumber: rows.indexOf(row) + 2,
              success: false,
              error: `Vendor ID ${row.vendor_id} not found or does not belong to organization ID ${firstRow.org_id}`,
            }, row, undefined, { id: row.vendor_id }))
            totalErrors++
            continue
          }
          if (row.vendor_type && vendor.vendor_type !== row.vendor_type) {
            results.push(enrichResult({
              rowNumber: rows.indexOf(row) + 2,
              success: false,
              error: `Vendor ID ${row.vendor_id} (${vendor.name}) has vendor type "${vendor.vendor_type}" but row specifies "${row.vendor_type}"`,
            }, row, undefined, vendor))
            totalErrors++
            continue
          }
          if (vendor.org_id !== null && vendor.org_id !== firstRow.org_id) {
            results.push(enrichResult({
              rowNumber: rows.indexOf(row) + 2,
              success: false,
              error: `Vendor ID ${row.vendor_id} (${vendor.name}) belongs to organization ID ${vendor.org_id} but work order is for organization ID ${firstRow.org_id}`,
            }, row, undefined, vendor))
            totalErrors++
            continue
          }
        }
      }
      
      // Create maps for Option 1 processing
      if (vendors.length > 0) {
        for (const vendor of vendors) {
          if (!vendorTypeToVendors.has(vendor.vendor_type)) {
            vendorTypeToVendors.set(vendor.vendor_type, [])
          }
          vendorTypeToVendors.get(vendor.vendor_type)!.push(vendor)
        }
        vendorIdToVendor = new Map(vendors.map(v => [v.id, v]))
      
        // Get all plants with matching vendor_plant_ids and vendor_ids (Option 1)
        const vendorPlantIds = option1Rows.map(r => r.vendor_plant_id!).filter(id => id)
        const vendorIds = vendors.map(v => v.id)
        
        if (vendorPlantIds.length > 0 && vendorIds.length > 0) {
      const { data: plants, error: plantsError } = await supabase
        .from("plants")
        .select("id, org_id, vendor_id, vendor_plant_id, name")
        .in("vendor_plant_id", vendorPlantIds)
        .in("vendor_id", vendorIds)
            .eq("org_id", firstRow.org_id) // Ensure plants belong to the work order's org

      if (plantsError) {
            for (const row of option1Rows) {
              results.push(enrichResult({
                rowNumber: rows.indexOf(row) + 2,
                success: false,
                error: "Failed to validate plants",
              }, row))
              totalErrors++
            }
          } else {
            option1Plants = plants || []
          }
        }
      }

      // Match plants - handle both Option 1 (vendor_id + vendor_plant_id) and Option 2 (plant_id)
      const matchedPlants: Array<{ row: ImportRow; plant: any; vendor: any }> = []
      const unmatchedRows: ImportRow[] = []

      // Process Option 2 rows (plant_id - simpler, direct lookup)
      for (const row of option2Rows) {
        const plant = option2Plants.find((p: any) => p.id === row.plant_id)
        
        if (!plant) {
          results.push(enrichResult({
            rowNumber: rows.indexOf(row) + 2,
            success: false,
            error: `Plant ID ${row.plant_id} not found or does not belong to organization ID ${firstRow.org_id}`,
          }, row))
          totalErrors++
        continue
      }

        // Get vendor for this plant
        const vendor = vendorIdToVendor.get(plant.vendor_id) || vendors.find((v: any) => v.id === plant.vendor_id)
        
        if (!vendor) {
          // Fetch vendor if not already loaded
          const { data: vendorData } = await supabase
            .from("vendors")
            .select("id, name, vendor_type, org_id")
            .eq("id", plant.vendor_id)
            .single()
          
          if (vendorData) {
            matchedPlants.push({ row, plant, vendor: vendorData })
          } else {
            results.push(enrichResult({
              rowNumber: rows.indexOf(row) + 2,
              success: false,
              error: `Vendor for plant ID ${row.plant_id} not found`,
            }, row, plant))
            totalErrors++
          }
        } else {
          matchedPlants.push({ row, plant, vendor })
        }
      }

      // Process Option 1 rows (vendor_id + vendor_plant_id)
      for (const row of option1Rows) {
        let vendor: any = null
        
        // If vendor_id is specified, use it directly
        if (row.vendor_id) {
          vendor = vendorIdToVendor.get(row.vendor_id)
          if (!vendor) {
            unmatchedRows.push(row)
            continue
          }
        } else if (row.vendor_type) {
          // Otherwise, find vendor by vendor_type
          const vendorsOfType = vendorTypeToVendors.get(row.vendor_type)
          if (!vendorsOfType || vendorsOfType.length === 0) {
            unmatchedRows.push(row)
            continue
          }
          
          // If only one vendor of this type, use it
          if (vendorsOfType.length === 1) {
            vendor = vendorsOfType[0]
          } else {
            // Multiple vendors of same type - we'll need to match by plant's vendor_id
            // Try to find plant first, then get its vendor
            const potentialPlant = option1Plants.find(
              (p: any) => p.vendor_plant_id === row.vendor_plant_id
            )
            if (potentialPlant) {
              vendor = vendorIdToVendor.get(potentialPlant.vendor_id)
            } else {
              // Can't determine which vendor without finding the plant first
              unmatchedRows.push(row)
              continue
            }
          }
        } else {
          unmatchedRows.push(row)
          continue
        }
        
        if (!vendor) {
          unmatchedRows.push(row)
          continue
        }
        
        // Verify vendor belongs to correct org (or is global)
        if (vendor.org_id !== null && vendor.org_id !== firstRow.org_id) {
          results.push(enrichResult({
            rowNumber: rows.indexOf(row) + 2,
            success: false,
            error: `Vendor "${vendor.name}" (ID: ${vendor.id}) belongs to organization ID ${vendor.org_id} but work order is for organization ID ${firstRow.org_id}`,
          }, row, undefined, vendor))
          totalErrors++
          continue
        }
        
        // Find plant by vendor_plant_id and vendor_id
        const plant = option1Plants.find(
          (p: any) => 
            p.vendor_plant_id === row.vendor_plant_id && 
            p.vendor_id === vendor.id
        )
        
        if (plant) {
          // Verify plant's vendor belongs to correct org
          if (plant.org_id !== firstRow.org_id) {
            results.push(enrichResult({
              rowNumber: rows.indexOf(row) + 2,
              success: false,
              error: `Plant "${plant.name}" (Vendor Plant ID: ${row.vendor_plant_id}) belongs to organization ID ${plant.org_id} but work order is for organization ID ${firstRow.org_id}`,
            }, row, plant, vendor))
            totalErrors++
            continue
          }
          
          matchedPlants.push({ row, plant, vendor })
        } else {
          unmatchedRows.push(row)
        }
      }

      if (unmatchedRows.length > 0) {
        for (const row of unmatchedRows) {
          if (row.plant_id) {
            // Option 2 row that failed - already handled above
            results.push(enrichResult({
              rowNumber: rows.indexOf(row) + 2,
              success: false,
              error: `Plant ID ${row.plant_id} not found or does not belong to organization ID ${firstRow.org_id}`,
            }, row))
          } else if (row.vendor_type) {
            // Option 1 row that failed
            const vendorsOfType = vendorTypeToVendors.get(row.vendor_type)
            if (!vendorsOfType || vendorsOfType.length === 0) {
              results.push(enrichResult({
                rowNumber: rows.indexOf(row) + 2,
                success: false,
                error: `Vendor type "${row.vendor_type}" not found for organization ID ${firstRow.org_id} or as a global vendor`,
              }, row))
            } else {
              // Vendor type exists but plant not found
              const vendorNames = vendorsOfType.map((v: any) => v.name).join(", ")
              results.push(enrichResult({
                rowNumber: rows.indexOf(row) + 2,
                success: false,
                error: `Plant not found: Vendor Plant ID "${row.vendor_plant_id || 'N/A'}" for vendor type "${row.vendor_type}" (vendors: ${vendorNames})`,
              }, row, undefined, vendorsOfType[0]))
            }
          } else {
            // Missing required fields
            results.push(enrichResult({
              rowNumber: rows.indexOf(row) + 2,
              success: false,
              error: "Missing required fields: either (Plant ID) or (Vendor ID + Vendor Plant ID) must be provided",
            }, row))
          }
          totalErrors++
        }
      }

      if (matchedPlants.length === 0) {
        continue
      }

      const plantIds = matchedPlants.map(mp => mp.plant.id)
      const validatedPlants = matchedPlants.map(mp => mp.plant)
      const validatedVendors = matchedPlants.map(mp => mp.vendor)

      // Verify all plants belong to the same org (already checked during matching, but double-check)
      const plantOrgIds = [...new Set(validatedPlants.map(p => p.org_id))]
      if (plantOrgIds.length > 1 || plantOrgIds[0] !== firstRow.org_id) {
        for (const matched of matchedPlants) {
          results.push(enrichResult({
            rowNumber: rows.indexOf(matched.row) + 2,
            success: false,
            error: "All plants must belong to the same organization as the work order",
          }, matched.row, matched.plant, matched.vendor))
          totalErrors++
        }
        continue
      }

      // Verify all vendors belong to the same org (or are global vendors)
      const vendorOrgIds = [...new Set(validatedVendors.map(v => v.org_id).filter(id => id !== null))]
      if (vendorOrgIds.length > 1 || (vendorOrgIds.length === 1 && vendorOrgIds[0] !== firstRow.org_id)) {
        for (const matched of matchedPlants) {
          results.push(enrichResult({
            rowNumber: rows.indexOf(matched.row) + 2,
            success: false,
            error: `Vendor "${matched.vendor.name}" belongs to organization ID ${matched.vendor.org_id} but work order is for organization ID ${firstRow.org_id}`,
          }, matched.row, matched.plant, matched.vendor))
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
          results.push(enrichResult({
            rowNumber: rows.indexOf(row) + 2,
            workOrderId: existingWorkOrder.id,
            success: false,
            error: "Work order already exists (no updates allowed)",
          }, row))
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
            results.push(enrichResult({
              rowNumber: rows.indexOf(matched.row) + 2,
              success: false,
              error: `Plant (Vendor Plant ID: ${matched.row.vendor_plant_id || matched.plant.vendor_plant_id}, Vendor Type: ${matched.row.vendor_type || matched.vendor.vendor_type}) is already mapped to work order ${plantsInOtherWorkOrders.get(matched.plant.id)}`,
            }, matched.row, matched.plant, matched.vendor))
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
            results.push(enrichResult({
              rowNumber: rows.indexOf(matched.row) + 2,
              success: false,
              error: `Failed to create work order: ${woError?.message || "Unknown error"}`,
            }, matched.row, matched.plant, matched.vendor))
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
            results.push(enrichResult({
              rowNumber: rows.indexOf(matched.row) + 2,
              workOrderId: newWorkOrder.id,
              success: false,
              error: `Failed to create plant mapping: ${plantError.message}`,
            }, matched.row, matched.plant, matched.vendor))
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
            title: matched.row.title,
            orgId: matched.row.org_id,
            orgName: matched.row.org_name,
            plantId: matched.plant.id,
            vendorPlantId: matched.plant.vendor_plant_id,
            plantName: matched.plant.name,
            vendorId: matched.vendor.id,
            vendorName: matched.vendor.name,
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

    // Prepare results data for JSON response
    const allResults: any[] = []
    
    // Process all results - use enriched result data (already includes row, plant, vendor info)
    for (const result of results) {
      allResults.push({
        row_number: result.rowNumber,
        status: result.success ? "SUCCESS" : "FAILED",
        title: result.title || "",
        org_id: result.orgId || "",
        org_name: result.orgName || "",
        plant_id: result.plantId || "",
        vendor_plant_id: result.vendorPlantId || "",
        plant_name: result.plantName || "",
        vendor_id: result.vendorId || "",
        vendor_name: result.vendorName || "",
        work_order_id: result.workOrderId || "",
        error_message: result.error || "",
      })
    }

    // Sort by row number
    allResults.sort((a, b) => a.row_number - b.row_number)

    // Return JSON response with import results
    return NextResponse.json({
      summary: {
        totalRows: rows.length,
        processed: totalProcessed,
        errors: totalErrors,
      },
      results: allResults,
    })
  } catch (error: any) {
    console.error("Work orders import error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

