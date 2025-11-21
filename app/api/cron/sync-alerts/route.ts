import { NextRequest, NextResponse } from "next/server"
import { syncAllAlerts } from "@/lib/services/alertSyncService"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { randomUUID } from "crypto"

/**
 * Cron endpoint for syncing alerts from all vendors
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const requestId = randomUUID()

    return MDC.runAsync(
        {
            source: "cron",
            requestId,
            operation: "sync-alerts",
        },
        async () => {
            try {
                // Verify cron secret (if configured)
                const cronSecret = process.env.CRON_SECRET
                const authHeader = request.headers.get("authorization")

                if (cronSecret) {
                    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
                        return NextResponse.json(
                            { error: "Unauthorized" },
                            { status: 401 }
                        )
                    }
                }

                // Execute sync
                const summary = await syncAllAlerts()

                return NextResponse.json({
                    success: true,
                    message: "Alert sync completed",
                    summary: {
                        totalVendors: summary.totalVendors,
                        successful: summary.successful,
                        failed: summary.failed,
                        totalAlertsSynced: summary.totalAlertsSynced,
                        totalAlertsCreated: summary.totalAlertsCreated,
                        totalAlertsUpdated: summary.totalAlertsUpdated,
                        duration: summary.duration,
                        results: summary.results.map((r) => ({
                            vendorId: r.vendorId,
                            vendorName: r.vendorName,
                            orgId: r.orgId,
                            orgName: r.orgName,
                            success: r.success,
                            synced: r.synced,
                            created: r.created,
                            updated: r.updated,
                            total: r.total,
                            error: r.error,
                        })),
                    },
                })
            } catch (error: any) {
                logger.error("❌ Alert sync cron error", error)
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

/**
 * POST endpoint for manual trigger (with authentication)
 */
export async function POST(request: NextRequest) {
    const requestId = randomUUID()

    return MDC.runAsync(
        {
            source: "user",
            requestId,
            operation: "sync-alerts-manual",
        },
        async () => {
            try {
                // Verify authentication
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

                // Only SUPERADMIN can manually trigger sync
                const accountType = sessionData.accountType as string
                if (accountType !== "SUPERADMIN") {
                    return NextResponse.json(
                        { error: "Forbidden - SUPERADMIN only" },
                        { status: 403 }
                    )
                }

                // Update MDC context with user info and execute sync
                return MDC.withContextAsync(
                    {
                        userId: sessionData.accountId,
                        accountType: sessionData.accountType,
                        orgId: sessionData.orgId,
                    },
                    async () => {
                        logger.info("🔄 Manual alert sync triggered", { userId: sessionData.accountId })

                        // Execute sync
                        const summary = await syncAllAlerts()

                        return NextResponse.json({
                            success: true,
                            message: "Alert sync completed",
                            summary: {
                                totalVendors: summary.totalVendors,
                                successful: summary.successful,
                                failed: summary.failed,
                                totalAlertsSynced: summary.totalAlertsSynced,
                                totalAlertsCreated: summary.totalAlertsCreated,
                                totalAlertsUpdated: summary.totalAlertsUpdated,
                                duration: summary.duration,
                                results: summary.results.map((r) => ({
                                    vendorId: r.vendorId,
                                    vendorName: r.vendorName,
                                    orgId: r.orgId,
                                    orgName: r.orgName,
                                    success: r.success,
                                    synced: r.synced,
                                    created: r.created,
                                    updated: r.updated,
                                    total: r.total,
                                    error: r.error,
                                })),
                            },
                        })
                    }
                )
            } catch (error: any) {
                logger.error("❌ Manual alert sync error", error)
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
