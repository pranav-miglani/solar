import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import { getEffectiveOrgFilter } from "@/lib/plants/getEffectiveOrgFilter"

export const dynamic = "force-dynamic"

const MAX_NAME_LENGTH = 50
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

export async function GET(request: NextRequest) {
  try {
    const session = request.cookies.get("session")?.value
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let sessionData: { accountType?: string; orgId?: number }
    try {
      sessionData = JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const accountType = sessionData.accountType as string
    const sessionOrgId = sessionData.orgId

    requirePermission(accountType as any, "plants", "read")

    const { searchParams } = new URL(request.url)
    const name = (searchParams.get("name") ?? "").trim().slice(0, MAX_NAME_LENGTH)
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
    )
    const requestOrgId = searchParams.get("orgId")
    const onlyInWorkOrders = searchParams.get("onlyInWorkOrders") === "true"

    const effectiveOrgId = getEffectiveOrgFilter(accountType, sessionOrgId, requestOrgId)

    const govtRestrictToWorkOrders = accountType === "GOVT"
    const onlyInWorkOrdersEffective = govtRestrictToWorkOrders || onlyInWorkOrders
    const pathKind = onlyInWorkOrdersEffective ? "work-order-restricted" : "normal"
    console.log("[Plants search] params:", {
      accountType,
      name: name || "(empty)",
      nameLength: name.length,
      page,
      limit,
      requestOrgId: requestOrgId ?? null,
      effectiveOrgId,
      onlyInWorkOrders,
      govtRestrictToWorkOrders,
      onlyInWorkOrdersEffective,
      pathKind,
      debug: onlyInWorkOrdersEffective
        ? `${accountType} → work-order path (GOVT always; SUPERADMIN/ORG only when onlyInWorkOrders=true)`
        : `${accountType} → normal plants query (no work-order filter)`,
    })

    if (name.length === 0) {
      return NextResponse.json({
        plants: [],
        total: 0,
        page,
        limit,
      })
    }

    const supabase = getMainClient()

    let plantsQuery = supabase
      .from("plants")
      .select("id, name, org_id, vendor_id, organizations(id, name), vendors(id, name, vendor_type)", { count: "exact" })

    if (effectiveOrgId !== null) {
      plantsQuery = plantsQuery.eq("org_id", effectiveOrgId)
    }

    if (name.length > 0) {
      plantsQuery = plantsQuery.ilike("name", `%${name}%`)
    }

    if (onlyInWorkOrdersEffective) {
      console.log("[Plants search] work-order path start:", { accountType, pathKind: "work-order-restricted" })
      const { data: plantIdsInWo, error: wopError } = await supabase
        .from("work_order_plants")
        .select("plant_id")
        .eq("is_active", true)
      const rowCount = plantIdsInWo?.length ?? 0
      console.log("[Plants search] work_order_plants result:", {
        accountType,
        rowCount,
        wopError: wopError ? { message: wopError.message, code: wopError.code, details: wopError.details } : null,
      })
      const rawIds = (plantIdsInWo ?? []).map((r) => r.plant_id).filter((id): id is number => typeof id === "number" && Number.isInteger(id))
      const ids = [...new Set(rawIds)]
      const dropped = rowCount - rawIds.length
      if (dropped > 0) console.log("[Plants search] dropped non-integer plant_id(s):", { accountType, dropped })
      if (ids.length === 0) {
        console.log("[Plants search] no valid plant ids from work_order_plants, returning empty:", { accountType })
        return NextResponse.json({
          plants: [],
          total: 0,
          page,
          limit,
        })
      }
      const MAX_IN_CLAUSE = 500
      const idsToUse = ids.length > MAX_IN_CLAUSE ? ids.slice(0, MAX_IN_CLAUSE) : ids
      if (ids.length > MAX_IN_CLAUSE) {
        console.log("[Plants search] capped plant ids:", { accountType, total: ids.length, using: idsToUse.length })
      }
      console.log("[Plants search] applying .in('id', idsToUse):", { accountType, count: idsToUse.length, sample: idsToUse.slice(0, 5) })
      plantsQuery = plantsQuery.in("id", idsToUse)
    }

    plantsQuery = plantsQuery.order("name", { ascending: true })

    const offset = (page - 1) * limit
    console.log("[Plants search] querying plants:", { accountType, pathKind, offset, limit })
    const { data: plants, error: plantsError, count } = await plantsQuery.range(offset, offset + limit - 1)

    if (plantsError) {
      console.error("Plants search error (full):", {
        accountType,
        pathKind,
        message: plantsError.message,
        code: plantsError.code,
        details: plantsError.details,
        hint: plantsError.hint,
      })
      return NextResponse.json({ error: "Failed to fetch plants" }, { status: 500 })
    }

    const plantIds = (plants ?? []).map((p) => p.id)
    console.log("[Plants search] plants query result:", { accountType, pathKind, rowsReturned: plantIds.length, totalCount: count ?? null })
    if (plantIds.length === 0) {
      console.log("[Plants search] returning empty list (no plants matched):", { accountType, pathKind })
      return NextResponse.json({
        plants: [],
        total: count ?? 0,
        page,
        limit,
      })
    }

    const { data: wopRows } = await supabase
      .from("work_order_plants")
      .select("plant_id, work_order_id")
      .in("plant_id", plantIds)
      .eq("is_active", true)

    const workOrderIds = [...new Set((wopRows ?? []).map((r) => r.work_order_id))]
    const workOrdersById = new Map<number, { id: number; title: string }>()
    if (workOrderIds.length > 0) {
      const { data: woList } = await supabase
        .from("work_orders")
        .select("id, title")
        .in("id", workOrderIds)
      for (const wo of woList ?? []) {
        workOrdersById.set(wo.id, { id: wo.id, title: wo.title ?? `Work order ${wo.id}` })
      }
    }

    const workOrdersByPlantId = new Map<number, Array<{ id: number; title: string }>>()
    for (const row of wopRows ?? []) {
      const wo = workOrdersById.get(row.work_order_id)
      if (!wo) continue
      const list = workOrdersByPlantId.get(row.plant_id) ?? []
      list.push(wo)
      workOrdersByPlantId.set(row.plant_id, list)
    }

    const plantsWithWorkOrders = (plants ?? []).map((p) => ({
      ...p,
      workOrders: workOrdersByPlantId.get(p.id) ?? [],
    }))

    return NextResponse.json({
      plants: plantsWithWorkOrders,
      total: count ?? 0,
      page,
      limit,
    })
  } catch (error: any) {
    console.error("Plants search error:", error)
    return NextResponse.json(
      { error: error.message?.includes("permission") ? "Forbidden" : "Internal server error" },
      { status: error.message?.includes("permission") ? 403 : 500 }
    )
  }
}
