/**
 * Main Database Repositories - Factory Exports
 * 
 * Usage:
 * ```typescript
 * import { getAccountsRepository, getOrganizationsRepository } from "@/lib/repositories/main"
 * 
 * const accountsRepo = getAccountsRepository()
 * const accounts = await accountsRepo.findAll()
 * ```
 * 
 * Each factory function returns a repository instance connected to the Main DB.
 * 
 * Feature Toggle Support:
 * - Each repository has an environment variable toggle (e.g., USE_ACCOUNTS_REPO)
 * - When set to 'false', returns the legacy adapter instead
 * - Allows instant rollback without code deployment
 */

import { getMainClient } from "@/lib/supabase/pooled"

// =============================================================================
// Repository Imports
// =============================================================================

// Phase 3: accounts
import { AccountsRepository, IAccountsRepository } from "./accountsRepository"
import { LegacyAccountsAdapter } from "./legacyAdapters/accountsAdapter"

// Phase 4: organizations
import { OrganizationsRepository, IOrganizationsRepository } from "./organizationsRepository"
import { LegacyOrganizationsAdapter } from "./legacyAdapters/organizationsAdapter"

// Phase 6: vendors
import { VendorsRepository, IVendorsRepository } from "./vendorsRepository"
import { LegacyVendorsAdapter } from "./legacyAdapters/vendorsAdapter"

// Phase 8: wms_vendors
import { WmsVendorsRepository, IWmsVendorsRepository } from "./wmsVendorsRepository"
import { LegacyWmsVendorsAdapter } from "./legacyAdapters/wmsVendorsAdapter"

// Phase 9: plants
import { PlantsRepository, IPlantsRepository } from "./plantsRepository"
import { LegacyPlantsAdapter } from "./legacyAdapters/plantsAdapter"

// Phase 11: alerts
import { AlertsRepository, IAlertsRepository } from "./alertsRepository"
import { LegacyAlertsAdapter } from "./legacyAdapters/alertsAdapter"

// Phase 12: wms_sites
import { WmsSitesRepository, IWmsSitesRepository } from "./wmsSitesRepository"
import { LegacyWmsSitesAdapter } from "./legacyAdapters/wmsSitesAdapter"

// Phase 13: wms_devices
import { WmsDevicesRepository, IWmsDevicesRepository } from "./wmsDevicesRepository"
import { LegacyWmsDevicesAdapter } from "./legacyAdapters/wmsDevicesAdapter"

// Phase 14: insolation_readings
import { InsolationReadingsRepository, IInsolationReadingsRepository } from "./insolationReadingsRepository"
import { LegacyInsolationReadingsAdapter } from "./legacyAdapters/insolationReadingsAdapter"

// Phase 18: work_orders
// import { WorkOrdersRepository } from "./workOrdersRepository"

// Phase 19: work_order_plants
// import { WorkOrderPlantsRepository } from "./workOrderPlantsRepository"

// Phase 20: work_logs
// import { WorkLogsRepository } from "./workLogsRepository"

// =============================================================================
// Factory Functions (will be uncommented as repositories are implemented)
// =============================================================================

/**
 * Get the Supabase client for main database.
 * Exposed for cases where direct client access is needed.
 */
export function getClient() {
  return getMainClient()
}

// -----------------------------------------------------------------------------
// Phase 3: Accounts Repository
// Toggle: USE_ACCOUNTS_REPO (default: true)
// Set to 'false' to use legacy adapter for instant rollback
// -----------------------------------------------------------------------------
export function getAccountsRepository(): IAccountsRepository {
  const useLegacy = process.env.USE_ACCOUNTS_REPO === 'false'
  const client = getMainClient()
  
  if (useLegacy) {
    return new LegacyAccountsAdapter(client)
  }
  return new AccountsRepository(client)
}

// -----------------------------------------------------------------------------
// Phase 4: Organizations Repository
// Toggle: USE_ORGS_REPO (default: true)
// Set to 'false' to use legacy adapter for instant rollback
// -----------------------------------------------------------------------------
export function getOrganizationsRepository(): IOrganizationsRepository {
  const useLegacy = process.env.USE_ORGS_REPO === 'false'
  const client = getMainClient()
  
  if (useLegacy) {
    return new LegacyOrganizationsAdapter(client)
  }
  return new OrganizationsRepository(client)
}

