import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"
import { syncWmsDeviceInsolation } from "@/lib/services/wmsSyncService"
import { requirePermission } from "@/lib/rbac"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { randomUUID } from "crypto"

/**
 * API endpoint to sync insolation data for a single WMS device
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
      operation: "sync-wms-device",
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
            logger.info(`Syncing insolation data for WMS device ${params.id}`)
          }
        )

        const supabase = getMainClient()

        // Sync insolation data for this device (backfill last 100 days)
        // Pass null to trigger 100-day backfill
        const result = await syncWmsDeviceInsolation(parseInt(params.id), null, supabase)

        if (result.success) {
          return NextResponse.json({
            success: true,
            message: `Insolation data synced successfully: ${result.readingsCreated + result.readingsUpdated} readings (${result.readingsCreated} created, ${result.readingsUpdated} updated)`,
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

