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

    // Only SUPERADMIN and DEVELOPER can export accounts
    if (accountType !== "SUPERADMIN" && accountType !== "DEVELOPER") {
      return NextResponse.json(
        { error: "Only SUPERADMIN and DEVELOPER can export accounts" },
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
      .from("accounts")
      .select(`
        id,
        email,
        account_type,
        org_id,
        display_name,
        logo_url,
        is_active,
        created_at,
        organizations(id, name)
      `)
      .order("email")

    // Filter by organization if orgId query parameter is provided
    if (targetOrgId) {
      query = query.eq("org_id", targetOrgId)
    }

    const { data: accounts, error } = await query

    if (error) {
      console.error("Accounts query error:", error)
      return NextResponse.json(
        { error: "Failed to fetch accounts" },
        { status: 500 }
      )
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Accounts")

    // Define columns
    worksheet.columns = [
      { header: "Account ID", key: "account_id", width: 20 },
      { header: "Email", key: "email", width: 40 },
      { header: "Password", key: "password", width: 30 },
      { header: "Account Type", key: "account_type", width: 20 },
      { header: "Organization ID", key: "org_id", width: 15 },
      { header: "Organization Name", key: "org_name", width: 30 },
      { header: "Display Name", key: "display_name", width: 30 },
      { header: "Logo URL", key: "logo_url", width: 50 },
      { header: "Is Active", key: "is_active", width: 12 },
      { header: "Created At", key: "created_at", width: 20 },
    ]

    // Style header row
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }

    // Add data rows
    if (accounts && accounts.length > 0) {
      for (const account of accounts) {
        const orgName = (account.organizations as any)?.name || ""
        
        worksheet.addRow({
          account_id: account.id,
          email: account.email,
          password: "", // Password is not exported for security
          account_type: account.account_type,
          org_id: account.org_id || "",
          org_name: orgName,
          display_name: account.display_name || "",
          logo_url: account.logo_url || "",
          is_active: account.is_active ? "Yes" : "No",
          created_at: account.created_at ? new Date(account.created_at).toISOString() : "",
        })
      }
    }

    // Generate Excel file buffer
    const buffer = await workbook.xlsx.writeBuffer()

    // Return Excel file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="accounts_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error("Accounts export error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

