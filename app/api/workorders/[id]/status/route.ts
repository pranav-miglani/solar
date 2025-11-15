import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Note: Work orders are static (no status/lifecycle) per requirements
// This endpoint may not be needed, but kept for backward compatibility
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase service role key")
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = request.cookies.get("session")?.value

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Decode session
    try {
      JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    // Use service role client
    const supabase = createServiceClient()

    // Note: Work orders are static per requirements - no status field exists
    // This endpoint returns an error to indicate work orders cannot be updated
    return NextResponse.json(
      { 
        error: "Work orders are static and cannot be updated",
        message: "Per system requirements, work orders have no status/lifecycle"
      },
      { status: 400 }
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

