import crypto from "crypto"
import { logger } from "@/lib/context/logger"
import MDC from "@/lib/context/mdc"
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
  // Ensure MDC context is set (will use existing context if already set by route handler)
  const source = MDC.getSource() || "system"
  const requestId = MDC.get("requestId") || "unknown"
  
  return MDC.withContextAsync(
    {
      source,
      requestId,
      operation: "mirror-org-vendor-config",
    },
    async () => {
      logger.info("[Analytics Mirror] Starting config mirror operation")
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
      logger.info("[Analytics Mirror] Fetching organizations from main DB")
      const { data: orgs, error: orgError } = await main.from("organizations").select("*")
      if (orgError) {
        logger.error("[Analytics Mirror] Failed to fetch organizations from main DB", { error: orgError.message })
        throw orgError
      }

      logger.info(`[Analytics Mirror] Found ${orgs?.length || 0} organizations to mirror`)
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

      logger.info(`[Analytics Mirror] Organizations mirror complete - Processed: ${summary.orgsProcessed}, Updated: ${summary.orgsUpdated}`)

      // Mirror vendors
      logger.info("[Analytics Mirror] Fetching vendors from main DB")
      const { data: vendors, error: vendorError } = await main.from("vendors").select("*")
      if (vendorError) {
        logger.error("[Analytics Mirror] Failed to fetch vendors from main DB", { error: vendorError.message })
        throw vendorError
      }

      logger.info(`[Analytics Mirror] Found ${vendors?.length || 0} vendors to mirror`)

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

      logger.info(`[Analytics Mirror] Vendors mirror complete - Processed: ${summary.vendorsProcessed}, Updated: ${summary.vendorsUpdated}`)

      // Mirror plants in batches with parallel processing for speed
      logger.info("[Analytics Mirror] Starting plants mirror (batched with parallel processing)")
      
      // First, get total count to calculate batches
      const { count: totalPlants, error: countError } = await main
        .from("plants")
        .select("id", { count: "exact", head: true })
      
      if (countError) {
        logger.error("[Analytics Mirror] Failed to count plants", { error: countError.message })
        throw countError
      }

      const BATCH_SIZE = 500 // Increased batch size for better throughput
      const MAX_CONCURRENT_BATCHES = 10 // Process up to 10 batches in parallel
      const totalBatches = Math.ceil((totalPlants || 0) / BATCH_SIZE)
      
      logger.info(`[Analytics Mirror] Total plants: ${totalPlants}, Batch size: ${BATCH_SIZE}, Total batches: ${totalBatches}, Max concurrent: ${MAX_CONCURRENT_BATCHES}`)

      // Process batches in parallel with concurrency limit
      const processBatch = async (batchIndex: number): Promise<{ processed: number; updated: number }> => {
        const offset = batchIndex * BATCH_SIZE
        const { data: plantsBatch, error: plantError } = await main
          .from("plants")
          .select("id, org_id, vendor_id, vendor_plant_id, name, capacity_kw")
          .range(offset, offset + BATCH_SIZE - 1)

        if (plantError) {
          logger.error("[Analytics Mirror] Failed to fetch plants batch", { batchIndex, offset, error: plantError.message })
          throw plantError
        }

        if (!plantsBatch || plantsBatch.length === 0) {
          return { processed: 0, updated: 0 }
        }

        logger.info(`[Analytics Mirror] Processing plants batch ${batchIndex + 1}/${totalBatches} (${plantsBatch.length} plants, offset: ${offset})`)

        // Batch upsert all plants in this batch at once
        const plantsToUpsert = plantsBatch.map(plant => ({
          id: plant.id,
          org_id: plant.org_id,
          vendor_id: plant.vendor_id,
          vendor_plant_id: plant.vendor_plant_id,
          plant_name: plant.name,
          capacity_kw: plant.capacity_kw,
          updated_at: now,
        }))

        const { error: batchError } = await analytics
          .from("plants")
          .upsert(plantsToUpsert, { onConflict: "id" })

        if (batchError) {
          logger.error("[Analytics Mirror] Failed to batch upsert plants", { 
            batchIndex: batchIndex + 1,
            plantCount: plantsBatch.length,
            error: batchError.message 
          })
          throw batchError
        }

        logger.info(`[Analytics Mirror] Completed batch ${batchIndex + 1}/${totalBatches} (${plantsBatch.length} plants)`)
        return { processed: plantsBatch.length, updated: plantsBatch.length }
      }

      // Process batches in parallel with proper concurrency limiting
      const batchIndices = Array.from({ length: totalBatches }, (_, i) => i)
      const results: { processed: number; updated: number }[] = []
      
      // Process batches in chunks to limit concurrency
      for (let i = 0; i < batchIndices.length; i += MAX_CONCURRENT_BATCHES) {
        const batchChunk = batchIndices.slice(i, i + MAX_CONCURRENT_BATCHES)
        const chunkNumber = Math.floor(i / MAX_CONCURRENT_BATCHES) + 1
        const totalChunks = Math.ceil(batchIndices.length / MAX_CONCURRENT_BATCHES)
        
        logger.info(`[Analytics Mirror] Processing batch chunk ${chunkNumber}/${totalChunks} (${batchChunk.length} batches in parallel)`)
        
        // Process batches in this chunk in parallel
        const chunkResults = await Promise.all(
          batchChunk.map(batchIndex => processBatch(batchIndex))
        )
        
        results.push(...chunkResults)
      }

      // Sum up results
      for (const result of results) {
        summary.plantsProcessed += result.processed
        summary.plantsUpdated += result.updated
      }

      logger.info(`[Analytics Mirror] Plants mirror complete - Processed: ${summary.plantsProcessed}, Updated: ${summary.plantsUpdated}`)
      logger.info("[Analytics Mirror] Mirror complete", summary)
      return summary
    }
  )
}

