import { NextRequest, NextResponse } from "next/server"
import { mirrorOrgVendorConfig } from "@/lib/services/analyticsMirrorService"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET
    if (secret) {
      const authHeader = request.headers.get("authorization") || ""
      const token = authHeader.replace("Bearer ", "")
      if (token !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const summary = await mirrorOrgVendorConfig()
    return NextResponse.json({ success: true, summary })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

