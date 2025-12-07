import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import ExcelJS from "exceljs"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

interface ImportRow {
  vendor_id?: number
  name: string
  vendor_type: string
  org_id: number
  is_active?: boolean
  credentials: string // JSON string
  plant_sync_mode?: string
  per_plant_sync_interval_minutes?: number
  plant_sync_time_ist?: string
  telemetry_sync_mode?: string
  telemetry_sync_interval?: number
}

interface ImportResult {
  rowNumber: number
  vendorId?: number
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

    // Only SUPERADMIN and DEVELOPER can import vendors
    if (accountType !== "SUPERADMIN" && accountType !== "DEVELOPER") {
      return NextResponse.json(
        { error: "Only SUPERADMIN and DEVELOPER can import vendors" },
        { status: 403 }
      )
    }

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
          vendor_id: rowData["Vendor ID"] ? parseInt(rowData["Vendor ID"]) : undefined,
          name: rowData["Name"]?.toString() || "",
          vendor_type: rowData["Vendor Type"]?.toString() || "",
          org_id: rowData["Organization ID"] ? parseInt(rowData["Organization ID"]) : 0,
          is_active: rowData["Is Active"]?.toString().toLowerCase() === "yes" || rowData["Is Active"] === true,
          credentials: rowData["Credentials (JSON)"]?.toString() || "{}",
          plant_sync_mode: rowData["Plant Sync Mode"]?.toString() || undefined,
          per_plant_sync_interval_minutes: rowData["Per Plant Sync Interval (minutes)"] ? parseInt(rowData["Per Plant Sync Interval (minutes)"]) : undefined,
          plant_sync_time_ist: rowData["Plant Sync Time (IST)"]?.toString() || undefined,
          telemetry_sync_mode: rowData["Telemetry Sync Mode"]?.toString() || undefined,
          telemetry_sync_interval: rowData["Telemetry Sync Interval (minutes)"] ? parseInt(rowData["Telemetry Sync Interval (minutes)"]) : undefined,
        }
        
        // Only add rows with required fields: name, vendor_type, org_id
        if (importRow.name && importRow.vendor_type && importRow.org_id) {
          rows.push(importRow)
        }
      }
    })

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows found in Excel file" },
        { status: 400 }
      )
    }

    // Use service role client to bypass RLS
    const supabase = getMainClient()

    const results: ImportResult[] = []
    let totalProcessed = 0
    let totalCreated = 0
    let totalErrors = 0

    // Process each row
    for (const row of rows) {
      totalProcessed++

      try {
        // Validate organization exists
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .select("id")
          .eq("id", row.org_id)
          .single()

        if (orgError || !org) {
          results.push({
            rowNumber: rows.indexOf(row) + 2,
            success: false,
            error: `Organization ID ${row.org_id} not found`,
          })
          totalErrors++
          continue
        }

        // Parse credentials JSON
        let credentials: Record<string, any> = {}
        try {
          credentials = JSON.parse(row.credentials)
        } catch (parseError) {
          results.push({
            rowNumber: rows.indexOf(row) + 2,
            success: false,
            error: `Invalid credentials JSON: ${row.credentials}`,
          })
          totalErrors++
          continue
        }

        // Check if vendor already exists (by name and org_id, or by vendor_id if provided)
        if (row.vendor_id) {
          const { data: existingVendor } = await supabase
            .from("vendors")
            .select("id")
            .eq("id", row.vendor_id)
            .single()

          if (existingVendor) {
            results.push({
              rowNumber: rows.indexOf(row) + 2,
              success: false,
              error: `Vendor ID ${row.vendor_id} already exists (import does not update existing vendors)`,
            })
            totalErrors++
            continue
          }
        }

        // Check for duplicate name + org_id combination
        const { data: duplicateVendor } = await supabase
          .from("vendors")
          .select("id")
          .eq("name", row.name)
          .eq("org_id", row.org_id)
          .single()

        if (duplicateVendor) {
          results.push({
            rowNumber: rows.indexOf(row) + 2,
            success: false,
            error: `Vendor "${row.name}" already exists for organization ID ${row.org_id}`,
          })
          totalErrors++
          continue
        }

        // Create vendor
        const { data: vendor, error: insertError } = await supabase
          .from("vendors")
          .insert({
            name: row.name,
            vendor_type: row.vendor_type,
            credentials,
            is_active: row.is_active ?? true,
            org_id: row.org_id,
            plant_sync_mode: row.plant_sync_mode || null,
            per_plant_sync_interval_minutes: row.per_plant_sync_interval_minutes ?? 15,
            plant_sync_time_ist: row.plant_sync_time_ist || '02:00',
            telemetry_sync_mode: row.telemetry_sync_mode || 'LIST_PLANTS',
            telemetry_sync_interval: row.telemetry_sync_interval ?? 15,
          })
          .select()
          .single()

        if (insertError) {
          results.push({
            rowNumber: rows.indexOf(row) + 2,
            success: false,
            error: insertError.message,
          })
          totalErrors++
        } else {
          results.push({
            rowNumber: rows.indexOf(row) + 2,
            vendorId: vendor.id,
            success: true,
          })
          totalCreated++
        }
      } catch (error: any) {
        results.push({
          rowNumber: rows.indexOf(row) + 2,
          success: false,
          error: error.message || "Unknown error",
        })
        totalErrors++
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalProcessed,
        totalCreated,
        totalErrors,
      },
      results: results.slice(0, 100), // Limit to first 100 results for response size
    })
  } catch (error: any) {
    console.error("Vendors import error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

