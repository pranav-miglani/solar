import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainClient } from "@/lib/supabase/pooled"
import { syncWmsVendorInsolation } from "@/lib/services/wmsSyncService"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { randomUUID } from "crypto"

/**
 * POST /api/wms-vendors/[id]/sync-insolation
 * Sync insolation data for a specific WMS vendor
 * User-triggered sync (not cron) - syncs only the specified vendor
 * @param date - Optional date to sync (YYYY-MM-DD), defaults to current day
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
      operation: "sync-wms-vendor-insolation",
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

        // Only SUPERADMIN and DEVELOPER can sync WMS insolation
        requirePermission(accountType as any, "wms_vendors", "update")

        // Update MDC context with user info
        MDC.withContext({
          userId: sessionData.accountId,
          accountType: sessionData.accountType,
          orgId: sessionData.orgId,
        }, () => {
          logger.info(`Syncing WMS insolation for vendor ${params.id}`)
        })

        const supabase = getMainClient()
        const vendorId = parseInt(params.id)

        if (isNaN(vendorId)) {
          return NextResponse.json(
            { error: "Invalid vendor ID" },
            { status: 400 }
          )
        }

        // Get optional date from query params or body (defaults to current day)
        const { searchParams } = new URL(request.url)
        let date = searchParams.get("date")
        
        // Try to get date from body if not in query params
        if (!date) {
          try {
            const body = await request.json()
            date = body.date
          } catch {
            // Body parsing failed or empty, use default
          }
        }
        
        // Default to current day if not provided
        if (!date) {
          date = new Date().toISOString().split("T")[0]
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

        // Sync insolation for this vendor
        const result = await syncWmsVendorInsolation(vendor, supabase, date)

        if (!result.success) {
          return NextResponse.json(
            {
              success: false,
              error: result.error || "Failed to sync insolation",
              result,
            },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          message: `Insolation synced successfully for ${vendor.name}`,
          date,
          result,
        })
      } catch (error: any) {
        logger.error(`[WMS Vendor Insolation Sync] Error: ${error.message}`, { error })
        return NextResponse.json(
          {
            success: false,
            error: error.message || "Failed to sync WMS insolation",
          },
          { status: 500 }
        )
      }
    }
  )
}

