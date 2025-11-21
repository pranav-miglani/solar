import { VendorManager } from "@/lib/vendors/vendorManager"
import type { VendorConfig, Alert } from "@/lib/vendors/types"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { getMainClient } from "@/lib/supabase/pooled"

/**
 * Alert Sync Service
 * Generic service for syncing alerts from all vendors across all organizations
 */

interface SyncResult {
    vendorId: number
    vendorName: string
    orgId: number
    orgName?: string
    success: boolean
    synced: number
    created: number
    updated: number
    total: number
    error?: string
}

interface SyncSummary {
    totalVendors: number
    successful: number
    failed: number
    totalAlertsSynced: number
    totalAlertsCreated: number
    totalAlertsUpdated: number
    results: SyncResult[]
    duration: number
}

/**
 * Validate and refresh token for a vendor adapter
 */
async function validateAndRefreshToken(
    adapter: any,
    vendorId: number,
    supabase: any
): Promise<boolean> {
    try {
        // Check if adapter supports token storage
        if (typeof adapter.setTokenStorage === "function") {
            adapter.setTokenStorage(vendorId, supabase)
        }

        // Try to authenticate (will use cached token if valid)
        try {
            await adapter.authenticate()
            return true
        } catch (authError: any) {
            console.error(`[AlertSync] Token validation failed for vendor ${vendorId}:`, authError.message)
            return false
        }
    } catch (error: any) {
        console.error(`[AlertSync] Error validating token for vendor ${vendorId}:`, error.message)
        return false
    }
}

/**
 * Sync alerts for a single vendor
 */
async function syncVendorAlerts(
    vendor: any,
    supabase: any
): Promise<SyncResult> {
    const startTime = Date.now()
    const result: SyncResult = {
        vendorId: vendor.id,
        vendorName: vendor.name,
        orgId: vendor.org_id,
        success: false,
        synced: 0,
        created: 0,
        updated: 0,
        total: 0,
    }

    try {
        // Get organization name
        if (vendor.org_id) {
            const { data: org } = await supabase
                .from("organizations")
                .select("name")
                .eq("id", vendor.org_id)
                .single()
            result.orgName = org?.name
        }

        // Create vendor adapter
        const vendorConfig: VendorConfig = {
            id: vendor.id,
            name: vendor.name,
            vendorType: vendor.vendor_type as "SOLARMAN" | "SUNGROW" | "OTHER",
            credentials: vendor.credentials as Record<string, any>,
            isActive: vendor.is_active,
            metadata: vendor.metadata || {},
        }

        const adapter = VendorManager.getAdapter(vendorConfig)

        // Set token storage
        if (typeof (adapter as any).setTokenStorage === "function") {
            (adapter as any).setTokenStorage(vendor.id, supabase)
        }

        // Validate token
        const tokenValid = await validateAndRefreshToken(adapter, vendor.id, supabase)
        if (!tokenValid) {
            result.error = "Token validation/refresh failed"
            return result
        }

        // Fetch active plants for this vendor
        const { data: plants, error: plantsError } = await supabase
            .from("plants")
            .select("id, vendor_plant_id, name")
            .eq("vendor_id", vendor.id)
            .eq("is_active", true) // Only sync active plants? Assuming yes.

        if (plantsError) {
            throw new Error(`Failed to fetch plants for vendor ${vendor.id}: ${plantsError.message}`)
        }

        if (!plants || plants.length === 0) {
            result.success = true
            logger.info(`No plants found for vendor ${vendor.name}`)
            return result
        }

        logger.info(`Syncing alerts for ${plants.length} plants for vendor ${vendor.name}`)

        // Sync alerts for each plant
        let created = 0
        let updated = 0
        const errors: string[] = []

        // Process plants sequentially to avoid rate limits, or in small batches
        // Solarman might have rate limits. Sequential is safer for now.
        for (const plant of plants) {
            try {
                // Fetch alerts from vendor
                // We pass undefined for dates to let the adapter handle defaults (1 year ago)
                const alerts = await adapter.getAlerts(plant.vendor_plant_id)

                if (alerts.length > 0) {
                    // Upsert alerts
                    for (const alert of alerts) {
                        // Check if alert exists
                        const { data: existing } = await supabase
                            .from("alerts")
                            .select("id")
                            .eq("vendor_alert_id", alert.vendorAlertId)
                            .eq("plant_id", plant.id)
                            .single()

                        const alertData = {
                            plant_id: plant.id,
                            vendor_plant_id: plant.vendor_plant_id,
                            vendor_alert_id: alert.vendorAlertId,
                            title: alert.title,
                            description: alert.description,
                            severity: alert.severity,
                            status: alert.status,
                            alert_time: alert.alertTime?.toISOString(),
                            end_time: alert.endTime?.toISOString(),
                            duration_seconds: alert.durationSeconds,
                            device_sn: alert.deviceSn,
                            device_type: alert.deviceType,
                            metadata: alert.metadata,
                            updated_at: new Date().toISOString(),
                        }

                        if (existing) {
                            const { error: updateError } = await supabase
                                .from("alerts")
                                .update(alertData)
                                .eq("id", existing.id)

                            if (updateError) throw updateError
                            updated++
                        } else {
                            const { error: insertError } = await supabase
                                .from("alerts")
                                .insert(alertData)

                            if (insertError) throw insertError
                            created++
                        }
                    }
                }

                result.total += alerts.length
            } catch (plantError: any) {
                errors.push(`Plant ${plant.name}: ${plantError.message}`)
            }
        }

        result.success = errors.length === 0
        result.synced = created + updated
        result.created = created
        result.updated = updated

        if (errors.length > 0) {
            result.error = `Errors: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "..." : ""}`
        }

        const duration = Date.now() - startTime
        logger.info(
            `✅ Vendor ${vendor.name}: ${result.synced} alerts synced (${created} created, ${updated} updated) in ${duration}ms`
        )

        return result
    } catch (error: any) {
        logger.error(`❌ Error syncing alerts for vendor ${vendor.name}`, error)
        result.error = error.message || "Unknown error"
        return result
    }
}

