import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"
import { syncWmsDevice } from "@/lib/services/wmsSyncService"
import { requirePermission } from "@/lib/rbac"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { randomUUID } from "crypto"

/**
 * API endpoint to sync a single WMS device
 * Re-fetches the device's site from vendor API and updates the device
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
            logger.info(`Syncing WMS device ${params.id}`)
          }
        )

        const supabase = getMainClient()

        // Sync device
        const result = await syncWmsDevice(parseInt(params.id), supabase)

        if (result.success) {
          return NextResponse.json({
            success: true,
            message: "Device synced successfully",
            result,
          })
        } else {
          return NextResponse.json(
            {
              success: false,
              error: result.error || "Failed to sync device",
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

