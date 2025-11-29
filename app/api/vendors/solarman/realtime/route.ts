import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { plantId, stationId } = body

    if (!plantId || !stationId) {
      return NextResponse.json(
        { error: "plantId and stationId are required" },
        { status: 400 }
      )
    }

    // Note: solarman-telemetry edge function removed (Telemetry DB removed)
    // Telemetry is now fetched directly from vendor APIs via /api/plants/[id]/telemetry
    return NextResponse.json(
      { 
        error: "This endpoint is deprecated. Use /api/plants/[id]/telemetry instead.",
        message: "Telemetry DB has been removed. Telemetry is now fetched on-demand from vendor APIs."
      },
      { status: 410 } // 410 Gone - resource is no longer available
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