// -----------------------------------------------------------------------------
// Phase 6: Vendors Repository
// Toggle: USE_VENDORS_REPO (default: true)
// Set to 'false' to use legacy adapter for instant rollback
// -----------------------------------------------------------------------------
export function getVendorsRepository(): IVendorsRepository {
  const useLegacy = process.env.USE_VENDORS_REPO === 'false'
  const client = getMainClient()
  
  if (useLegacy) {
    return new LegacyVendorsAdapter(client)
  }
  return new VendorsRepository(client)
}

// -----------------------------------------------------------------------------
// Phase 8: WMS Vendors Repository
// Toggle: USE_WMS_VENDORS_REPO (default: true)
// Set to 'false' to use legacy adapter for instant rollback
// -----------------------------------------------------------------------------
export function getWmsVendorsRepository(): IWmsVendorsRepository {
  const useLegacy = process.env.USE_WMS_VENDORS_REPO === 'false'
  const client = getMainClient()
  
  if (useLegacy) {
    return new LegacyWmsVendorsAdapter(client)
  }
  return new WmsVendorsRepository(client)
}

// -----------------------------------------------------------------------------
// Phase 9: Plants Repository
// Toggle: USE_PLANTS_REPO (default: true)
// Set to 'false' to use legacy adapter for instant rollback
// -----------------------------------------------------------------------------
export function getPlantsRepository(): IPlantsRepository {
  const useLegacy = process.env.USE_PLANTS_REPO === 'false'
  const client = getMainClient()
  
  if (useLegacy) {
    return new LegacyPlantsAdapter(client)
  }
  return new PlantsRepository(client)
}

// -----------------------------------------------------------------------------
// Phase 11: Alerts Repository
// Toggle: USE_ALERTS_REPO (default: true)
// Set to 'false' to use legacy adapter for instant rollback
// -----------------------------------------------------------------------------
export function getAlertsRepository(): IAlertsRepository {
  const useLegacy = process.env.USE_ALERTS_REPO === 'false'
  const client = getMainClient()
  
  if (useLegacy) {
    return new LegacyAlertsAdapter(client)
  }
  return new AlertsRepository(client)
}

// -----------------------------------------------------------------------------
// Phase 12: WMS Sites Repository
// Toggle: USE_WMS_SITES_REPO (default: true)
// Set to 'false' to use legacy adapter for instant rollback
// -----------------------------------------------------------------------------
export function getWmsSitesRepository(): IWmsSitesRepository {
  const useLegacy = process.env.USE_WMS_SITES_REPO === 'false'
  const client = getMainClient()
  
  if (useLegacy) {
    return new LegacyWmsSitesAdapter(client)
  }
  return new WmsSitesRepository(client)
}

// -----------------------------------------------------------------------------
// Phase 13: WMS Devices Repository
// Toggle: USE_WMS_DEVICES_REPO (default: true)
// Set to 'false' to use legacy adapter for instant rollback
// -----------------------------------------------------------------------------
export function getWmsDevicesRepository(): IWmsDevicesRepository {
  const useLegacy = process.env.USE_WMS_DEVICES_REPO === 'false'
  const client = getMainClient()
  
  if (useLegacy) {
    return new LegacyWmsDevicesAdapter(client)
  }
  return new WmsDevicesRepository(client)
}

// -----------------------------------------------------------------------------
// Phase 14: Insolation Readings Repository
// Toggle: USE_INSOLATION_REPO (default: true)
// Set to 'false' to use legacy adapter for instant rollback
// -----------------------------------------------------------------------------
export function getInsolationReadingsRepository(): IInsolationReadingsRepository {
  const useLegacy = process.env.USE_INSOLATION_REPO === 'false'
  const client = getMainClient()
  
  if (useLegacy) {
    return new LegacyInsolationReadingsAdapter(client)
  }
  return new InsolationReadingsRepository(client)
}

// -----------------------------------------------------------------------------
// Phase 18: Work Orders Repository
// -----------------------------------------------------------------------------
// export function getWorkOrdersRepository() {
//   return new WorkOrdersRepository(getMainClient())
// }

// -----------------------------------------------------------------------------
// Phase 19: Work Order Plants Repository
// -----------------------------------------------------------------------------
// export function getWorkOrderPlantsRepository() {
//   return new WorkOrderPlantsRepository(getMainClient())
// }

// -----------------------------------------------------------------------------
// Phase 20: Work Logs Repository
// -----------------------------------------------------------------------------
// export function getWorkLogsRepository() {
//   return new WorkLogsRepository(getMainClient())
// }

