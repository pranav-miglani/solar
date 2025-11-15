import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// For /api/me, we need to bypass RLS to verify the account exists
// We use service role key since RLS policies require auth.uid() which we don't have
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase service role key")
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function GET(request: NextRequest) {
  try {
    const session = request.cookies.get("session")?.value

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Decode session
    let sessionData
    try {
      sessionData = JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    // Verify session has required data
    if (!sessionData.accountId || !sessionData.accountType) {
      return NextResponse.json({ error: "Invalid session data" }, { status: 401 })
    }

    // Use service role client to bypass RLS and verify account exists
    const supabase = createServiceClient()
    
    // Get account to verify it still exists
    const { data: account, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", sessionData.accountId)
      .single()

    if (error || !account) {
      console.error("❌ [ME] Account not found:", error)
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    // Return account data from session (faster) but verified against DB
    return NextResponse.json({
      account: {
        id: account.id,
        email: account.email,
        accountType: account.account_type,
        orgId: account.org_id,
      },
    })
  } catch (error) {
    console.error("❌ [ME] Get me error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

