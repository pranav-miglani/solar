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

    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke(
      "solarman-telemetry",
      {
        body: { plantId, stationId },
      }
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

