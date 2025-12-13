import { NextRequest, NextResponse } from "next/server"
import { syncWmsVendorSites } from "@/lib/services/wmsSyncService"
import { getMainClient } from "@/lib/supabase/pooled"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { randomUUID } from "crypto"

/**
 * Cron endpoint for syncing WMS sites and devices
 * Uses the same syncWmsVendorSites function as the per-vendor endpoint
 * to ensure consistent behavior and code reuse
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestId = randomUUID()
  
  return MDC.runAsync(
    {
      source: "cron",
      requestId,
      operation: "sync-wms-sites",
    },
    async () => {
      try {
        // Verify cron secret (if configured)
        const cronSecret = process.env.CRON_SECRET
        const authHeader = request.headers.get("authorization")

        if (cronSecret) {
          if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
            logger.warn("[Auth Check] Sync WMS Sites: CRON_SECRET mismatch or missing", {
              hasAuthHeader: !!authHeader,
              authHeaderPrefix: authHeader?.substring(0, 10),
            })
            return NextResponse.json(
              { error: "Unauthorized" },
              { status: 401 }
            )
          }
          logger.info("[Auth Check] Sync WMS Sites: Authorized via CRON_SECRET")
        } else {
          logger.debug("[Auth Check] Sync WMS Sites: CRON_SECRET not configured, allowing request")
        }

        logger.info("[WMS Site Sync Cron] Starting WMS site sync")

        const startTime = Date.now()
        const supabase = getMainClient()
        const results: any[] = []

        // Get all active WMS vendors with their organization sync settings
        const { data: vendors, error } = await supabase
          .from("wms_vendors")
          .select(`
            *,
            organizations (
              id,
              name,
              auto_sync_enabled
            )
          `)
          .eq("is_active", true)
          .not("org_id", "is", null)

        if (error) {
          throw error
        }

        if (!vendors || vendors.length === 0) {
          logger.info("[WMS Site Sync Cron] No active WMS vendors found")
          return NextResponse.json({
            success: true,
            summary: {
              totalVendors: 0,
              successful: 0,
              failed: 0,
              totalSitesSynced: 0,
              totalDevicesSynced: 0,
              results: [],
              duration: Date.now() - startTime,
            },
          })
        }

        // Filter vendors by org-level auto_sync_enabled
        const vendorsToSync = vendors.filter((vendor: any) => {
          const org = vendor.organizations
          if (!org) {
            logger.warn(`⚠️ Organization not found for WMS vendor ${vendor.id} (${vendor.name}), skipping`)
            return false
          }

          if (!org.auto_sync_enabled) {
            logger.info(
              `⏭️ Skipping WMS site sync for vendor ${vendor.id} (${vendor.name}): ` +
              `auto_sync_enabled=false for org ${org.id} (${org.name})`
            )
            return false
          }

          return true
        })

        if (vendorsToSync.length === 0) {
          logger.info("[WMS Site Sync Cron] No vendors to sync (all orgs have auto_sync_enabled=false or missing org)")
          return NextResponse.json({
            success: true,
            summary: {
              totalVendors: vendors.length,
              successful: 0,
              failed: 0,
              totalSitesSynced: 0,
              totalDevicesSynced: 0,
              results: [],
              duration: Date.now() - startTime,
            },
          })
        }

        logger.info(`[WMS Site Sync Cron] Found ${vendorsToSync.length} active WMS vendors to sync (filtered from ${vendors.length} total)`)

        // Sync each vendor using the same function as the per-vendor endpoint
        for (const vendor of vendorsToSync) {
          const result = await syncWmsVendorSites(vendor, supabase)
          results.push(result)
        }

        const successful = results.filter((r) => r.success).length
        const failed = results.filter((r) => !r.success).length
        const totalSitesSynced = results.reduce((sum, r) => sum + r.sitesSynced, 0)
        const totalDevicesSynced = results.reduce((sum, r) => sum + r.devicesSynced, 0)

        const summary = {
          totalVendors: vendorsToSync.length,
          successful,
          failed,
          totalSitesSynced,
          totalDevicesSynced,
          results,
          duration: Date.now() - startTime,
        }

        logger.info(
          `[WMS Site Sync Cron] Complete: ${successful}/${vendorsToSync.length} vendors successful, ${totalSitesSynced} sites, ${totalDevicesSynced} devices synced in ${summary.duration}ms`
        )

        return NextResponse.json({
          success: true,
          summary,
        })
      } catch (error: any) {
        logger.error(`[WMS Site Sync Cron] Error: ${error.message}`, { error })
        return NextResponse.json(
          {
            success: false,
            error: error.message,
          },
          { status: 500 }
        )
      }
    }
  )
}

