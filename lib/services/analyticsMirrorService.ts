import crypto from "crypto"
import { logger } from "@/lib/context/logger"
import { getMainClient, getAnalyticsClient } from "@/lib/supabase/pooled"

type MirrorSummary = {
  orgsProcessed: number
  vendorsProcessed: number
  orgsUpdated: number
  vendorsUpdated: number
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
    orgsUpdated: 0,
    vendorsUpdated: 0,
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

  logger.info("[Analytics Mirror] Mirror complete", summary)
  return summary
}

