import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"
import MDC from "@/lib/context/mdc"
import { logger } from "@/lib/context/logger"
import { randomUUID } from "crypto"

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
            return NextResponse.json(
              { error: "Unauthorized" },
              { status: 401 }
            )
          }
        }

        logger.info("[DisableInactivePlants] Starting disable inactive plants process")

        const supabase = getMainClient()

        // Call the disable_inactive_plants() database function
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
          `[DisableInactivePlants] Successfully disabled ${result?.disabled_count || 0} inactive plants. IDs: ${result?.disabled_plant_ids?.join(", ") || "none"}`
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
    }
  )
}

