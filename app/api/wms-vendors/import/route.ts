import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import ExcelJS from "exceljs"

/**
 * POST /api/wms-vendors/import
 * Import WMS vendors from Excel file
 * Only SUPERADMIN and DEVELOPER can import
 */

export const dynamic = 'force-dynamic'

interface ImportRow {
  wms_vendor_id?: number
  name: string
  vendor_type: string
  org_id: number
  is_active?: boolean
  credentials: string // JSON string
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

    // Only SUPERADMIN and DEVELOPER can import WMS vendors
    requirePermission(accountType as any, "wms_vendors", "create")

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
            rowData[header.toLowerCase().replace(/\s+/g, '_')] = cell.value
          }
        })
        
        // Map headers to ImportRow fields
        const importRow: ImportRow = {
          wms_vendor_id: rowData.wms_vendor_id ? parseInt(rowData.wms_vendor_id) : undefined,
          name: rowData.name?.toString() || "",
          vendor_type: rowData.vendor_type?.toString() || "",
          org_id: rowData.org_id ? parseInt(rowData.org_id) : 0,
          is_active: rowData.is_active?.toString().toLowerCase() === "yes" || rowData.is_active === true,
          credentials: rowData.credentials?.toString() || "{}",
        }
        
        rows.push(importRow)
      }
    })

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No data rows found in Excel file" },
        { status: 400 }
      )
    }

    const supabase = getMainClient()
    const results: ImportResult[] = []

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2 // +2 because Excel rows are 1-indexed and we skip header

      try {
        // Validate required fields
        if (!row.name || !row.vendor_type || !row.org_id) {
          results.push({
            rowNumber,
            success: false,
            error: "Missing required fields: name, vendor_type, org_id",
          })
          continue
        }

        // Validate vendor_type
        if (row.vendor_type !== "INTELLO") {
          results.push({
            rowNumber,
            success: false,
            error: `Invalid vendor_type: ${row.vendor_type}. Only INTELLO is supported.`,
          })
          continue
        }

        // Validate organization exists
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .select("id")
          .eq("id", row.org_id)
          .single()

        if (orgError || !org) {
          results.push({
            rowNumber,
            success: false,
            error: `Organization with ID ${row.org_id} not found`,
          })
          continue
        }

        // Parse credentials JSON
        let credentials: Record<string, any>
        try {
          credentials = JSON.parse(row.credentials)
        } catch {
          results.push({
            rowNumber,
            success: false,
            error: "Invalid credentials JSON format",
          })
          continue
        }

        // Validate credentials structure (for INTELLO: email and password_hash)
        if (!credentials.email || !credentials.password_hash) {
          results.push({
            rowNumber,
            success: false,
            error: "Credentials must contain 'email' and 'password_hash' for INTELLO vendor",
          })
          continue
        }

        // Prepare vendor data
        const vendorData: any = {
          name: row.name,
          vendor_type: row.vendor_type,
          org_id: row.org_id,
          credentials: credentials,
          is_active: row.is_active !== undefined ? row.is_active : true,
        }

        if (row.wms_vendor_id) {
          // Update existing vendor
          const { data: existingVendor, error: checkError } = await supabase
            .from("wms_vendors")
            .select("id")
            .eq("id", row.wms_vendor_id)
            .single()

          if (checkError || !existingVendor) {
            results.push({
              rowNumber,
              success: false,
              error: `WMS vendor with ID ${row.wms_vendor_id} not found`,
            })
            continue
          }

          const { error: updateError } = await supabase
            .from("wms_vendors")
            .update(vendorData)
            .eq("id", row.wms_vendor_id)

          if (updateError) {
            results.push({
              rowNumber,
              success: false,
              error: updateError.message,
            })
            continue
          }

          results.push({
            rowNumber,
            vendorId: row.wms_vendor_id,
            success: true,
          })
        } else {
          // Insert new vendor
          const { data: newVendor, error: insertError } = await supabase
            .from("wms_vendors")
            .insert(vendorData)
            .select("id")
            .single()

          if (insertError) {
            results.push({
              rowNumber,
              success: false,
              error: insertError.message,
            })
            continue
          }

          results.push({
            rowNumber,
            vendorId: newVendor.id,
            success: true,
          })
        }
      } catch (error: any) {
        results.push({
          rowNumber,
          success: false,
          error: error.message || "Unknown error",
        })
      }
    }

    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        successful,
        failed,
      },
      results,
    })
  } catch (error: any) {
    console.error("WMS vendors import error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

