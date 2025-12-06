import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import { syncWmsVendorSites } from "@/lib/services/wmsSyncService"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { randomUUID } from "crypto"

/**
 * POST /api/wms-vendors/[id]/sync-sites
 * Sync sites and devices for a specific WMS vendor
 * User-triggered sync (not cron) - syncs only the specified vendor
 */

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = randomUUID()
  
  return MDC.runAsync(
    {
      source: "user",
      requestId,
      operation: "sync-wms-vendor-sites",
      vendorId: parseInt(params.id),
    },
    async () => {
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

        // Only SUPERADMIN and DEVELOPER can sync WMS sites
        requirePermission(accountType as any, "wms_vendors", "update")

        // Update MDC context with user info
        MDC.withContext({
          userId: sessionData.accountId,
          accountType: sessionData.accountType,
          orgId: sessionData.orgId,
        }, () => {
          logger.info(`Syncing WMS sites for vendor ${params.id}`)
        })

        const supabase = getMainClient()
        const vendorId = parseInt(params.id)

        if (isNaN(vendorId)) {
          return NextResponse.json(
            { error: "Invalid vendor ID" },
            { status: 400 }
          )
        }

        // Get vendor details
        const { data: vendor, error: vendorError } = await supabase
          .from("wms_vendors")
          .select("*")
          .eq("id", vendorId)
          .single()

        if (vendorError || !vendor) {
          return NextResponse.json(
            { error: "WMS vendor not found" },
            { status: 404 }
          )
        }

        if (!vendor.is_active) {
          return NextResponse.json(
            { error: "WMS vendor is not active" },
            { status: 400 }
          )
        }

        // Sync sites for this vendor
        const result = await syncWmsVendorSites(vendor, supabase)

        if (!result.success) {
          return NextResponse.json(
            {
              success: false,
              error: result.error || "Failed to sync sites",
              result,
            },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          message: `Sites synced successfully for ${vendor.name}`,
          result,
        })
      } catch (error: any) {
        logger.error(`[WMS Vendor Sync] Error: ${error.message}`, { error })
        return NextResponse.json(
          {
            success: false,
            error: error.message || "Failed to sync WMS sites",
          },
          { status: 500 }
        )
      }
    }
  )
}

