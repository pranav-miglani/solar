import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import bcrypt from "bcryptjs"
import { getAccountsRepository } from "@/lib/repositories/main"
import { logApiRequest, logApiResponse, withMDCContext } from "@/lib/api-logger"

// For accounts API, we need to bypass RLS for write operations

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  return withMDCContext(request, async () => {
    logApiRequest(request)
    
    try {
      const session = request.cookies.get("session")?.value

      if (!session) {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      let sessionData
      try {
        sessionData = JSON.parse(Buffer.from(session, "base64").toString())
      } catch {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Invalid session" }, { status: 401 })
      }

      const accountType = sessionData.accountType as string

      // Only SUPERADMIN can view all accounts
      requirePermission(accountType as any, "accounts", "read")

      // Fetch accounts using repository
      const accountsRepo = getAccountsRepository()
      const accounts = await accountsRepo.findAll()

      logApiResponse(request, 200, Date.now() - startTime)
      return NextResponse.json({ accounts })
    } catch (error: any) {
      console.error("Accounts error:", error)
      logApiResponse(request, 403, Date.now() - startTime, error)
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 403 }
      )
    }
  })
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  return withMDCContext(request, async () => {
    logApiRequest(request)
    
    try {
      const session = request.cookies.get("session")?.value

      if (!session) {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      let sessionData
      try {
        sessionData = JSON.parse(Buffer.from(session, "base64").toString())
      } catch {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Invalid session" }, { status: 401 })
      }

      const accountType = sessionData.accountType as string

      // SUPERADMIN and DEVELOPER can create accounts
      if (accountType !== "SUPERADMIN" && accountType !== "DEVELOPER") {
        logApiResponse(request, 403, Date.now() - startTime)
        return NextResponse.json(
          { error: "Only SUPERADMIN and DEVELOPER can create accounts" },
          { status: 403 }
        )
      }

      const body = await request.json()
      const { email, password, account_type, org_id, display_name } = body

      if (!email || !password || !account_type) {
        logApiResponse(request, 400, Date.now() - startTime)
        return NextResponse.json(
          { error: "Email, password, and account_type are required" },
          { status: 400 }
        )
      }

      // Validate account_type - DEVELOPER accounts cannot be created via UI
      if (!["SUPERADMIN", "ORG", "GOVT"].includes(account_type)) {
        logApiResponse(request, 400, Date.now() - startTime)
        return NextResponse.json(
          { error: "Invalid account_type. Must be SUPERADMIN, ORG, or GOVT. DEVELOPER accounts must be created via script." },
          { status: 400 }
        )
      }
      
      // Explicitly reject DEVELOPER account creation from UI
      if (account_type === "DEVELOPER") {
        logApiResponse(request, 403, Date.now() - startTime)
        return NextResponse.json(
          { error: "DEVELOPER accounts cannot be created via UI. Use the create-developer-account script instead." },
          { status: 403 }
        )
      }

      // Validate org_id for ORG accounts
      if (account_type === "ORG" && !org_id) {
        logApiResponse(request, 400, Date.now() - startTime)
        return NextResponse.json(
          { error: "org_id is required for ORG accounts" },
          { status: 400 }
        )
      }

      // Validate org_id is null for SUPERADMIN, GOVT, and DEVELOPER
      if ((account_type === "SUPERADMIN" || account_type === "GOVT" || account_type === "DEVELOPER") && org_id) {
        logApiResponse(request, 400, Date.now() - startTime)
        return NextResponse.json(
          { error: "org_id must be null for SUPERADMIN, GOVT, and DEVELOPER accounts" },
          { status: 400 }
        )
      }

      // Hash password before storing
      const passwordHash = await bcrypt.hash(password, 10)

      // Use repository for account operations
      const accountsRepo = getAccountsRepository()

      // Check if account already exists
      const existingAccount = await accountsRepo.findByEmail(email)

      if (existingAccount) {
        logApiResponse(request, 409, Date.now() - startTime, { email })
        return NextResponse.json(
          { error: "Account with this email already exists" },
          { status: 409 }
        )
      }

      // For ORG accounts, check if org already has an account
      if (account_type === "ORG" && org_id) {
        const existingOrgAccount = await accountsRepo.existsByOrgId(org_id)

        if (existingOrgAccount) {
          logApiResponse(request, 409, Date.now() - startTime, { org_id })
          return NextResponse.json(
            { error: "This organization already has an account" },
            { status: 409 }
          )
        }
      }

      // Save account using repository
      const account = await accountsRepo.save({
        email,
        password_hash: passwordHash,
        account_type,
        org_id: account_type === "ORG" ? org_id : null,
        display_name: display_name || null,
      })

      logApiResponse(request, 201, Date.now() - startTime, { accountId: account.id, email: account.email })
      return NextResponse.json({ account }, { status: 201 })
    } catch (error: any) {
      console.error("Account creation error:", error)
      logApiResponse(request, 500, Date.now() - startTime, error)
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      )
    }
  })
}

