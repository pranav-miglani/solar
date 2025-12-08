import crypto from "crypto"
import { logger } from "@/lib/context/logger"
import { getMainClient, getAnalyticsClient } from "@/lib/supabase/pooled"

type MirrorSummary = {
  orgsProcessed: number
  vendorsProcessed: number
  plantsProcessed: number
  orgsUpdated: number
  vendorsUpdated: number
  plantsUpdated: number
}

const TIMESTAMP_KEYS = ["created_at", "updated_at", "last_refresh_at", "last_refreshed_at", "last_synced_at", "last_synced_time", "last_sync_time"]

function stripTimestamps<T extends Record<string, any>>(obj: T): Record<string, any> {
  if (!obj) return {}
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (TIMESTAMP_KEYS.includes(key) || key.endsWith("_at")) continue
    result[key] = value
  }
  return result
}

function computeHash(payload: Record<string, any>): string {
  const ordered = Object.keys(payload)
    .sort()
    .reduce((acc, key) => {
      acc[key] = payload[key]
      return acc
    }, {} as Record<string, any>)
  return crypto.createHash("sha256").update(JSON.stringify(ordered)).digest("hex")
}

export async function mirrorOrgVendorConfig(): Promise<MirrorSummary> {
  const main = getMainClient()
  const analytics = getAnalyticsClient()

  const summary: MirrorSummary = {
    orgsProcessed: 0,
    vendorsProcessed: 0,
    plantsProcessed: 0,
    orgsUpdated: 0,
    vendorsUpdated: 0,
    plantsUpdated: 0,
  }

  // Mirror organizations
  const { data: orgs, error: orgError } = await main.from("organizations").select("*")
  if (orgError) {
    logger.error("[Analytics Mirror] Failed to fetch organizations from main DB", { error: orgError.message })
    throw orgError
  }

  const now = new Date().toISOString()

  for (const org of orgs || []) {
    summary.orgsProcessed++
    const clean = stripTimestamps(org as any)
    const hash = computeHash(clean)

    const { data: existing } = await analytics
      .from("organizations")
      .select("config_hash")
      .eq("id", org.id)
      .maybeSingle()

    if (existing?.config_hash === hash) {
      // No change; ensure ready/status updated
      await analytics
        .from("organizations")
        .update({
          config_ready: true,
          config_last_run_at: now,
          config_last_status: "success",
          config_last_error: null,
        })
        .eq("id", org.id)
      continue
    }

    const { error } = await analytics.from("organizations").upsert(
      {
        id: org.id,
        name: org.name,
        config: clean,
        config_hash: hash,
        config_ready: true,
        config_last_run_at: now,
        config_last_status: "success",
        config_last_error: null,
      },
      { onConflict: "id" }
    )

    if (error) {
      logger.error("[Analytics Mirror] Failed to upsert organization into analytics DB", { orgId: org.id, error: error.message })
      throw error
    }

    summary.orgsUpdated++
  }

  // Mirror vendors
  const { data: vendors, error: vendorError } = await main.from("vendors").select("*")
  if (vendorError) {
    logger.error("[Analytics Mirror] Failed to fetch vendors from main DB", { error: vendorError.message })
    throw vendorError
  }

  for (const vendor of vendors || []) {
    summary.vendorsProcessed++
    const clean = stripTimestamps(vendor as any)
    const hash = computeHash(clean)

    const { data: existing } = await analytics
      .from("vendors")
      .select("config_hash")
      .eq("id", vendor.id)
      .maybeSingle()

    const basePayload = {
      id: vendor.id,
      org_id: vendor.org_id,
      name: vendor.name,
      vendor_type: vendor.vendor_type,
      config: clean,
      config_hash: hash,
      config_ready: true,
      config_last_run_at: now,
      config_last_status: "success",
      config_last_error: null,
      analytics_ready: true,
    }

    if (existing?.config_hash === hash) {
      const { error } = await analytics.from("vendors").update(basePayload).eq("id", vendor.id)
      if (error) {
        logger.error("[Analytics Mirror] Failed to update vendor in analytics DB", { vendorId: vendor.id, error: error.message })
        throw error
      }
      continue
    }

    const { error } = await analytics.from("vendors").upsert(basePayload, { onConflict: "id" })
    if (error) {
      logger.error("[Analytics Mirror] Failed to upsert vendor into analytics DB", { vendorId: vendor.id, error: error.message })
      throw error
    }

    summary.vendorsUpdated++
  }

  // Mirror plants in batches
  const BATCH_SIZE = 100
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data: plantsBatch, error: plantError } = await main
      .from("plants")
      .select("id, org_id, vendor_id, vendor_plant_id, name")
      .range(offset, offset + BATCH_SIZE - 1)

    if (plantError) {
      logger.error("[Analytics Mirror] Failed to fetch plants from main DB", { error: plantError.message })
      throw plantError
    }

    if (!plantsBatch || plantsBatch.length === 0) {
      hasMore = false
      break
    }

    for (const plant of plantsBatch) {
      summary.plantsProcessed++
      const { error } = await analytics.from("plants").upsert(
        {
          id: plant.id,
          org_id: plant.org_id,
          vendor_id: plant.vendor_id,
          vendor_plant_id: plant.vendor_plant_id,
          plant_name: plant.name,
          updated_at: now,
        },
        { onConflict: "id" }
      )

      if (error) {
        logger.error("[Analytics Mirror] Failed to upsert plant into analytics DB", { plantId: plant.id, error: error.message })
        throw error
      }

      summary.plantsUpdated++
    }

    offset += BATCH_SIZE
    hasMore = plantsBatch.length === BATCH_SIZE
  }

  logger.info("[Analytics Mirror] Mirror complete", summary)
  return summary
}

