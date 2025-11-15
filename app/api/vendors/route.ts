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

    requirePermission(accountType as any, "vendors", "read")

    const { data: vendors, error } = await supabase
      .from("vendors")
      .select("*")
      .order("name")

    if (error) {
      console.error("Vendors query error:", error)
      return NextResponse.json(
        { error: "Failed to fetch vendors" },
        { status: 500 }
      )
    }

    return NextResponse.json({ vendors: vendors || [] })
  } catch (error: any) {
    console.error("Vendors error:", error)
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

    requirePermission(accountType as any, "vendors", "create")

    const body = await request.json()
    const { name, vendor_type, api_base_url, credentials, is_active } = body

    if (!name || !vendor_type || !api_base_url || !credentials) {
      return NextResponse.json(
        { error: "Name, vendor_type, api_base_url, and credentials are required" },
        { status: 400 }
      )
    }

    const { data: vendor, error } = await supabase
      .from("vendors")
      .insert({
        name,
        vendor_type,
        api_base_url,
        credentials,
        is_active: is_active ?? true,
      })
      .select()
      .single()

    if (error) {
      console.error("Vendor creation error:", error)
      return NextResponse.json(
        { error: "Failed to create vendor" },
        { status: 500 }
      )
    }

    return NextResponse.json({ vendor }, { status: 201 })
  } catch (error: any) {
    console.error("Vendor creation error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 403 }
    )
  }
}
