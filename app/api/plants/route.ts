import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import { getPlantsRepository } from "@/lib/repositories/main"
import { logApiRequest, logApiResponse, withMDCContext, jsonResponse } from "@/lib/api-logger"

// For plants API, we need to bypass RLS for write operations

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  return withMDCContext(request, async () => {
    logApiRequest(request)
    
    try {
      const session = request.cookies.get("session")?.value

      if (!session) {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      // Decode session
      let sessionData
      try {
        sessionData = JSON.parse(Buffer.from(session, "base64").toString())
      } catch {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Invalid session" }, { status: 401 })
      }

      const accountType = sessionData.accountType as string
      const orgId = sessionData.orgId

      requirePermission(accountType as any, "plants", "read")

      const plantsRepo = getPlantsRepository()
      const supabase = getMainClient()

      let plants: Awaited<ReturnType<typeof plantsRepo.findAllWithRelations>>

      // Apply role-based filtering
      if (accountType === "ORG" && orgId) {
        plants = await plantsRepo.findByOrgIdWithRelations(orgId)
      } else if (accountType === "GOVT") {
        // GOVT users can only see plants that are mapped to work orders
        // Get plant IDs from active work orders
        const { data: workOrderPlants } = await supabase
          .from("work_order_plants")
          .select("plant_id")
          .eq("is_active", true)

        if (workOrderPlants && workOrderPlants.length > 0) {
          const plantIds = workOrderPlants.map((wop) => wop.plant_id)
          plants = await plantsRepo.findByIdsWithRelations(plantIds)
        } else {
          plants = []
        }
      } else {
        // SUPERADMIN can see all plants
        plants = await plantsRepo.findAllWithRelations()
      }

      logApiResponse(request, 200, Date.now() - startTime)
      return jsonResponse({ plants })
    } catch (error: any) {
      console.error("Plants GET error:", error)
      logApiResponse(request, error.message?.includes("permission") ? 403 : 500, Date.now() - startTime, error)
      return jsonResponse(
        { error: error.message || "Internal server error" },
        { status: error.message?.includes("permission") ? 403 : 500 }
      )
    }
  })
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  return withMDCContext(request, async () => {
    logApiRequest(request)
    
    try {
      const session = request.cookies.get("session")?.value

      if (!session) {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      // Decode session
      let sessionData
      try {
        sessionData = JSON.parse(Buffer.from(session, "base64").toString())
      } catch {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Invalid session" }, { status: 401 })
      }

      const accountType = sessionData.accountType as string

      // Only SUPERADMIN can create plants
      requirePermission(accountType as any, "plants", "create")

      const body = await request.json()
      const { org_id, vendor_id, vendor_plant_id, name, capacity_kw, location } =
        body

      // Create plant using repository
      const plantsRepo = getPlantsRepository()
      const plant = await plantsRepo.save({
        org_id,
        vendor_id,
        vendor_plant_id,
        name,
        capacity_kw,
        location: location || {},
      })

      logApiResponse(request, 201, Date.now() - startTime, { plantId: plant.id, name: plant.name })
      return jsonResponse({ plant }, { status: 201 })
    } catch (error: any) {
      logApiResponse(request, 500, Date.now() - startTime, error)
      return jsonResponse({ error: error.message }, { status: 500 })
    }
  })
}

