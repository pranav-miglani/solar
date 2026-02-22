import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"

// For workorders API, we need to bypass RLS for write operations

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

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

    const accountType = sessionData.accountType
    const orgId = sessionData.orgId

    // Get orgId from query parameter if provided (for filtering by organization)
    const { searchParams } = new URL(request.url)
    const filterOrgId = searchParams.get("orgId")
    const targetOrgId = filterOrgId ? parseInt(filterOrgId, 10) : null

    // Use service role client to bypass RLS
    const supabase = getMainClient()

    let query = supabase
      .from("work_orders")
      .select(`
        id,
        title,
        description,
        created_at,
        updated_at,
        org_id,
        wms_device_id,
        organizations:org_id(id, name),
        work_order_plants(
          *,
          plants:plant_id (
            id,
            name,
            org_id,
            capacity_kw,
            organizations(id, name)
          )
        )
      `)
      .order("created_at", { ascending: false })

    // Filter by organization - always filter at DB level for efficiency
    // This reduces data fetched from DB and improves performance
    if (targetOrgId) {
      // Filter by orgId query parameter (for SUPERADMIN/GOVT selecting an org)
      query = query.eq("org_id", targetOrgId)
    } else if (accountType === "ORG" && orgId) {
      // For ORG users, ALWAYS filter by their org_id - they should never see other orgs' work orders
      query = query.eq("org_id", orgId)
    } else if (accountType === "GOVT" || accountType === "SUPERADMIN" || accountType === "DEVELOPER") {
      // SUPERADMIN/GOVT/DEVELOPER without orgId param can see all work orders
      // But typically they should select an org first, so this is for backward compatibility
      // In practice, they should use /workorders/org/[orgId] route
    }

    const { data: workOrders, error } = await query

    if (error) {
      console.error("Work orders query error:", error)
      return NextResponse.json(
        { error: "Failed to fetch work orders" },
        { status: 500 }
      )
    }

    // Fetch minimal WMS device info for work orders that have devices assigned
    // Only include device name for list view (only SUPERADMIN/DEVELOPER can see)
    if (accountType === "SUPERADMIN" || accountType === "DEVELOPER") {
      const wmsDeviceIds = (workOrders || [])
        .map((wo: any) => wo.wms_device_id)
        .filter((id: any) => id !== null && id !== undefined)

      if (wmsDeviceIds.length > 0) {
        const { data: devices } = await supabase
          .from("wms_devices")
          .select("id, device_name")
          .in("id", wmsDeviceIds)

        const deviceMap = new Map((devices || []).map((d: any) => [d.id, d]))

        // Add WMS device info to work orders
        workOrders?.forEach((wo: any) => {
          if (wo.wms_device_id && deviceMap.has(wo.wms_device_id)) {
            const device = deviceMap.get(wo.wms_device_id)
            wo.wms_device = { id: device.id, device_name: device.device_name }
          }
        })
      }
    }

    return NextResponse.json({ workOrders: workOrders || [] })
  } catch (error) {
    console.error("Work orders error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
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

    // Only SUPERADMIN/DEVELOPER can create work orders
    requirePermission(accountType as any, "work_orders", "create")

    const body = await request.json()
    const { title, description, plantIds, wmsDeviceId } = body

    if (!title || !plantIds || plantIds.length === 0) {
      return NextResponse.json(
        { error: "Title and at least one plant are required" },
        { status: 400 }
      )
    }

    // Use service role client to bypass RLS for insert
    const supabase = getMainClient()

    // Validate that all plants belong to the same organization
    const { data: plants, error: plantsError } = await supabase
      .from("plants")
      .select("id, org_id")
      .in("id", plantIds)

    if (plantsError) {
      console.error("Plants validation error:", plantsError)
      return NextResponse.json(
        { error: "Failed to validate plants" },
        { status: 500 }
      )
    }

    if (!plants || plants.length !== plantIds.length) {
      return NextResponse.json(
        { error: "One or more plants not found" },
        { status: 400 }
      )
    }

    // Check that all plants belong to the same org
    const orgIds = [...new Set(plants.map((p) => p.org_id))]
    if (orgIds.length > 1) {
      return NextResponse.json(
        { error: "All plants must belong to the same organization" },
        { status: 400 }
      )
    }

    const orgId = orgIds[0] // All plants belong to the same org

    // Validate WMS device if provided (only SUPERADMIN/DEVELOPER can assign)
    let validatedWmsDeviceId: number | null = null
    if (wmsDeviceId !== undefined && wmsDeviceId !== null && wmsDeviceId !== "") {
      if (accountType !== "SUPERADMIN" && accountType !== "DEVELOPER") {
        return NextResponse.json(
          { error: "Only SUPERADMIN/DEVELOPER can assign WMS devices" },
          { status: 403 }
        )
      }

      const { data: wmsDevice, error: wmsDeviceError } = await supabase
        .from("wms_devices")
        .select(`
          id,
          wms_sites!inner(
            id,
            org_id
          )
        `)
        .eq("id", wmsDeviceId)
        .single()

      if (wmsDeviceError || !wmsDevice) {
        return NextResponse.json(
          { error: "WMS device not found" },
          { status: 400 }
        )
      }

      // Validate device belongs to same org as plants
      // Handle wms_sites as either object or array (TypeScript inference issue)
      const site = Array.isArray(wmsDevice.wms_sites) ? wmsDevice.wms_sites[0] : wmsDevice.wms_sites
      if (!site || site.org_id !== orgId) {
        return NextResponse.json(
          { error: "WMS device must belong to the same organization as the plants" },
          { status: 400 }
        )
      }

      validatedWmsDeviceId = wmsDeviceId
    }

    // Create work order (static, no status)
    const { data: workOrder, error: woError } = await supabase
      .from("work_orders")
      .insert({
        title,
        description,
        org_id: orgId, // Set the organization ID for cascade delete
        wms_device_id: validatedWmsDeviceId,
        priority: "MEDIUM", // Default value for existing schema, but not used in UI
        created_by: sessionData.accountId,
      })
      .select()
      .single()

    if (woError) {
      console.error("Work order creation error:", woError)
      return NextResponse.json(
        { error: "Failed to create work order" },
        { status: 500 }
      )
    }

    // Create work_order_plants
    // First, deactivate any existing active work orders for these plants
    const { error: deactivateError } = await supabase
      .from("work_order_plants")
      .update({ is_active: false })
      .in("plant_id", plantIds)
      .eq("is_active", true)

    if (deactivateError) {
      console.error("Deactivate error:", deactivateError)
      // Continue anyway
    }

    // Insert new work_order_plants
      const plantInserts = plantIds.map((plantId: number) => ({
        work_order_id: workOrder.id,
        plant_id: plantId,
        is_active: true,
      }))

      const { error: plantError } = await supabase
        .from("work_order_plants")
        .insert(plantInserts)

      if (plantError) {
      console.error("Plant insert error:", plantError)
      return NextResponse.json(
        { error: "Failed to associate plants with work order" },
        { status: 500 }
      )
    }

    return NextResponse.json({ workOrder }, { status: 201 })
  } catch (error: any) {
    console.error("Work order creation error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
