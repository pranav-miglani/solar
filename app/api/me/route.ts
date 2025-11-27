import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"
import { logApiRequest, logApiResponse, withMDCContext } from "@/lib/api-logger"

// For /api/me, we need to bypass RLS to verify the account exists
// We use service role key since RLS policies require auth.uid() which we don't have

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  return withMDCContext(request, async () => {
    logApiRequest(request)
    
    try {
      const session = request.cookies.get("session")?.value
      const allCookies = request.cookies.getAll()
      const cookieHeader = request.headers.get("cookie")
      
      console.log("🍪 [ME] Cookie check:", {
        hasSessionCookie: !!session,
        sessionCookieLength: session?.length || 0,
        sessionCookiePreview: session ? session.substring(0, 30) + "..." : null,
        allCookiesCount: allCookies.length,
        allCookiesNames: allCookies.map(c => c.name),
        cookieHeader: cookieHeader || "(no Cookie header)",
        cookieHeaderLength: cookieHeader?.length || 0,
        requestUrl: request.url,
        requestOrigin: request.headers.get("origin"),
        requestHost: request.headers.get("host"),
      })

      if (!session) {
        console.log("❌ [ME] No session cookie found")
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      // Decode session
      let sessionData
      try {
        sessionData = JSON.parse(Buffer.from(session, "base64").toString())
        console.log("✅ [ME] Session decoded successfully:", {
          accountId: sessionData.accountId,
          accountType: sessionData.accountType,
          email: sessionData.email,
          orgId: sessionData.orgId,
        })
      } catch (error) {
        console.log("❌ [ME] Failed to decode session:", {
          error: error instanceof Error ? error.message : String(error),
          sessionPreview: session.substring(0, 50),
        })
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Invalid session" }, { status: 401 })
      }

      // Verify session has required data
      if (!sessionData.accountId || !sessionData.accountType) {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Invalid session data" }, { status: 401 })
      }

      // Use service role client to bypass RLS and verify account exists
      const supabase = getMainClient()
      
      // Get account to verify it still exists
      const { data: account, error } = await supabase
        .from("accounts")
        .select("id, email, account_type, org_id, display_name")
        .eq("id", sessionData.accountId)
        .single()

      if (error || !account) {
        console.error("❌ [ME] Account not found:", error)
        logApiResponse(request, 404, Date.now() - startTime, error)
        return NextResponse.json({ error: "Account not found" }, { status: 404 })
      }

      // Return account data from session (faster) but verified against DB
      logApiResponse(request, 200, Date.now() - startTime)
      return NextResponse.json({
        account: {
          id: account.id,
          email: account.email,
          accountType: account.account_type,
          orgId: account.org_id,
          displayName: account.display_name,
        },
      })
    } catch (error) {
      console.error("❌ [ME] Get me error:", error)
      logApiResponse(request, 500, Date.now() - startTime, error)
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    }
  })
}

