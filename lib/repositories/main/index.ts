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
 */

import { getMainClient } from "@/lib/supabase/pooled"

// =============================================================================
// Repository Imports (will be added as repositories are implemented)
// =============================================================================

// Phase 3: accounts
// import { AccountsRepository } from "./accountsRepository"

// Phase 4: organizations
// import { OrganizationsRepository } from "./organizationsRepository"

// Phase 6: vendors
// import { VendorsRepository } from "./vendorsRepository"

// Phase 8: wms_vendors
// import { WmsVendorsRepository } from "./wmsVendorsRepository"

// Phase 9: plants
// import { PlantsRepository } from "./plantsRepository"

// Phase 11: alerts
// import { AlertsRepository } from "./alertsRepository"

// Phase 12: wms_sites
// import { WmsSitesRepository } from "./wmsSitesRepository"

// Phase 13: wms_devices
// import { WmsDevicesRepository } from "./wmsDevicesRepository"

// Phase 14: insolation_readings
// import { InsolationReadingsRepository } from "./insolationReadingsRepository"

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
// -----------------------------------------------------------------------------
// export function getAccountsRepository() {
//   return new AccountsRepository(getMainClient())
// }

// -----------------------------------------------------------------------------
// Phase 4: Organizations Repository
// -----------------------------------------------------------------------------
// export function getOrganizationsRepository() {
//   return new OrganizationsRepository(getMainClient())
// }

// -----------------------------------------------------------------------------
// Phase 6: Vendors Repository
// -----------------------------------------------------------------------------
// export function getVendorsRepository() {
//   return new VendorsRepository(getMainClient())
// }

// -----------------------------------------------------------------------------
// Phase 8: WMS Vendors Repository
// -----------------------------------------------------------------------------
// export function getWmsVendorsRepository() {
//   return new WmsVendorsRepository(getMainClient())
// }

// -----------------------------------------------------------------------------
// Phase 9: Plants Repository
// -----------------------------------------------------------------------------
// export function getPlantsRepository() {
//   return new PlantsRepository(getMainClient())
// }

// -----------------------------------------------------------------------------
// Phase 11: Alerts Repository
// -----------------------------------------------------------------------------
// export function getAlertsRepository() {
//   return new AlertsRepository(getMainClient())
// }

// -----------------------------------------------------------------------------
// Phase 12: WMS Sites Repository
// -----------------------------------------------------------------------------
// export function getWmsSitesRepository() {
//   return new WmsSitesRepository(getMainClient())
// }

// -----------------------------------------------------------------------------
// Phase 13: WMS Devices Repository
// -----------------------------------------------------------------------------
// export function getWmsDevicesRepository() {
//   return new WmsDevicesRepository(getMainClient())
// }

// -----------------------------------------------------------------------------
// Phase 14: Insolation Readings Repository
// -----------------------------------------------------------------------------
// export function getInsolationReadingsRepository() {
//   return new InsolationReadingsRepository(getMainClient())
// }

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

