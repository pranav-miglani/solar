import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get("hours") || "24")

    const startTime = new Date()
    startTime.setHours(startTime.getHours() - hours)

    const { data: telemetry, error } = await supabase
      .from("telemetry")
      .select("*")
      .eq("plant_id", params.id)
      .gte("ts", startTime.toISOString())
      .order("ts", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ telemetry })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

