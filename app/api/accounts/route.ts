import { NextRequest, NextResponse } from "next/server"
import { getServiceClient } from "@/lib/supabase/serviceClient"
import { requirePermission } from "@/lib/rbac"
import bcrypt from "bcryptjs"


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

    // Only SUPERADMIN can view all accounts
    requirePermission(accountType as any, "accounts", "read")

    // Use service role client to bypass RLS
    const supabase = getServiceClient()

    const { data: accounts, error } = await supabase
      .from("accounts")
      .select("id, email, account_type, org_id, created_at")
      .order("email")

    if (error) {
      console.error("Accounts query error:", error)
      return NextResponse.json(
        { error: "Failed to fetch accounts" },
        { status: 500 }
      )
    }

    return NextResponse.json({ accounts: accounts || [] })
  } catch (error: any) {
    console.error("Accounts error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 403 }
    )
  }
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

    // Only SUPERADMIN can create accounts
    if (accountType !== "SUPERADMIN") {
      return NextResponse.json(
        { error: "Only SUPERADMIN can create accounts" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, password, account_type, org_id } = body

    if (!email || !password || !account_type) {
      return NextResponse.json(
        { error: "Email, password, and account_type are required" },
        { status: 400 }
      )
    }

    // Validate account_type
    if (!["SUPERADMIN", "ORG", "GOVT"].includes(account_type)) {
      return NextResponse.json(
        { error: "Invalid account_type. Must be SUPERADMIN, ORG, or GOVT" },
        { status: 400 }
      )
    }

    // Validate org_id for ORG accounts
    if (account_type === "ORG" && !org_id) {
      return NextResponse.json(
        { error: "org_id is required for ORG accounts" },
        { status: 400 }
      )
    }

    // Validate org_id is null for SUPERADMIN and GOVT
    if ((account_type === "SUPERADMIN" || account_type === "GOVT") && org_id) {
      return NextResponse.json(
        { error: "org_id must be null for SUPERADMIN and GOVT accounts" },
        { status: 400 }
      )
    }

    // Hash password before storing
    const passwordHash = await bcrypt.hash(password, 10)

    // Use service role client to bypass RLS
    const supabase = getServiceClient()

    // Check if account already exists
    const { data: existingAccount } = await supabase
      .from("accounts")
      .select("id")
      .eq("email", email)
      .single()

    if (existingAccount) {
      return NextResponse.json(
        { error: "Account with this email already exists" },
        { status: 409 }
      )
    }

    // For ORG accounts, check if org already has an account
    if (account_type === "ORG" && org_id) {
      const { data: existingOrgAccount } = await supabase
        .from("accounts")
        .select("id")
        .eq("org_id", org_id)
        .eq("account_type", "ORG")
        .single()

      if (existingOrgAccount) {
        return NextResponse.json(
          { error: "This organization already has an account" },
          { status: 409 }
        )
      }
    }

    const { data: account, error } = await supabase
      .from("accounts")
      .insert({
        email,
        password_hash: passwordHash,
        account_type,
        org_id: account_type === "ORG" ? org_id : null,
      })
      .select("id, email, account_type, org_id, created_at")
      .single()

    if (error) {
      console.error("Account creation error:", error)
      return NextResponse.json(
        { error: "Failed to create account", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ account }, { status: 201 })
  } catch (error: any) {
    console.error("Account creation error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

