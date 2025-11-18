import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getServiceClient } from "@/lib/supabase/serviceClient"

export async function GET(request: NextRequest) {
  try {
    const session = request.cookies.get("session")?.value

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let sessionData
    try {
      sessionData = JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const accountType = sessionData.accountType as string

    requirePermission(accountType as any, "organizations", "read")

    // Use service role client to bypass RLS
    const supabase = getServiceClient()

    const { data: orgs, error } = await supabase
      .from("organizations")
      .select("*")
      .order("name")

    if (error) {
      console.error("Orgs query error:", error)
      return NextResponse.json(
        { error: "Failed to fetch organizations" },
        { status: 500 }
      )
    }

    return NextResponse.json({ orgs: orgs || [] })
  } catch (error: any) {
    console.error("Orgs error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 403 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = request.cookies.get("session")?.value

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let sessionData
    try {
      sessionData = JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const accountType = sessionData.accountType as string

    // Only SUPERADMIN can create organizations
    requirePermission(accountType as any, "organizations", "create")

    const body = await request.json()
    const { name, meta } = body

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      )
    }

    // Use service role client to bypass RLS for insert
    const supabase = getServiceClient()

    const { data: org, error } = await supabase
      .from("organizations")
      .insert({ name, meta: meta || {} })
      .select()
      .single()

    if (error) {
      console.error("Org creation error:", error)
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      return NextResponse.json(
        { error: "Failed to create organization", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ org }, { status: 201 })
  } catch (error: any) {
    console.error("Org creation error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.message?.includes("permission") ? 403 : 500 }
    )
  }
}
