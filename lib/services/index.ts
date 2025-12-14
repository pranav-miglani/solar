/**
 * Services - Factory Exports
 * 
 * Usage:
 * ```typescript
 * import { getDashboardService } from "@/lib/services"
 * 
 * const dashboardService = getDashboardService()
 * const data = await dashboardService.getDashboardData(context)
 * ```
 * 
 * Feature Toggle Support:
 * - Each service has an environment variable toggle
 * - When set to 'false', returns the legacy adapter instead
 * - Allows instant rollback without code deployment
 */

import { getMainClient } from "@/lib/supabase/pooled"
import { 
  getPlantsRepository, 
  getAlertsRepository, 
  getWorkOrdersRepository, 
  getWorkOrderPlantsRepository 
} from "@/lib/repositories/main"

// =============================================================================
// Service Imports
// =============================================================================

// Phase 21: Dashboard Service
import { DashboardService, IDashboardService } from "./dashboardService"
import { LegacyDashboardAdapter } from "./legacyDashboardAdapter"

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Get the Dashboard Service
 * 
 * Toggle: USE_DASHBOARD_SERVICE (default: true)
 * Set to 'false' to use legacy direct queries for instant rollback
 */
export function getDashboardService(): IDashboardService {
  const useLegacy = process.env.USE_DASHBOARD_SERVICE === 'false'
  
  if (useLegacy) {
    const client = getMainClient()
    return new LegacyDashboardAdapter(client)
  }
  
  // Create DashboardService with repository dependencies
  const plantsRepo = getPlantsRepository()
  const alertsRepo = getAlertsRepository()
  const workOrdersRepo = getWorkOrdersRepository()
  const workOrderPlantsRepo = getWorkOrderPlantsRepository()
  
  return new DashboardService(plantsRepo, alertsRepo, workOrdersRepo, workOrderPlantsRepo)
}

// Re-export types
export type { IDashboardService, DashboardData, DashboardContext, DashboardMetrics, DashboardWidgets } from "./dashboardService"

