import { NextRequest, NextResponse } from "next/server"
import { getServiceClient } from "@/lib/supabase/serviceClient"
import { requirePermission } from "@/lib/rbac"


export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    requirePermission(accountType as any, "vendors", "read")

    // Use service role client to bypass RLS
    const supabase = getServiceClient()

    const { data: vendor, error } = await supabase
      .from("vendors")
      .select("*, organizations(id, name)")
      .eq("id", params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ vendor })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
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

    let sessionData
    try {
      sessionData = JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const accountType = sessionData.accountType as string

    requirePermission(accountType as any, "vendors", "update")

    const body = await request.json()
    const { name, credentials, is_active, org_id } = body

    // Use service role client to bypass RLS
    const supabase = getServiceClient()

    const updateData: any = {
      name,
      // api_base_url removed - now stored in environment variables
      credentials,
      is_active,
    }

    if (org_id !== undefined) {
      updateData.org_id = org_id
    }

    const { data: vendor, error } = await supabase
      .from("vendors")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ vendor })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    requirePermission(accountType as any, "vendors", "delete")

    // Use service role client to bypass RLS
    const supabase = getServiceClient()

    const { error } = await supabase
      .from("vendors")
      .delete()
      .eq("id", params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
}

