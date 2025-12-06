import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"
import { syncWmsVendorInsolation } from "@/lib/services/wmsSyncService"
import { requirePermission } from "@/lib/rbac"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { randomUUID } from "crypto"

/**
 * API endpoint to sync insolation data for all devices of a specific WMS vendor
 * Syncs insolation data (not device metadata)
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
      operation: "sync-wms-vendor-devices",
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

        // Only SUPERADMIN and DEVELOPER can sync devices
        requirePermission(accountType as any, "wms_vendors", "update")

        // Update MDC context with user info
        MDC.withContext(
          {
            userId: sessionData.accountId,
            accountType: sessionData.accountType,
            orgId: sessionData.orgId,
          },
          () => {
            logger.info(`Syncing insolation data for all devices of WMS vendor ${params.id}`)
          }
        )

        const supabase = getMainClient()

        // Get vendor details
        const { data: vendor, error: vendorError } = await supabase
          .from("wms_vendors")
          .select("*")
          .eq("id", params.id)
          .single()

        if (vendorError || !vendor) {
          return NextResponse.json(
            { error: "WMS vendor not found" },
            { status: 404 }
          )
        }

        // Sync insolation data for all devices
        // For INTELLO, this will sync per device (vendor supports per-device only)
        const today = new Date().toISOString().split("T")[0]
        const result = await syncWmsVendorInsolation(vendor, supabase, today)

        if (result.success) {
          return NextResponse.json({
            success: true,
            message: `Insolation data synced successfully: ${result.devicesSynced} devices, ${result.readingsCreated + result.readingsUpdated} readings (${result.readingsCreated} created, ${result.readingsUpdated} updated)`,
            result,
          })
        } else {
          return NextResponse.json(
            {
              success: false,
              error: result.error || "Failed to sync insolation data",
              result,
            },
            { status: 500 }
          )
        }
      } catch (error: any) {
        logger.error(
          `[WMS Device Sync API] Error: ${error.message}`,
          { error }
        )
        return NextResponse.json(
          {
            success: false,
            error: error.message || "Internal server error",
          },
          { status: 500 }
        )
      }
    }
  )
}

