import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"
import { logger } from "@/lib/context/logger"

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

  // Check session (for manual triggers)
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

export async function POST(request: NextRequest) {
  try {
    const authCheck = checkAuth(request)
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error || "Unauthorized" }, { status: 401 })
    }

    const main = getMainClient()
    
    logger.info("[ResetWasOnlineToday] Starting reset of was_online_today flag for all plants")

    const { data: resetResult, error: resetError } = await main.rpc("reset_was_online_today")

    if (resetError) {
      logger.error("[ResetWasOnlineToday] Reset failed", { error: resetError.message })
      return NextResponse.json(
        { success: false, error: resetError.message },
        { status: 500 }
      )
    }

    logger.info("[ResetWasOnlineToday] Reset completed successfully", {
      plantsReset: resetResult || 0,
    })

    return NextResponse.json({
      success: true,
      plantsReset: resetResult || 0,
    })
  } catch (error: any) {
    logger.error("[ResetWasOnlineToday] Exception during reset", { error: error.message })
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}

