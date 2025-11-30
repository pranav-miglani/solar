import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getMainClient } from "@/lib/supabase/pooled"
import { logApiRequest, logApiResponse, withMDCContext } from "@/lib/api-logger"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = "force-dynamic"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

      // Only SUPERADMIN can update accounts (e.g., display names)
      if (accountType !== "SUPERADMIN") {
        logApiResponse(request, 403, Date.now() - startTime)
        return NextResponse.json(
          { error: "Only SUPERADMIN can update accounts" },
          { status: 403 }
        )
      }

      const accountId = params.id

      if (!accountId) {
        logApiResponse(request, 400, Date.now() - startTime)
        return NextResponse.json(
          { error: "Account id is required" },
          { status: 400 }
        )
      }

      const body = await request.json()
      const { email, password, display_name, logo_url, is_active } = body

      const supabase = getMainClient()

      const updateData: any = {}
      if (email !== undefined) {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (email && !emailRegex.test(email)) {
          logApiResponse(request, 400, Date.now() - startTime)
          return NextResponse.json(
            { error: "Invalid email format" },
            { status: 400 }
          )
        }
        
        // Check if email is already taken by another account
        if (email) {
          const { data: existingAccount } = await supabase
            .from("accounts")
            .select("id")
            .eq("email", email)
            .neq("id", accountId)
            .single()

          if (existingAccount) {
            logApiResponse(request, 409, Date.now() - startTime, { email })
            return NextResponse.json(
              { error: "Email already in use by another account" },
              { status: 409 }
            )
          }
        }
        
        updateData.email = email || null
      }
      if (display_name !== undefined) {
        updateData.display_name = display_name || null
      }
      if (logo_url !== undefined) {
        updateData.logo_url = logo_url || null
      }
      if (password !== undefined && password !== null && password !== "") {
        // Hash password before storing
        updateData.password_hash = await bcrypt.hash(password, 10)
      }
      if (is_active !== undefined) {
        updateData.is_active = is_active !== false // Ensure boolean
      }

      const { data, error } = await supabase
        .from("accounts")
        .update(updateData)
        .eq("id", accountId)
        .select("id, email, account_type, org_id, created_at, display_name, logo_url, is_active")
        .single()

      if (error) {
        console.error("Account update error:", error)
        logApiResponse(request, 500, Date.now() - startTime, error)
        return NextResponse.json(
          { error: "Failed to update account", details: error.message },
          { status: 500 }
        )
      }

      logApiResponse(request, 200, Date.now() - startTime, { accountId })
      return NextResponse.json({ account: data })
    } catch (error: any) {
      console.error("Account update error:", error)
      logApiResponse(request, 500, Date.now() - startTime, error)
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      )
    }
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

      // Only SUPERADMIN can delete accounts (including GOVT users)
      if (accountType !== "SUPERADMIN") {
        logApiResponse(request, 403, Date.now() - startTime)
        return NextResponse.json(
          { error: "Only SUPERADMIN can delete accounts" },
          { status: 403 }
        )
      }

      const accountId = params.id

      if (!accountId) {
        logApiResponse(request, 400, Date.now() - startTime)
        return NextResponse.json(
          { error: "Account id is required" },
          { status: 400 }
        )
      }

      const supabase = getMainClient()

      const { error } = await supabase
        .from("accounts")
        .delete()
        .eq("id", accountId)

      if (error) {
        console.error("Account delete error:", error)
        logApiResponse(request, 500, Date.now() - startTime, error)
        return NextResponse.json(
          { error: "Failed to delete account", details: error.message },
          { status: 500 }
        )
      }

      logApiResponse(request, 200, Date.now() - startTime, { accountId })
      return NextResponse.json({ success: true })
    } catch (error: any) {
      console.error("Account delete error:", error)
      logApiResponse(request, 500, Date.now() - startTime, error)
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 500 }
      )
    }
  })
}


