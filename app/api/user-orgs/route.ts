import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/rbac"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    requirePermission(userData.role as any, "orgs", "update")

    const body = await request.json()
    const { user_id, org_id } = body

    const { data: userOrg, error } = await supabase
      .from("user_orgs")
      .insert({ user_id, org_id })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ userOrg }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
}

