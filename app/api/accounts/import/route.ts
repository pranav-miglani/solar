import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import bcrypt from "bcryptjs"
import { getMainClient } from "@/lib/supabase/pooled"
import ExcelJS from "exceljs"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

interface ImportRow {
  account_id?: string
  email: string
  password: string
  account_type: string
  org_id?: number
  display_name?: string
  logo_url?: string
  is_active?: boolean
}

interface ImportResult {
  rowNumber: number
  accountId?: string
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

    // Only SUPERADMIN and DEVELOPER can import accounts
    if (accountType !== "SUPERADMIN" && accountType !== "DEVELOPER") {
      return NextResponse.json(
        { error: "Only SUPERADMIN and DEVELOPER can import accounts" },
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
          account_id: rowData["Account ID"]?.toString() || undefined,
          email: rowData["Email"]?.toString() || "",
          password: rowData["Password"]?.toString() || "",
          account_type: rowData["Account Type"]?.toString() || "",
          org_id: rowData["Organization ID"] ? parseInt(rowData["Organization ID"]) : undefined,
          display_name: rowData["Display Name"]?.toString() || undefined,
          logo_url: rowData["Logo URL"]?.toString() || undefined,
          is_active: rowData["Is Active"]?.toString().toLowerCase() === "yes" || rowData["Is Active"] === true,
        }
        
        // Only add rows with required fields: email, password, account_type
        if (importRow.email && importRow.password && importRow.account_type) {
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
        // Validate account_type
        if (!["SUPERADMIN", "ORG", "GOVT"].includes(row.account_type)) {
          results.push({
            rowNumber: rows.indexOf(row) + 2,
            success: false,
            error: `Invalid account_type: ${row.account_type}. Must be SUPERADMIN, ORG, or GOVT. DEVELOPER accounts cannot be created via import.`,
          })
          totalErrors++
          continue
        }

        // Validate org_id for ORG accounts
        if (row.account_type === "ORG" && !row.org_id) {
          results.push({
            rowNumber: rows.indexOf(row) + 2,
            success: false,
            error: "org_id is required for ORG accounts",
          })
          totalErrors++
          continue
        }

        // Validate org_id is null for SUPERADMIN and GOVT
        if ((row.account_type === "SUPERADMIN" || row.account_type === "GOVT") && row.org_id) {
          results.push({
            rowNumber: rows.indexOf(row) + 2,
            success: false,
            error: "org_id must be null for SUPERADMIN and GOVT accounts",
          })
          totalErrors++
          continue
        }

        // Validate organization exists for ORG accounts
        if (row.account_type === "ORG" && row.org_id) {
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
        }

        // Check if account already exists (by email or account_id if provided)
        if (row.account_id) {
          const { data: existingAccount } = await supabase
            .from("accounts")
            .select("id")
            .eq("id", row.account_id)
            .single()

          if (existingAccount) {
            results.push({
              rowNumber: rows.indexOf(row) + 2,
              success: false,
              error: `Account ID ${row.account_id} already exists (import does not update existing accounts)`,
            })
            totalErrors++
            continue
          }
        }

        // Check for duplicate email
        const { data: duplicateAccount } = await supabase
          .from("accounts")
          .select("id")
          .eq("email", row.email)
          .single()

        if (duplicateAccount) {
          results.push({
            rowNumber: rows.indexOf(row) + 2,
            success: false,
            error: `Account with email "${row.email}" already exists`,
          })
          totalErrors++
          continue
        }

        // For ORG accounts, check if org already has an account
        if (row.account_type === "ORG" && row.org_id) {
          const { data: existingOrgAccount } = await supabase
            .from("accounts")
            .select("id")
            .eq("org_id", row.org_id)
            .eq("account_type", "ORG")
            .single()

          if (existingOrgAccount) {
            results.push({
              rowNumber: rows.indexOf(row) + 2,
              success: false,
              error: `Organization ID ${row.org_id} already has an account`,
            })
            totalErrors++
            continue
          }
        }

        // Hash password before storing
        const passwordHash = await bcrypt.hash(row.password, 10)

        // Create account
        const { data: account, error: insertError } = await supabase
          .from("accounts")
          .insert({
            email: row.email,
            password_hash: passwordHash,
            account_type: row.account_type,
            org_id: row.account_type === "ORG" ? row.org_id : null,
            display_name: row.display_name || null,
            logo_url: row.logo_url || null,
            is_active: row.is_active ?? true,
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
            accountId: account.id,
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
    console.error("Accounts import error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

