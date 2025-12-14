/**
 * Analytics Database Repositories - Factory Exports
 * 
 * Usage:
 * ```typescript
 * import { getAnalyticsOrganizationsRepository } from "@/lib/repositories/analytics"
 * 
 * const orgsRepo = getAnalyticsOrganizationsRepository()
 * const orgs = await orgsRepo.findAll()
 * ```
 * 
 * Each factory function returns a repository instance connected to the Analytics DB.
 * 
 * Feature Toggle Support:
 * - Each repository has an environment variable toggle (e.g., USE_ANALYTICS_ORGS_REPO)
 * - When set to 'false', returns the legacy adapter instead
 * - Allows instant rollback without code deployment
 */

import { getAnalyticsClient } from "@/lib/supabase/pooled"

// =============================================================================
// Repository Imports
// =============================================================================

// Phase 5: organizations (Analytics)
import { AnalyticsOrganizationsRepository, IAnalyticsOrganizationsRepository } from "./organizationsRepository"
import { LegacyAnalyticsOrganizationsAdapter } from "./legacyAdapters/organizationsAdapter"

// Phase 7: vendors (Analytics)
// import { AnalyticsVendorsRepository } from "./vendorsRepository"

// Phase 10: plants (Analytics)
// import { AnalyticsPlantsRepository } from "./plantsRepository"

// Phase 15: plant_energy_readings
// import { PlantEnergyReadingsRepository } from "./plantEnergyReadingsRepository"

// Phase 16: plant_grid_downtime_readings
// import { PlantGridDowntimeReadingsRepository } from "./plantGridDowntimeReadingsRepository"

// Phase 17: analytics_snapshot_runs
// import { AnalyticsSnapshotRunsRepository } from "./snapshotRunsRepository"

// =============================================================================
// Factory Functions (will be uncommented as repositories are implemented)
// =============================================================================

/**
 * Get the Supabase client for analytics database.
 * Exposed for cases where direct client access is needed.
 */
export function getClient() {
  return getAnalyticsClient()
}

// -----------------------------------------------------------------------------
// Phase 5: Analytics Organizations Repository
// Toggle: USE_ANALYTICS_ORGS_REPO (default: true)
// Set to 'false' to use legacy adapter for instant rollback
// -----------------------------------------------------------------------------
export function getAnalyticsOrganizationsRepository(): IAnalyticsOrganizationsRepository {
  const useLegacy = process.env.USE_ANALYTICS_ORGS_REPO === 'false'
  const client = getAnalyticsClient()
  
  if (useLegacy) {
    return new LegacyAnalyticsOrganizationsAdapter(client)
  }
  return new AnalyticsOrganizationsRepository(client)
}

// -----------------------------------------------------------------------------
// Phase 7: Analytics Vendors Repository
// -----------------------------------------------------------------------------
// export function getAnalyticsVendorsRepository() {
//   return new AnalyticsVendorsRepository(getAnalyticsClient())
// }

// -----------------------------------------------------------------------------
// Phase 10: Analytics Plants Repository
// -----------------------------------------------------------------------------
// export function getAnalyticsPlantsRepository() {
//   return new AnalyticsPlantsRepository(getAnalyticsClient())
// }

// -----------------------------------------------------------------------------
// Phase 15: Plant Energy Readings Repository
// -----------------------------------------------------------------------------
// export function getPlantEnergyReadingsRepository() {
//   return new PlantEnergyReadingsRepository(getAnalyticsClient())
// }

// -----------------------------------------------------------------------------
// Phase 16: Plant Grid Downtime Readings Repository
// -----------------------------------------------------------------------------
// export function getPlantGridDowntimeReadingsRepository() {
//   return new PlantGridDowntimeReadingsRepository(getAnalyticsClient())
// }

// -----------------------------------------------------------------------------
// Phase 17: Analytics Snapshot Runs Repository
// -----------------------------------------------------------------------------
// export function getAnalyticsSnapshotRunsRepository() {
//   return new AnalyticsSnapshotRunsRepository(getAnalyticsClient())
// }

