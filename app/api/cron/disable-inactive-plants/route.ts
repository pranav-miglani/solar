import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { randomUUID } from "crypto"
import { logApiRequestResponse } from "@/lib/middleware/api-logging"

/**
 * Cron endpoint for disabling inactive plants
 * 
 * This endpoint can be triggered by:
 * 1. Server-side cron job (node-cron)
 * 2. External cron services (GitHub Actions, cron-job.org, etc.)
 * 3. Manual trigger via API call
 * 
 * Security: Should be protected with a secret token
 */

// Mark route as dynamic (cron endpoints are always dynamic)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return logApiRequestResponse(request, async () => {
    const requestId = randomUUID()
    
    return MDC.runAsync(
    {
      source: "cron",
      requestId,
      operation: "disable-inactive-plants",
    },
    async () => {
      try {
        // Verify cron secret (if configured)
        const cronSecret = process.env.CRON_SECRET
        const authHeader = request.headers.get("authorization")

        if (cronSecret) {
          if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
            logger.warn("[Auth Check] Disable Inactive Plants: CRON_SECRET mismatch or missing", {
              hasAuthHeader: !!authHeader,
              authHeaderPrefix: authHeader?.substring(0, 10),
            })
            return NextResponse.json(
              { error: "Unauthorized" },
              { status: 401 }
            )
          }
          logger.info("[Auth Check] Disable Inactive Plants: Authorized via CRON_SECRET")
        } else {
          logger.debug("[Auth Check] Disable Inactive Plants: CRON_SECRET not configured, allowing request")
        }

        logger.info("[DisableInactivePlants] Starting disable inactive plants process")

        const supabase = getMainClient()

        // First, check plants that should be disabled but aren't (for debugging)
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        
        // Get all active plants with old last_update_time
        const { data: plantsWithOldUpdate, error: oldUpdateError } = await supabase
          .from("plants")
          .select("id, name, vendor_plant_id, last_update_time, created_at, is_active, org_id, vendor_id")
          .eq("is_active", true)
          .lt("last_update_time", threeDaysAgo)
        
        // Get all active plants with null last_update_time and old created_at
        const { data: plantsWithNullUpdate, error: nullUpdateError } = await supabase
          .from("plants")
          .select("id, name, vendor_plant_id, last_update_time, created_at, is_active, org_id, vendor_id")
          .eq("is_active", true)
          .is("last_update_time", null)
          .lt("created_at", threeDaysAgo)
        
        const plantsToCheck = [
          ...(plantsWithOldUpdate || []),
          ...(plantsWithNullUpdate || [])
        ]
        const checkError = oldUpdateError || nullUpdateError

        if (!checkError && plantsToCheck) {
          logger.info(`[DisableInactivePlants] Found ${plantsToCheck.length} active plants that should be disabled:`)
          plantsToCheck.forEach((plant: any) => {
            const daysSinceUpdate = plant.last_update_time 
              ? Math.floor((Date.now() - new Date(plant.last_update_time).getTime()) / (1000 * 60 * 60 * 24))
              : null
            const daysSinceCreated = Math.floor((Date.now() - new Date(plant.created_at).getTime()) / (1000 * 60 * 60 * 24))
            logger.info(`[DisableInactivePlants]   - Plant ID: ${plant.id}, Name: ${plant.name}, Vendor Plant ID: ${plant.vendor_plant_id}, Last Update: ${plant.last_update_time || 'NULL'}, Days Since Update: ${daysSinceUpdate || 'N/A'}, Days Since Created: ${daysSinceCreated}, is_active: ${plant.is_active}`)
          })
        } else if (checkError) {
          logger.warn(`[DisableInactivePlants] Error checking plants to disable: ${checkError.message}`)
        }

        // Also check plants that are already disabled
        const { data: disabledPlants, error: disabledError } = await supabase
          .from("disabled_plants")
          .select("plant_id, name, disabled_at, days_since_refresh")
          .order("disabled_at", { ascending: false })
          .limit(10)

        if (!disabledError && disabledPlants) {
          logger.info(`[DisableInactivePlants] Recently disabled plants (last 10): ${disabledPlants.length} found`)
          disabledPlants.forEach((dp: any) => {
            logger.info(`[DisableInactivePlants]   - Plant ID: ${dp.plant_id}, Name: ${dp.name}, Disabled At: ${dp.disabled_at}, Days Since Refresh: ${dp.days_since_refresh}`)
          })
        }

        // Call the disable_inactive_plants() database function
        logger.info("[DisableInactivePlants] Calling disable_inactive_plants() database function...")
        const { data, error } = await supabase.rpc("disable_inactive_plants")

        if (error) {
          logger.error("[DisableInactivePlants] Error calling disable_inactive_plants:", error)
          return NextResponse.json(
            {
              success: false,
              error: error.message,
            },
            { status: 500 }
          )
        }

        const result = data as { disabled_count: number; disabled_plant_ids: number[] } | null

        logger.info(
          `[DisableInactivePlants] Database function returned: disabled_count=${result?.disabled_count || 0}, disabled_plant_ids=[${result?.disabled_plant_ids?.join(", ") || "none"}]`
        )

        // Verify the disabled plants were actually created in disabled_plants table
        if (result && result.disabled_plant_ids && result.disabled_plant_ids.length > 0) {
          const { data: verifyDisabled, error: verifyError } = await supabase
            .from("disabled_plants")
            .select("id, plant_id, name, disabled_at, days_since_refresh")
            .in("plant_id", result.disabled_plant_ids)

          if (!verifyError && verifyDisabled) {
            logger.info(`[DisableInactivePlants] Verified ${verifyDisabled.length} plants in disabled_plants table:`)
            verifyDisabled.forEach((dp: any) => {
              logger.info(`[DisableInactivePlants]   - Disabled Plant ID: ${dp.id}, Plant ID: ${dp.plant_id}, Name: ${dp.name}, Disabled At: ${dp.disabled_at}, Days Since Refresh: ${dp.days_since_refresh}`)
            })
          } else if (verifyError) {
            logger.error(`[DisableInactivePlants] Error verifying disabled plants: ${verifyError.message}`)
          }
        }

        // Check if any plants are still active but should be disabled (after function call)
        const threeDaysAgoAfter = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        
        const { data: stillActiveOldUpdate, error: stillActiveOldError } = await supabase
          .from("plants")
          .select("id, name, vendor_plant_id, last_update_time, created_at, is_active")
          .eq("is_active", true)
          .lt("last_update_time", threeDaysAgoAfter)
          .limit(10)
        
        const { data: stillActiveNullUpdate, error: stillActiveNullError } = await supabase
          .from("plants")
          .select("id, name, vendor_plant_id, last_update_time, created_at, is_active")
          .eq("is_active", true)
          .is("last_update_time", null)
          .lt("created_at", threeDaysAgoAfter)
          .limit(10)
        
        const stillActive = [
          ...(stillActiveOldUpdate || []),
          ...(stillActiveNullUpdate || [])
        ]
        const stillActiveError = stillActiveOldError || stillActiveNullError

        if (!stillActiveError && stillActive && stillActive.length > 0) {
          logger.warn(`[DisableInactivePlants] ⚠️ Found ${stillActive.length} plants that should be disabled but are still active:`)
          stillActive.forEach((plant: any) => {
            const daysSinceUpdate = plant.last_update_time 
              ? Math.floor((Date.now() - new Date(plant.last_update_time).getTime()) / (1000 * 60 * 60 * 24))
              : null
            logger.warn(`[DisableInactivePlants]   - Plant ID: ${plant.id}, Name: ${plant.name}, Last Update: ${plant.last_update_time || 'NULL'}, Days Since Update: ${daysSinceUpdate || 'N/A'}, is_active: ${plant.is_active}`)
          })
        } else if (!stillActiveError && stillActive && stillActive.length === 0) {
          logger.info(`[DisableInactivePlants] ✅ No active plants found that should be disabled (all caught up)`)
        }

        logger.info(
          `[DisableInactivePlants] ✅ Process completed. Disabled ${result?.disabled_count || 0} inactive plants.`
        )

        return NextResponse.json({
          success: true,
          disabled_count: result?.disabled_count || 0,
          disabled_plant_ids: result?.disabled_plant_ids || [],
          message: `Successfully disabled ${result?.disabled_count || 0} inactive plants`,
        })
      } catch (error: any) {
        logger.error("[DisableInactivePlants] Error in disable inactive plants endpoint:", error)
        return NextResponse.json(
          {
            success: false,
            error: error.message || "Internal server error",
          },
          { status: 500 }
        )
      }
    })
  })
}

