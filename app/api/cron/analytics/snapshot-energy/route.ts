import { NextRequest, NextResponse } from "next/server"
import { runAnalyticsSnapshot } from "@/lib/services/analyticsSnapshotService"

export const dynamic = "force-dynamic"

function checkAuth(request: NextRequest): { authorized: boolean; error?: string } {
  // Check CRON_SECRET first (for cron jobs)
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authHeader = request.headers.get("authorization") || ""
    const token = authHeader.replace("Bearer ", "")
    if (token === secret) {
      return { authorized: true }
    }
  }

  // Check session (for UI triggers)
  const session = request.cookies.get("session")?.value
  if (!session) {
    return { authorized: false, error: "Unauthorized" }
  }

  let sessionData
  try {
    sessionData = JSON.parse(Buffer.from(session, "base64").toString())
  } catch {
    return { authorized: false, error: "Invalid session" }
  }

  const accountType = sessionData.accountType as string
  // Only SUPERADMIN and DEVELOPER can trigger
  if (accountType !== "SUPERADMIN" && accountType !== "DEVELOPER") {
    return { authorized: false, error: "Forbidden" }
  }

  return { authorized: true }
}

export async function GET(request: NextRequest) {
  try {
    const authCheck = checkAuth(request)
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error || "Unauthorized" }, { status: 401 })
    }

    const summary = await runAnalyticsSnapshot()
    return NextResponse.json({ success: true, summary })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}

