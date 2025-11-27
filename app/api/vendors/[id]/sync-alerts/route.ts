import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { randomUUID } from "crypto"
import { syncAlertsForVendor } from "@/lib/services/alertSyncService"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = randomUUID()
  const vendorId = parseInt(params.id, 10)

  return MDC.runAsync(
    {
      source: "user",
      requestId,
      operation: "sync-vendor-alerts",
      vendorId,
    },
    async () => {
      try {
        const session = request.cookies.get("session")?.value

        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        let sessionData: any
        try {
          sessionData = JSON.parse(Buffer.from(session, "base64").toString())
        } catch {
          return NextResponse.json({ error: "Invalid session" }, { status: 401 })
        }

        const accountType = sessionData.accountType as string

        // Only roles that can update vendors can trigger alert sync
        requirePermission(accountType as any, "vendors", "update")

        MDC.withContext(
          {
            userId: sessionData.accountId,
            accountType: sessionData.accountType,
            orgId: sessionData.orgId,
          },
          () => {
            logger.info(`Syncing alerts for vendor ${vendorId}`)
          }
        )

        const result = await syncAlertsForVendor(vendorId)

        return NextResponse.json({
          success: result.success,
          vendorId: result.vendorId,
          vendorName: result.vendorName,
          orgId: result.orgId,
          orgName: result.orgName,
          synced: result.synced,
          total: result.total,
          created: result.created,
          updated: result.updated,
          error: result.error,
        })
      } catch (error: any) {
        logger.error("Sync vendor alerts error", error)
        return NextResponse.json(
          { error: error.message || "Internal server error" },
          { status: 500 }
        )
      }
    }
  )
}


