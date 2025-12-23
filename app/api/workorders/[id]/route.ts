import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"

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

    // Decode session (middleware already validates)
    try {
      JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const sessionData = JSON.parse(Buffer.from(session, "base64").toString())
    const accountType = sessionData.accountType as string
    const orgId = sessionData.orgId as number | null

    // Use service role client to bypass RLS
    const supabase = getMainClient()

    const { data: workOrder, error } = await supabase
      .from("work_orders")
      .select(`
        id,
        title,
        description,
        location,
        created_at,
        updated_at,
        org_id,
        wms_device_id,
        work_order_plants(
          *,
          plants(
            *,
            organizations(id, name),
            vendors(id, name, vendor_type)
          )
        )
      `)
      .eq("id", params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Enforce org scoping for ORG users: only allow access to work orders
    // that belong to their own organization.
    if (accountType === "ORG") {
      if (!orgId || !workOrder || workOrder.org_id !== orgId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
    }

    // Extract networkStatus from plant metadata if available
    if (workOrder?.work_order_plants) {
      for (const wop of workOrder.work_order_plants) {
        if (wop.plants) {
          // networkStatus might be in metadata JSONB field
          const metadata = (wop.plants as any).metadata || {}
          ;(wop.plants as any).networkStatus =
            metadata.networkStatus || metadata.network_status || null
        }
      }
    }

    // Fetch WMS device info if assigned (only for SUPERADMIN/DEVELOPER)
    let wmsDevice = null
    if (workOrder?.wms_device_id && (accountType === "SUPERADMIN" || accountType === "DEVELOPER")) {
      const { data: device, error: deviceError } = await supabase
        .from("wms_devices")
        .select(`
          id,
          device_name,
          vendor_device_id,
          wms_sites!inner(
            id,
            site_name,
            address,
            wms_vendors!inner(
              id,
              name,
              vendor_type
            )
          )
        `)
        .eq("id", workOrder.wms_device_id)
        .single()

      if (!deviceError && device) {
        // Handle wms_sites as either object or array (TypeScript inference issue)
        const site = Array.isArray(device.wms_sites) ? device.wms_sites[0] : device.wms_sites
        if (site) {
          const vendor = Array.isArray(site.wms_vendors) ? site.wms_vendors[0] : site.wms_vendors
          if (vendor) {
            wmsDevice = {
              id: device.id,
              device_name: device.device_name,
              vendor_device_id: device.vendor_device_id,
              site_name: site.site_name,
              site_address: site.address,
              vendor_name: vendor.name,
              vendor_type: vendor.vendor_type,
            }
          }
        }
      }
    }

    // Add flattened WMS device info to work order response
    const response = {
      ...workOrder,
      wms_device: wmsDevice,
    }

    return NextResponse.json({ workOrder: response })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
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

    // Only SUPERADMIN/DEVELOPER can update work orders
    requirePermission(accountType as any, "work_orders", "update")

    const body = await request.json()
    const { title, description, location, plantIds, wmsDeviceId } = body

    if (!title || !plantIds || plantIds.length === 0) {
      return NextResponse.json(
        { error: "Title and at least one plant are required" },
        { status: 400 }
      )
    }

    const supabase = getMainClient()

    // Get current work order to get org_id
    const { data: currentWorkOrder, error: currentError } = await supabase
      .from("work_orders")
      .select("org_id")
      .eq("id", params.id)
      .single()

    if (currentError || !currentWorkOrder) {
      return NextResponse.json(
        { error: "Work order not found" },
        { status: 404 }
      )
    }

    const orgId = currentWorkOrder.org_id

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

    // Check that all plants belong to the same org as work order
    const plantOrgIds = [...new Set(plants.map((p) => p.org_id))]
    if (plantOrgIds.length > 1) {
      return NextResponse.json(
        { error: "All plants must belong to the same organization" },
        { status: 400 }
      )
    }

    if (plantOrgIds[0] !== orgId) {
      return NextResponse.json(
        { error: "All plants must belong to the same organization as the work order" },
        { status: 400 }
      )
    }

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

      // Validate device belongs to same org as work order
      // Handle wms_sites as either object or array (TypeScript inference issue)
      const site = Array.isArray(wmsDevice.wms_sites) ? wmsDevice.wms_sites[0] : wmsDevice.wms_sites
      if (!site || site.org_id !== orgId) {
        return NextResponse.json(
          { error: "WMS device must belong to the same organization as the work order" },
          { status: 400 }
        )
      }

      validatedWmsDeviceId = wmsDeviceId
    } else if (wmsDeviceId === null || wmsDeviceId === "") {
      // Explicitly clearing WMS device assignment
      validatedWmsDeviceId = null
    }

    // Update work order
    const updateData: any = {
      title,
      description,
      location,
      org_id: orgId, // Update the organization ID for cascade delete
    }

    // Only update wms_device_id if explicitly provided (allows clearing assignment)
    if (wmsDeviceId !== undefined) {
      updateData.wms_device_id = validatedWmsDeviceId
    }

    const { data: workOrder, error: woError } = await supabase
      .from("work_orders")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single()

    if (woError) {
      console.error("Work order update error:", woError)
      return NextResponse.json(
        { error: "Failed to update work order" },
        { status: 500 }
      )
    }

    // Get all existing work_order_plants for this work order (both active and inactive)
    const { data: existingWorkOrderPlants, error: existingError } = await supabase
      .from("work_order_plants")
      .select("plant_id, is_active")
      .eq("work_order_id", parseInt(params.id))

    if (existingError) {
      console.error("Error fetching existing work order plants:", existingError)
      return NextResponse.json(
        { error: "Failed to fetch existing plants" },
        { status: 500 }
      )
    }

    const existingPlantIds = new Set(
      (existingWorkOrderPlants || []).map((wop) => wop.plant_id)
    )
    const selectedPlantIdsSet = new Set(plantIds)

    // Separate plants into: to insert (new), to activate (existing but inactive), to deactivate (not in selection)
    const plantsToInsert: Array<{ work_order_id: number; plant_id: number; is_active: boolean }> = []
    const plantsToActivate: number[] = []
    const plantsToDeactivate: number[] = []

    // Process selected plants
    plantIds.forEach((plantId: number) => {
      if (existingPlantIds.has(plantId)) {
        // Plant already exists - check if it needs to be activated
        const existingWop = existingWorkOrderPlants?.find((wop) => wop.plant_id === plantId)
        if (existingWop && !existingWop.is_active) {
          plantsToActivate.push(plantId)
        }
        // If already active, no action needed
      } else {
        // New plant - needs to be inserted
        plantsToInsert.push({
          work_order_id: parseInt(params.id),
          plant_id: plantId,
          is_active: true,
        })
      }
    })

    // Process existing plants that are not in the selection - deactivate them
    existingWorkOrderPlants?.forEach((wop) => {
      if (!selectedPlantIdsSet.has(wop.plant_id) && wop.is_active) {
        plantsToDeactivate.push(wop.plant_id)
      }
    })

    // Execute updates and inserts
    const errors: string[] = []

    // Deactivate plants that are no longer selected
    if (plantsToDeactivate.length > 0) {
      const { error: deactivateError } = await supabase
        .from("work_order_plants")
        .update({ is_active: false })
        .eq("work_order_id", parseInt(params.id))
        .in("plant_id", plantsToDeactivate)

      if (deactivateError) {
        console.error("Error deactivating plants:", deactivateError)
        errors.push(`Failed to deactivate ${plantsToDeactivate.length} plants`)
      }
    }

    // Activate plants that were previously inactive
    if (plantsToActivate.length > 0) {
      const { error: activateError } = await supabase
        .from("work_order_plants")
        .update({ is_active: true })
        .eq("work_order_id", parseInt(params.id))
        .in("plant_id", plantsToActivate)

      if (activateError) {
        console.error("Error activating plants:", activateError)
        errors.push(`Failed to activate ${plantsToActivate.length} plants`)
      }
    }

    // Insert new plants (only those that don't exist)
    if (plantsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("work_order_plants")
        .insert(plantsToInsert)

      if (insertError) {
        console.error("Plant insert error:", insertError)
        errors.push(`Failed to insert ${plantsToInsert.length} new plants`)
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: `Failed to update plants: ${errors.join('; ')}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ workOrder })
  } catch (error: any) {
    console.error("Update work order error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
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

    // Only SUPERADMIN can delete work orders
    requirePermission(accountType as any, "work_orders", "delete")

    const supabase = getMainClient()

    // Delete the work order (cascade will handle work_order_plants)
    const { error: deleteError } = await supabase
      .from("work_orders")
      .delete()
      .eq("id", params.id)

    if (deleteError) {
      console.error("Delete work order error:", deleteError)
      return NextResponse.json(
        { error: "Failed to delete work order" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Work order deleted successfully",
    })
  } catch (error: any) {
    console.error("Delete work order error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: error.message?.includes("permission") ? 403 : 500 }
    )
  }
}
