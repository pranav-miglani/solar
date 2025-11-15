import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/rbac"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
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
    const supabase = await createClient()
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

    requirePermission(accountType as any, "organizations", "create")

    const body = await request.json()
    const { name, meta } = body

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      )
    }

    const { data: org, error } = await supabase
      .from("organizations")
      .insert({ name, meta: meta || {} })
      .select()
      .single()

    if (error) {
      console.error("Org creation error:", error)
      return NextResponse.json(
        { error: "Failed to create organization" },
        { status: 500 }
      )
    }

    return NextResponse.json({ org }, { status: 201 })
  } catch (error: any) {
    console.error("Org creation error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 403 }
    )
  }
}
