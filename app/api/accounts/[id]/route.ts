import { NextRequest, NextResponse } from "next/server"
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
      const { display_name } = body

      const supabase = getMainClient()

      const { data, error } = await supabase
        .from("accounts")
        .update({ display_name: display_name || null })
        .eq("id", accountId)
        .select("id, email, account_type, org_id, created_at, display_name")
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


