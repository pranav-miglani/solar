import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getVendorsRepository } from "@/lib/repositories/main"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

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

    const vendorsRepo = getVendorsRepository()
    const vendor = await vendorsRepo.findByIdWithOrganization(parseInt(params.id))

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
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
    const {
      name,
      credentials,
      is_active,
      org_id,
      plant_sync_mode,
      per_plant_sync_interval_minutes,
      plant_sync_time_ist,
      telemetry_sync_mode,
      telemetry_sync_interval,
    } = body

    const vendorsRepo = getVendorsRepository()
    const vendor = await vendorsRepo.update(parseInt(params.id), {
      name,
      credentials,
      is_active,
      org_id,
      plant_sync_mode,
      per_plant_sync_interval_minutes,
      plant_sync_time_ist,
      telemetry_sync_mode,
      telemetry_sync_interval,
    })

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

    const vendorsRepo = getVendorsRepository()
    await vendorsRepo.deleteById(parseInt(params.id))

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
}