/**
 * Check if an organization should be synced based on clock time and interval
 */
function shouldSyncOrg(org: any): boolean {
    if (!org.auto_sync_enabled) {
        return false
    }

    const intervalMinutes = org.sync_interval_minutes || 15

    const now = new Date()
    const kolkataTime = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(now)

    const currentMinute = parseInt(kolkataTime.find((part) => part.type === "minute")?.value || "0")

    const currentInterval = Math.floor(currentMinute / intervalMinutes)
    const expectedMinute = currentInterval * intervalMinutes
    return currentMinute === expectedMinute
}

/**
 * Sync alerts for all active vendors across all organizations
 */
export async function syncAllAlerts(): Promise<SyncSummary> {
    const startTime = Date.now()
    const supabase = getMainClient()
    const source = MDC.getSource() || "system"

    logger.info(`🚀 Starting alert sync (source: ${source})...`)

    // Fetch all active vendors with their organization sync settings
    const { data: vendors, error: vendorsError } = await supabase
        .from("vendors")
        .select(`
      *,
      organizations (
        id,
        name,
        auto_sync_enabled,
        sync_interval_minutes
      )
    `)
        .eq("is_active", true)
        .not("org_id", "is", null)

    if (vendorsError) {
        throw new Error(`Failed to fetch vendors: ${vendorsError.message}`)
    }

    if (!vendors || vendors.length === 0) {
        logger.info("No active vendors found")
        return {
            totalVendors: 0,
            successful: 0,
            failed: 0,
            totalAlertsSynced: 0,
            totalAlertsCreated: 0,
            totalAlertsUpdated: 0,
            results: [],
            duration: Date.now() - startTime,
        }
    }

    // Filter vendors by organization sync settings
    const vendorsToSync: any[] = []

    for (const vendor of vendors) {
        const org = vendor.organizations
        if (!org) continue

        if (shouldSyncOrg(org)) {
            vendorsToSync.push(vendor)
        }
    }

    if (vendorsToSync.length === 0) {
        logger.info("No organizations to sync alerts at this time")
        return {
            totalVendors: vendors.length,
            successful: 0,
            failed: 0,
            totalAlertsSynced: 0,
            totalAlertsCreated: 0,
            totalAlertsUpdated: 0,
            results: [],
            duration: Date.now() - startTime,
        }
    }

    logger.info(`Processing ${vendorsToSync.length} vendor(s) for alert sync`)

    // Process vendors in parallel
    const results = await Promise.all(
        vendorsToSync.map((vendor) =>
            MDC.withContextAsync(
                {
                    vendorId: vendor.id,
                    vendorName: vendor.name,
                    orgId: vendor.org_id,
                    operation: `sync-alerts-vendor-${vendor.id}`,
                },
                () => syncVendorAlerts(vendor, supabase)
            )
        )
    )

    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length
    const totalAlertsSynced = results.reduce((sum, r) => sum + r.synced, 0)
    const totalAlertsCreated = results.reduce((sum, r) => sum + r.created, 0)
    const totalAlertsUpdated = results.reduce((sum, r) => sum + r.updated, 0)

    const summary: SyncSummary = {
        totalVendors: vendorsToSync.length,
        successful,
        failed,
        totalAlertsSynced,
        totalAlertsCreated,
        totalAlertsUpdated,
        results,
        duration: Date.now() - startTime,
    }

    logger.info(
        `✅ Alert sync complete: ${successful}/${vendorsToSync.length} vendors successful, ` +
        `${totalAlertsSynced} alerts synced in ${summary.duration}ms`
    )

    return summary
}
