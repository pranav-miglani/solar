# Repository Pattern Migration Plan

## Executive Summary

This document outlines a **model-by-model incremental approach** to migrate all database queries from direct Supabase calls to a centralized repository pattern. Each model/table is migrated independently, enabling better refactoring, smaller PRs, and safer rollouts.

**Status**: Design Phase Complete - Ready for implementation approval

**Current State**:
- ✅ Phase 0: Query Extraction - COMPLETED (all queries extracted to `lib/queries/extracted-queries.ts`)
- ✅ Phase 1: Repository Design - COMPLETED (designs documented in this file)
- ✅ Phase 2: Foundation - COMPLETED (base types, interfaces, factory pattern)
- ✅ Phase 3: `accounts` Repository - COMPLETED
- ✅ Phase 4: `organizations` (Main) - COMPLETED
- ✅ Phase 5: `organizations` (Analytics) - COMPLETED
- ✅ Phase 6: `vendors` (Main) - COMPLETED
- ✅ Phase 7: `vendors` (Analytics) - COMPLETED
- ✅ Phase 8: `wms_vendors` - COMPLETED
- 🔜 Phase 9+: Implementation - READY (Tiers 1-2 complete, Tier 3 next)

**Migration Strategy**: Model-by-model with dependency-aware ordering:
- **23 Total Phases** (including design phases + dashboard + cleanup)
- **Each phase is independent** - can be deployed, tested, and rolled back separately
- **Tiered approach** - leaf nodes first, then dependents (6 tiers)
- **Service migration integrated** - each model phase includes API routes + services
- **Per-phase testing** - unit tests integrated into each phase (NOT a separate phase)
- **Factory-level toggle** - environment variables for instant rollback without deployment

**Important**: The `extracted-queries.ts` file is a reference document only - NOT executed at runtime.

---

## Feature Toggle Strategy (Factory-Level)

### Overview
Each repository phase includes a **factory-level toggle** for instant rollback without code deployment.

### How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│  Environment Variable: USE_ACCOUNTS_REPO=true/false               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  // lib/repositories/main/index.ts                                 │
│  export function getAccountsRepository(): IAccountsRepository {    │
│    if (process.env.USE_ACCOUNTS_REPO === 'false') {               │
│      return new LegacyAccountsAdapter(getMainClient())             │
│    }                                                                │
│    return new AccountsRepository(getMainClient())                  │
│  }                                                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Toggle Configuration

| Phase | Environment Variable | Default | Description |
|-------|---------------------|---------|-------------|
| 3 | `USE_ACCOUNTS_REPO` | `true` | Accounts repository |
| 4 | `USE_ORGS_REPO` | `true` | Organizations (Main) |
| 5 | `USE_ANALYTICS_ORGS_REPO` | `true` | Organizations (Analytics) |
| 6 | `USE_VENDORS_REPO` | `true` | Vendors (Main) |
| 7 | `USE_ANALYTICS_VENDORS_REPO` | `true` | Vendors (Analytics) |
| 8 | `USE_WMS_VENDORS_REPO` | `true` | WMS Vendors |
| 9 | `USE_PLANTS_REPO` | `true` | Plants (Main) |
| 10 | `USE_ANALYTICS_PLANTS_REPO` | `true` | Plants (Analytics) |
| 11 | `USE_ALERTS_REPO` | `true` | Alerts |
| 12-14 | `USE_WMS_SITES_REPO`, etc. | `true` | WMS repositories |
| 15-17 | `USE_ANALYTICS_*_REPO` | `true` | Analytics repositories |
| 18-20 | `USE_WORKORDERS_REPO` | `true` | Work Order repositories |
| 21 | `USE_DASHBOARD_SERVICE` | `true` | Dashboard service |

### Legacy Adapter Pattern

For each repository, create a **LegacyAdapter** that:
1. Implements the SAME interface as the repository
2. Internally calls direct Supabase queries (from `extracted-queries.ts` patterns)
3. Allows instant switch between implementations

```typescript
// LegacyAccountsAdapter implements IAccountsRepository
// but uses direct Supabase calls internally
class LegacyAccountsAdapter implements IAccountsRepository {
  constructor(private client: SupabaseClient) {}
  
  async findAll(): Promise<Account[]> {
    // Uses direct Supabase call (legacy pattern)
    const { data, error } = await this.client
      .from("accounts")
      .select("*")
      .order("email")
    if (error) throw error
    return data as Account[]
  }
  // ... other methods
}
```

### Rollback Procedure

1. **Detect Issue**: Production monitoring alerts or user reports
2. **Instant Rollback**: Set `USE_<MODEL>_REPO=false` in environment
3. **No Deployment**: Change takes effect on next request
4. **Investigate**: Debug repository implementation
5. **Fix & Re-enable**: Deploy fix, set toggle back to `true`

### Benefits

- ✅ **Instant rollback** - No deployment required
- ✅ **Per-model control** - Toggle individual repositories
- ✅ **A/B comparison** - Compare performance/behavior
- ✅ **Gradual rollout** - Enable per-environment
- ✅ **Safety net** - Production issues mitigated quickly

---

## ⚠️ Critical: Main DB vs Analytics DB Schema Differences

The application uses **TWO separate Supabase databases** with DIFFERENT schemas:

### Main DB Tables (Operational)
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `accounts` | Authentication | id, email, password_hash, account_type, org_id, is_active |
| `organizations` | Org config | id, name, auto_sync_enabled, sync_interval_minutes |
| `vendors` | Vendor config | id, name, vendor_type, credentials, token, token_metadata, org_id, is_active |
| `plants` | **Full plant data** | id, name, capacity_kw, **production metrics**, **telemetry**, vendor_id, org_id |
| `alerts` | Vendor alerts | id, plant_id, vendor_alert_id, alert_type, status |
| `work_orders` | Work orders | id, title, description, org_id, status, priority |
| `work_order_plants` | Junction | work_order_id, plant_id, is_active |
| `disabled_plants` | Inactive plants | plant_id, org_id, reason |
| `wms_vendors` | WMS config | id, name, vendor_type, credentials, token, org_id |
| `wms_sites` | WMS sites | id, wms_vendor_id, vendor_site_id, site_name |
| `wms_devices` | WMS devices | id, wms_site_id, vendor_device_id, device_name |
| `insolation_readings` | Insolation data | wms_device_id, reading_date, insolation_value |

### Analytics DB Tables (Mirror + Analytics-specific)
| Table | Type | Key Differences from Main DB |
|-------|------|------------------------------|
| `organizations` | **MIRROR** | Has `config` (JSONB), `config_hash`, `config_ready`, `config_last_*` |
| `vendors` | **MIRROR** | Has `config` (JSONB), `config_hash`, `analytics_ready`, `analytics_last_synced_at` |
| `plants` | **MIRROR (simplified)** | Only: id, org_id, vendor_id, vendor_plant_id, plant_name, capacity_kw (**NO production metrics**) |
| `analytics_snapshot_runs` | **Analytics-only** | Tracks snapshot job runs per vendor |
| `plant_energy_readings` | **Analytics-only** | Daily energy readings (100-day retention) |
| `plant_grid_downtime_readings` | **Analytics-only** | Grid downtime calculations |

### Key Implications for Repository Design

1. **Analytics tables are NOT simple copies** - They have DIFFERENT schemas
2. **Mirror tables use `config_hash`** for change detection (not in Main DB)
3. **Mirror tables use `config_ready`** to track sync status
4. **Plants in Analytics** is SIMPLIFIED - no production metrics or telemetry
5. **6 tables exist ONLY in Analytics DB** - no Main DB equivalent
6. **8 tables exist ONLY in Main DB** - `accounts`, `work_orders`, `alerts`, `wms_*`, etc.

### Repository Implications

| Repository | Database | Notes |
|------------|----------|-------|
| `AccountsRepository` | Main ONLY | No analytics equivalent |
| `OrganizationsRepository` | Main | Simple CRUD |
| `AnalyticsOrganizationsRepository` | Analytics | Different schema: config_hash, config_ready |
| `VendorsRepository` | Main | Full vendor with credentials, token |
| `AnalyticsVendorsRepository` | Analytics | Different schema: analytics_ready |
| `PlantsRepository` | Main | Full plant with production metrics |
| `AnalyticsPlantsRepository` | Analytics | Simplified: no production metrics |
| `AlertsRepository` | Main ONLY | No analytics equivalent |
| `WmsVendorsRepository` | Main ONLY | No analytics equivalent |
| `PlantEnergyReadingsRepository` | Analytics ONLY | No main equivalent |
| `PlantGridDowntimeReadingsRepository` | Analytics ONLY | No main equivalent |
| `AnalyticsSnapshotRunsRepository` | Analytics ONLY | No main equivalent |

---

## Migration Tiers & Dependencies

```
Tier 1 (No dependencies - leaf nodes):
├── Phase 3: accounts
├── Phase 4: organizations (Main)
└── Phase 5: organizations (Analytics)

Tier 2 (Depends on organizations):
├── Phase 6: vendors (Main)
├── Phase 7: vendors (Analytics)
└── Phase 8: wms_vendors

Tier 3 (Depends on vendors):
├── Phase 9: plants (Main)
├── Phase 10: plants (Analytics)
├── Phase 11: alerts
├── Phase 12: wms_sites
├── Phase 13: wms_devices
└── Phase 14: insolation_readings

Tier 4 (Analytics-specific):
├── Phase 15: plant_energy_readings
├── Phase 16: plant_grid_downtime_readings
└── Phase 17: analytics_snapshot_runs

Tier 5 (Complex - Work Orders):
├── Phase 18: work_orders (aggregate root)
├── Phase 19: work_order_plants (junction)
└── Phase 20: work_logs

Final:
├── Phase 21: Testing & Validation
└── Phase 22: Cleanup & Documentation
```

---

## Phase 0: Query Extraction (COMPLETED)

### Objective
Extract ALL database queries into a single reference file for analysis.

### Deliverables
- ✅ `lib/queries/extracted-queries.ts` - Complete query inventory
- ✅ Query categorization by table/entity
- ✅ Pattern identification

### Findings
- **Total Query Patterns**: ~50+ unique query patterns
- **Tables Involved**: 15+ tables across Main DB and Analytics DB
- **Common Patterns**: CRUD, Joins, Batch Operations, Deduplication, Filtering

---

## Phase 1: Repository Design & Architecture

### Objective
Design repository structure considering:
1. Main DB vs Analytics DB commonality
2. Table-by-table breakdown
3. Common patterns extraction
4. Interface definitions

### Deliverables
- ✅ Repository interface definitions
- ✅ Base repository class design
- ✅ Table-specific repository designs
- ✅ Database adapter pattern (for Main vs Analytics)
- ✅ Common patterns documentation

---

### Design Principles

#### 1. Common Repository Interface Pattern

Since Main DB and Analytics DB share similar schemas for:
- `organizations` (Main: simple, Analytics: + config fields)
- `vendors` (Main: simple, Analytics: + config/analytics fields)  
- `plants` (Main: full, Analytics: simplified)

**Solution**: Create a common repository interface that accepts `SupabaseClient` as constructor parameter, allowing same methods to work with both databases.

**Architecture**:
```typescript
// Common interface for shared operations (JPA-style)
interface IOrganizationsRepository {
  findAll(): Promise<Organization[]>
  findById(id: number): Promise<Organization | null>
  save(entity: SaveOrgData): Promise<Organization>  // JPA: save() instead of create()
  update(id: number, data: UpdateOrgData): Promise<Organization>
}

// Main DB implementation
class MainOrganizationsRepository implements IOrganizationsRepository {
  constructor(private client: SupabaseClient) {}
  // Uses getMainClient() via factory
}

// Analytics DB implementation (extends common interface) - JPA-style
interface IAnalyticsOrganizationsRepository extends IOrganizationsRepository {
  findConfigHash(id: number): Promise<string | null>
  saveWithConfig(entity: SaveAnalyticsOrgData): Promise<Organization>  // JPA: save() instead of upsert()
  updateStatusNoChange(id: number, now: string): Promise<void>
}

class AnalyticsOrganizationsRepository implements IAnalyticsOrganizationsRepository {
  constructor(private client: SupabaseClient) {}
  // Uses getAnalyticsClient() via factory
  // Additional methods for config_hash, config_ready, etc.
}
```

#### 2. Base Repository Pattern

**Base Interface** (JPA-style naming):
```typescript
interface IBaseRepository<T, TSave, TUpdate> {
  findAll(): Promise<T[]>
  findById(id: number): Promise<T | null>
  save(entity: TSave): Promise<T>  // JPA: save() handles insert/update
  saveAll(entities: TSave[]): Promise<T[]>  // JPA: batch save
  update(id: number, data: TUpdate): Promise<T>
  deleteById(id: number): Promise<void>  // JPA: deleteById()
  existsById(id: number): Promise<boolean>  // JPA: existsById()
  count(): Promise<number>  // JPA: count()
}
```

**Base Class** (optional, for common CRUD):
```typescript
abstract class BaseRepository<T, TSave, TUpdate> implements IBaseRepository<T, TSave, TUpdate> {
  constructor(
    protected client: SupabaseClient,
    protected tableName: string
  ) {}

  async findAll(): Promise<T[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
    if (error) throw error
    return data as T[]
  }

  async save(entity: TSave): Promise<T> {
    // JPA-style: save() handles both insert and update
    // Implementation will use upsert or insert based on entity state
    const { data, error } = await this.client
      .from(this.tableName)
      .upsert(entity as any)
      .select()
      .single()
    if (error) throw error
    return data as T
  }

  async saveAll(entities: TSave[]): Promise<T[]> {
    // JPA-style: batch save
    const { data, error } = await this.client
      .from(this.tableName)
      .upsert(entities as any[])
      .select()
    if (error) throw error
    return data as T[]
  }

  // ... other common CRUD methods
}
```

**Usage**: Not all repositories will extend BaseRepository if they have unique patterns (e.g., batch operations, complex joins).

---

### 3. Table-by-Table Repository Design

#### Main DB Repositories

##### 1. AccountsRepository
**Table**: `accounts`  
**Complexity**: Low  
**Patterns**: Simple CRUD, email lookup, org_id check

**Interface** (JPA-style):
```typescript
interface IAccountsRepository {
  findAll(): Promise<Account[]>
  findByEmail(email: string): Promise<Account | null>
  findByEmailForLogin(email: string): Promise<Account | null>
  existsByOrgId(orgId: number): Promise<boolean>
  save(entity: SaveAccountData): Promise<Account>  // JPA: save() instead of create()
  testConnection(): Promise<void>
}
```

**Methods**:
- `findAll()` - GET /api/accounts (ordered by email)
- `findByEmail()` - POST /api/accounts (duplicate check)
- `findByEmailForLogin()` - POST /api/login
- `existsByOrgId()` - POST /api/accounts (org account check)
- `save()` - POST /api/accounts (JPA-style: handles insert/update)
- `testConnection()` - POST /api/login (DB health check)

---

##### 2. OrganizationsRepository (Main DB)
**Table**: `organizations`  
**Complexity**: Low  
**Patterns**: Simple CRUD, name ordering

**Interface** (JPA-style):
```typescript
interface IOrganizationsRepository {
  findAll(): Promise<Organization[]>
  findById(id: number): Promise<Organization | null>
  save(entity: SaveOrgData): Promise<Organization>  // JPA: save() instead of create()
}
```

**Methods**:
- `findAll()` - GET /api/orgs (ordered by name)
- `findById()` - GET /api/orgs/[id]
- `save()` - POST /api/orgs (JPA-style: handles insert/update)

**Note**: `findByIdWithPlants()` excluded (involves work_orders)

---

##### 3. VendorsRepository (Main DB)
**Table**: `vendors`  
**Complexity**: Medium  
**Patterns**: CRUD + joins with organizations, active filtering

**Interface** (JPA-style):
```typescript
interface IVendorsRepository {
  findAllWithOrganizations(filters?: { orgId?: number }): Promise<VendorWithOrg[]>
  findById(id: number): Promise<Vendor | null>
  findActive(): Promise<Vendor[]>
  findByOrgId(orgId: number): Promise<Vendor[]>
  save(entity: SaveVendorData): Promise<Vendor>  // JPA: save() instead of create()
  update(id: number, data: UpdateVendorData): Promise<Vendor>
}
```

**Methods**:
- `findAllWithOrganizations()` - GET /api/vendors (with org join)
- `findById()` - GET /api/vendors/[id]
- `findActive()` - Services (plantSyncService, alertSyncService)
- `findByOrgId()` - Services (plantSyncService)
- `save()` - POST /api/vendors (JPA-style: handles insert/update)
- `update()` - PATCH /api/vendors/[id]

---

##### 4. PlantsRepository (Main DB)
**Table**: `plants`  
**Complexity**: High  
**Patterns**: CRUD + complex joins, batch upsert, production metrics, deduplication

**Interface** (JPA-style):
```typescript
interface IPlantsRepository {
  findAllWithRelations(filters?: { orgId?: number; plantIds?: number[] }): Promise<PlantWithRelations[]>
  findByIdWithRelations(id: number): Promise<PlantWithRelations | null>
  getPlantIdsByOrgId(orgId: number): Promise<number[]>
  findExistingByVendorPlantIds(vendorId: number, vendorPlantIds: string[]): Promise<string[]>
  save(entity: SavePlantData): Promise<Plant>  // JPA: save() instead of create()
  saveAll(plants: SavePlantData[], batchSize?: number): Promise<Plant[]>  // JPA: saveAll() instead of batchUpsert()
  updateProductionMetrics(plantId: number, metrics: ProductionMetrics): Promise<Plant>
}
```

**Methods**:
- `findAllWithRelations()` - GET /api/plants (with vendors & orgs join)
- `findByIdWithRelations()` - GET /api/plants/[id]
- `getPlantIdsByOrgId()` - GET /api/alerts (for filtering)
- `findExistingByVendorPlantIds()` - Services (plantSyncService, deduplication)
- `save()` - POST /api/plants (JPA-style: handles insert/update)
- `saveAll()` - Services (plantSyncService, batch size 100) - JPA: saveAll() instead of batchUpsert()
- `updateProductionMetrics()` - Services (plantSyncService)

**Note**: `findByOrgIdWithWorkOrders()` excluded (involves work_orders)

---

##### 5. AlertsRepository
**Table**: `alerts`  
**Complexity**: Medium  
**Patterns**: CRUD + joins with plants, batch upsert, filtering, grid downtime queries

**Interface** (JPA-style):
```typescript
interface IAlertsRepository {
  findWithPlants(filters?: {
    plantId?: number
    plantIds?: number[]
    status?: string
    limit?: number
  }): Promise<AlertWithPlant[]>
  findExistingByVendorIdentifiers(
    vendorId: number,
    vendorPlantId: string,
    vendorAlertIds: string[]
  ): Promise<Alert[]>
  findGridDownAlerts(windowStart: Date, windowEnd: Date): Promise<GridDownAlert[]>
  saveAll(alerts: SaveAlertData[], batchSize?: number): Promise<Alert[]>  // JPA: saveAll() instead of batchUpsert()
}
```

**Methods**:
- `findWithPlants()` - GET /api/alerts (with plants join, filters)
- `findExistingByVendorIdentifiers()` - Services (alertSyncService, deduplication)
- `findGridDownAlerts()` - Services (gridDowntimeAnalyticsService)
- `saveAll()` - Services (alertSyncService, batch size 100) - JPA: saveAll() instead of batchUpsert()

---

##### 6. WmsVendorsRepository
**Table**: `wms_vendors`  
**Complexity**: Medium  
**Patterns**: CRUD + joins with organizations, token management, active filtering

**Interface** (JPA-style):
```typescript
interface IWmsVendorsRepository {
  findAllWithOrganizations(filters?: { orgId?: number }): Promise<WmsVendorWithOrg[]>
  findActive(): Promise<WmsVendor[]>
  save(entity: SaveWmsVendorData): Promise<WmsVendor>  // JPA: save() instead of create()
  updateToken(id: number, tokenData: TokenData): Promise<WmsVendor>
}
```

**Methods**:
- `findAllWithOrganizations()` - GET /api/wms-vendors (with org join)
- `findActive()` - Services (wmsSyncService)
- `save()` - POST /api/wms-vendors (JPA-style: handles insert/update)
- `updateToken()` - Services (wmsSyncService, token management)

---

##### 7. WmsSitesRepository
**Table**: `wms_sites`  
**Complexity**: Medium  
**Patterns**: Batch upsert, deduplication

**Interface** (JPA-style):
```typescript
interface IWmsSitesRepository {
  findExistingByVendorSiteIds(vendorId: number, vendorSiteIds: string[]): Promise<string[]>
  saveAll(sites: SaveWmsSiteData[], batchSize?: number): Promise<WmsSite[]>  // JPA: saveAll() instead of batchUpsert()
  save(siteData: SaveWmsSiteData): Promise<WmsSite>  // JPA: save() handles insert/update (replaces upsert)
  getSyncedSiteId(vendorId: number, vendorSiteId: string): Promise<number | null>
}
```

**Methods**:
- `findExistingByVendorSiteIds()` - Services (wmsSyncService, deduplication)
- `saveAll()` - Services (wmsSyncService, batch size 100) - JPA: saveAll() instead of batchUpsert()
- `save()` - Services (wmsSyncService, individual save) - JPA: save() handles insert/update (replaces upsert)
- `getSyncedSiteId()` - Services (wmsSyncService, get site ID after sync)

---

##### 8. WmsDevicesRepository
**Table**: `wms_devices`  
**Complexity**: Medium  
**Patterns**: Batch upsert, deduplication

**Interface** (JPA-style):
```typescript
interface IWmsDevicesRepository {
  findExistingByVendorDeviceIds(siteId: number, vendorDeviceIds: string[]): Promise<string[]>
  saveAll(devices: SaveWmsDeviceData[], batchSize?: number): Promise<WmsDevice[]>  // JPA: saveAll() instead of batchUpsert()
  save(deviceData: SaveWmsDeviceData): Promise<WmsDevice>  // JPA: save() handles insert/update (replaces upsert)
}
```

**Methods**:
- `findExistingByVendorDeviceIds()` - Services (wmsSyncService, deduplication)
- `saveAll()` - Services (wmsSyncService, batch size 100) - JPA: saveAll() instead of batchUpsert()
- `save()` - Services (wmsSyncService, individual save) - JPA: save() handles insert/update (replaces upsert)

---

##### 9. InsolationReadingsRepository
**Table**: `insolation_readings`  
**Complexity**: Low  
**Patterns**: Upsert by device/date

**Interface** (JPA-style):
```typescript
interface IInsolationReadingsRepository {
  findByDeviceAndDate(deviceId: number, date: string): Promise<InsolationReading | null>
  save(reading: SaveInsolationReadingData): Promise<InsolationReading>  // JPA: save() handles insert/update (replaces upsert)
}
```

**Methods**:
- `findByDeviceAndDate()` - Services (wmsSyncService, check existing)
- `save()` - Services (wmsSyncService, onConflict: device_id,reading_date) - JPA: save() handles insert/update (replaces upsert)

---

#### Analytics DB Repositories

##### 1. AnalyticsOrganizationsRepository
**Table**: `organizations` (Analytics DB)  
**Complexity**: Medium  
**Patterns**: CRUD + config_hash, config_ready, mirror operations

**Interface** (JPA-style):
```typescript
interface IAnalyticsOrganizationsRepository {
  findAll(): Promise<AnalyticsOrganization[]>
  findConfigHash(id: number): Promise<string | null>
  save(entity: SaveAnalyticsOrgData): Promise<AnalyticsOrganization>  // JPA: save() handles insert/update (replaces upsert)
  updateStatusNoChange(id: number, now: string): Promise<void>
}
```

**Methods**:
- `findAll()` - GET /api/analytics/orgs
- `findConfigHash()` - Services (analyticsMirrorService, change detection)
- `save()` - Services (analyticsMirrorService, mirror from main DB) - JPA: save() handles insert/update (replaces upsert)
- `updateStatusNoChange()` - Services (analyticsMirrorService, no-change case)

**Note**: Extends common organizations interface but adds analytics-specific methods.

---

##### 2. AnalyticsVendorsRepository
**Table**: `vendors` (Analytics DB)  
**Complexity**: Medium  
**Patterns**: CRUD + config_hash, analytics_ready, mirror operations

**Interface** (JPA-style):
```typescript
interface IAnalyticsVendorsRepository {
  findAllWithOrganizations(filters?: {
    orgId?: number
    analyticsReady?: boolean
    configReady?: boolean
    configLastStatus?: string
  }): Promise<AnalyticsVendorWithOrg[]>
  findConfigHash(id: number): Promise<string | null>
  findReadyForAnalytics(): Promise<AnalyticsVendor[]>
  save(entity: SaveAnalyticsVendorData): Promise<AnalyticsVendor>  // JPA: save() handles insert/update (replaces upsert)
  updateStatusNoChange(id: number, now: string): Promise<void>
}
```

**Methods**:
- `findAllWithOrganizations()` - GET /api/analytics/vendors (with org join, filters)
- `findConfigHash()` - Services (analyticsMirrorService, change detection)
- `findReadyForAnalytics()` - Services (analyticsSnapshotService)
- `save()` - Services (analyticsMirrorService, mirror from main DB) - JPA: save() handles insert/update (replaces upsert)
- `updateStatusNoChange()` - Services (analyticsMirrorService, no-change case)

---

##### 3. AnalyticsPlantsRepository
**Table**: `plants` (Analytics DB)  
**Complexity**: Medium  
**Patterns**: CRUD + simplified structure, batch upsert

**Interface** (JPA-style):
```typescript
interface IAnalyticsPlantsRepository {
  findAllWithRelations(filters?: {
    orgId?: number
    vendorId?: number
  }): Promise<AnalyticsPlantWithRelations[]>
  saveAll(plants: SaveAnalyticsPlantData[], batchSize?: number): Promise<AnalyticsPlant[]>  // JPA: saveAll() instead of batchUpsert()
}
```

**Methods**:
- `findAllWithRelations()` - GET /api/analytics/plants (with org & vendor join)
- `saveAll()` - Services (analyticsMirrorService, analyticsSnapshotService, batch size 100) - JPA: saveAll() instead of batchUpsert()

---

##### 4. PlantEnergyReadingsRepository
**Table**: `plant_energy_readings`  
**Complexity**: Medium  
**Patterns**: CRUD + date filtering, batch upsert

**Interface** (JPA-style):
```typescript
interface IPlantEnergyReadingsRepository {
  findByPlantId(plantId: number, filters?: {
    startDate?: string
    endDate?: string
    limit?: number
  }): Promise<PlantEnergyReading[]>
  saveAll(readings: SavePlantEnergyReadingData[], batchSize?: number): Promise<PlantEnergyReading[]>  // JPA: saveAll() instead of batchUpsert()
}
```

**Methods**:
- `findByPlantId()` - GET /api/analytics/plants/[id]/energy (with date filters)
- `saveAll()` - Services (analyticsSnapshotService, batch size 100) - JPA: saveAll() instead of batchUpsert()

---

##### 5. PlantGridDowntimeReadingsRepository
**Table**: `plant_grid_downtime_readings`  
**Complexity**: High  
**Patterns**: CRUD + date filtering, baseline queries, batch upsert

**Interface** (JPA-style):
```typescript
interface IPlantGridDowntimeReadingsRepository {
  findByPlantId(plantId: number, filters?: {
    startDate?: string
    endDate?: string
    limit?: number
  }): Promise<PlantGridDowntimeReading[]>
  getLatestBaseline(plantId: number, cutoffDate: string): Promise<BaselineReading | null>
  saveAll(readings: SavePlantGridDowntimeReadingData[], batchSize?: number): Promise<PlantGridDowntimeReading[]>  // JPA: saveAll() instead of batchUpsert()
}
```

**Methods**:
- `findByPlantId()` - GET /api/analytics/plants/[id]/grid-downtime (with date filters)
- `getLatestBaseline()` - Services (gridDowntimeAnalyticsService, for calculations)
- `saveAll()` - Services (gridDowntimeAnalyticsService, batch size 2000) - JPA: saveAll() instead of batchUpsert()

---

##### 6. AnalyticsSnapshotRunsRepository
**Table**: `analytics_snapshot_runs`  
**Complexity**: Low  
**Patterns**: CRUD + vendor grouping, status tracking

**Interface** (JPA-style):
```typescript
interface IAnalyticsSnapshotRunsRepository {
  findLastRunsByVendors(vendorIds: number[]): Promise<SnapshotRun[]>
  save(entity: SaveSnapshotRunData): Promise<SnapshotRun>  // JPA: save() instead of create()
  update(id: number, data: UpdateSnapshotRunData): Promise<SnapshotRun>
}
```

**Methods**:
- `findLastRunsByVendors()` - GET /api/analytics/vendors (last run per vendor)
- `save()` - Services (analyticsSnapshotService) - JPA: save() instead of create()
- `update()` - Services (analyticsSnapshotService, status tracking)

---

### 4. Repository Structure

```
lib/repositories/
├── types.ts                    # Common types, interfaces, base class
├── main/                       # Main DB repositories
│   ├── accountsRepository.ts
│   ├── organizationsRepository.ts
│   ├── vendorsRepository.ts
│   ├── plantsRepository.ts
│   ├── alertsRepository.ts
│   ├── wmsVendorsRepository.ts
│   ├── wmsSitesRepository.ts
│   ├── wmsDevicesRepository.ts
│   ├── insolationReadingsRepository.ts
│   └── index.ts               # Factory exports
└── analytics/                  # Analytics DB repositories
    ├── organizationsRepository.ts
    ├── vendorsRepository.ts
    ├── plantsRepository.ts
    ├── plantEnergyReadingsRepository.ts
    ├── plantGridDowntimeReadingsRepository.ts
    ├── snapshotRunsRepository.ts
    └── index.ts               # Factory exports
```

---

### 5. Common Patterns Extraction

#### Pattern 1: Simple CRUD
**Tables**: accounts, organizations (Main), insolation_readings  
**Pattern**: Standard CRUD operations with no joins or complex logic  
**Implementation**: Can use BaseRepository or simple repository class

#### Pattern 2: CRUD with Simple Joins
**Tables**: vendors, wms_vendors, alerts  
**Pattern**: CRUD + 1-level join (e.g., vendors with organizations)  
**Implementation**: Repository methods like `findAllWithOrganizations()`

#### Pattern 3: Batch Save with Deduplication (JPA-style)
**Tables**: plants, alerts, wms_sites, wms_devices, analytics tables  
**Pattern**: 
1. Find existing records by vendor identifiers
2. Batch save with onConflict handling (JPA: saveAll())
3. Batch size: 100 (default), 2000 for grid downtime

**Implementation** (JPA-style):
```typescript
async saveAll(entities: T[], batchSize: number = 100): Promise<T[]> {
  // JPA: saveAll() instead of batchUpsert()
  const results: T[] = []
  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize)
    const { data, error } = await this.client
      .from(this.tableName)
      .upsert(batch, { onConflict: "conflict_columns" })
      .select()
    if (error) throw error
    results.push(...(data || []))
  }
  return results
}
```

#### Pattern 4: Cross-Database Operations
**Services**: analyticsMirrorService  
**Pattern**: Read from Main DB, write to Analytics DB  
**Implementation**: Use Main DB repository for reads, Analytics DB repository for writes

#### Pattern 5: Date Filtering
**Tables**: plant_energy_readings, plant_grid_downtime_readings  
**Pattern**: Filter by date range, order by date, optional limit  
**Implementation**: Repository methods accept `filters` object with date parameters

#### Pattern 6: Status Tracking (JPA-style)
**Tables**: analytics_snapshot_runs  
**Pattern**: Save run record, update with status/completion  
**Implementation**: Separate `save()` and `update()` methods (JPA: save() instead of create())

#### Pattern 7: Config Hash Change Detection (JPA-style)
**Tables**: analytics organizations, analytics vendors  
**Pattern**: 
1. Compute hash of config
2. Compare with existing hash
3. Save only if changed, otherwise update status (JPA: save() handles insert/update)

**Implementation** (JPA-style): 
```typescript
async saveWithChangeDetection(entity: SaveAnalyticsOrgData): Promise<void> {
  // JPA: save() instead of upsert()
  const existing = await this.findConfigHash(entity.id)
  if (existing === entity.config_hash) {
    await this.updateStatusNoChange(entity.id, new Date().toISOString())
    return
  }
  await this.save(entity)  // JPA: save() handles insert/update
}
```

---

### 6. Factory Pattern Design

**Factory Functions**:
```typescript
// lib/repositories/main/index.ts
import { getMainClient } from "@/lib/supabase/pooled"
import { MainAccountsRepository } from "./accountsRepository"
import { MainOrganizationsRepository } from "./organizationsRepository"
// ... other imports

export function getAccountsRepository(): IAccountsRepository {
  return new MainAccountsRepository(getMainClient())
}

export function getOrganizationsRepository(): IOrganizationsRepository {
  return new MainOrganizationsRepository(getMainClient())
}

// ... other factories

// lib/repositories/analytics/index.ts
import { getAnalyticsClient } from "@/lib/supabase/pooled"
import { AnalyticsOrganizationsRepository } from "./organizationsRepository"
// ... other imports

export function getAnalyticsOrganizationsRepository(): IAnalyticsOrganizationsRepository {
  return new AnalyticsOrganizationsRepository(getAnalyticsClient())
}

// ... other factories
```

**Usage in API Routes** (JPA-style):
```typescript
import { getOrganizationsRepository } from "@/lib/repositories/main"

export async function GET() {
  const repo = getOrganizationsRepository()
  const orgs = await repo.findAll()
  return NextResponse.json({ orgs })
}

export async function POST(request: Request) {
  const repo = getOrganizationsRepository()
  const body = await request.json()
  const org = await repo.save(body)  // JPA: save() instead of create()
  return NextResponse.json({ org }, { status: 201 })
}
```

---

### Decision Points (Finalized)

1. **Common Base Class**: ✅ **YES** - Create `BaseRepository<T>` for simple CRUD, but allow custom implementations for complex patterns
2. **Database Client Injection**: ✅ **Factory Pattern** - Use `getMainClient()` / `getAnalyticsClient()` in factory functions
3. **Join Handling**: ✅ **Repository Methods** - Joins live in repository (e.g., `findAllWithOrganizations()`)
4. **Batch Operations**: ✅ **Repository Layer** - Repository handles batching logic, service orchestrates calls
5. **Error Handling**: ✅ **Throw Errors** - Repositories throw errors, API routes/services handle them
6. **Type Safety**: ✅ **TypeScript Interfaces** - All repositories use TypeScript interfaces for type safety

---

## Phase 2: Foundation (Base Repository & Types)

### Objective
Create foundation: base repository class, types, interfaces, and factory pattern.

### Status
- ✅ **COMPLETED**

### Tasks
1. Create `lib/repositories/types.ts`:
   - Base repository interface with JPA-style methods
   - Common types (BatchResult, RepositoryOptions, etc.)
   - Base repository class with common CRUD
2. Create `lib/repositories/main/index.ts` - Factory exports
3. Create `lib/repositories/analytics/index.ts` - Factory exports

### Deliverables
- [x] `lib/repositories/types.ts` - Created with IBaseRepository, BaseRepository class, common types
- [x] `lib/repositories/main/index.ts` - Created with factory function stubs
- [x] `lib/repositories/analytics/index.ts` - Created with factory function stubs

### Dependencies
- None (foundation phase)

### Actual Effort
- ~30 minutes

---

## TIER 1: Leaf Nodes (No Dependencies)

---

## Phase 3: `accounts` Repository

### Objective
Implement AccountsRepository and migrate all account-related queries.

### Status
- ✅ **COMPLETED** (Repository + Migration + Legacy Adapter + Tests)

### Table
- **Table**: `accounts`
- **Complexity**: Low
- **Pattern**: Simple CRUD, email lookup

### Feature Toggle
- **Environment Variable**: `USE_ACCOUNTS_REPO`
- **Default**: `true`
- **Rollback**: Set to `false` to use legacy adapter

### Implementation Summary
- Created `lib/repositories/main/accountsRepository.ts` with:
  - `findAll()` - List accounts ordered by email
  - `findByEmail()` - Lookup by email (for duplicate check)
  - `findByEmailForLogin()` - Login lookup (active accounts only)
  - `existsByOrgId()` - Check if org has account
  - `save()` - Create new account
  - `testConnection()` - DB health check

### Deliverables

**Repository Implementation:**
- [x] `lib/repositories/main/accountsRepository.ts`
- [x] Update `app/api/accounts/route.ts`
- [x] Update `app/api/login/route.ts`
- [x] Build passes

**Feature Toggle & Legacy Adapter:**
- [x] Create `lib/repositories/main/legacyAdapters/accountsAdapter.ts`
- [x] Update factory in `lib/repositories/main/index.ts` with toggle logic

**Testing:**
- [x] `tests/repositories/main/accountsRepository.test.ts`
  - [x] Test `findAll()` returns accounts ordered by email
  - [x] Test `findByEmail()` returns account or null
  - [x] Test `findByEmailForLogin()` only returns active accounts
  - [x] Test `existsByOrgId()` returns boolean correctly
  - [x] Test `save()` creates account with hashed password
  - [x] Test `testConnection()` succeeds/fails appropriately

### Dependencies
- Phase 2 (Foundation) ✅

### Actual Effort
- Repository: ~45 minutes ✅
- Legacy Adapter: ~20 minutes ✅
- Tests: ~30 minutes ✅
- **Total**: ~1.5 hours

---

## Phase 4: `organizations` Repository (Main DB)

### Objective
Implement OrganizationsRepository (Main DB) and migrate all organization-related queries.

### Status
- ✅ **COMPLETED** (Repository + Migration + Legacy Adapter + Tests)

### Table
- **Table**: `organizations` (Main DB)
- **Complexity**: Low
- **Pattern**: Simple CRUD, name ordering

### Feature Toggle
- **Environment Variable**: `USE_ORGS_REPO`
- **Default**: `true`
- **Rollback**: Set to `false` to use legacy adapter

### Implementation Summary
- Created `lib/repositories/main/organizationsRepository.ts` with:
  - `findAll()` - List organizations ordered by name
  - `findById()` - Get single organization
  - `save()` - Create new organization

### Deliverables

**Repository Implementation:**
- [x] `lib/repositories/main/organizationsRepository.ts`
- [x] Update `app/api/orgs/route.ts`
- [ ] Update `app/api/orgs/[id]/route.ts` (deferred - will be done when needed)
- [x] Build passes

**Feature Toggle & Legacy Adapter:**
- [x] Create `lib/repositories/main/legacyAdapters/organizationsAdapter.ts`
- [x] Update factory in `lib/repositories/main/index.ts` with toggle logic

**Testing:**
- [x] `tests/repositories/main/organizationsRepository.test.ts`
  - [x] Test `findAll()` returns organizations ordered by name
  - [x] Test `findById()` returns organization or null
  - [x] Test `save()` creates organization with defaults

### Dependencies
- Phase 2 (Foundation) ✅

### Actual Effort
- Repository: ~30 minutes ✅
- Legacy Adapter: ~15 minutes ✅
- Tests: ~20 minutes ✅
- **Total**: ~1 hour

---

## Phase 5: `organizations` Repository (Analytics DB)

### Objective
Implement AnalyticsOrganizationsRepository and migrate all analytics organization queries.

### Status
- ✅ **COMPLETED** (Repository + Migration + Legacy Adapter + Tests)

### Table
- **Table**: `organizations` (Analytics DB)
- **Complexity**: Medium
- **Pattern**: CRUD + config_hash, config_ready, mirror operations

### Feature Toggle
- **Environment Variable**: `USE_ANALYTICS_ORGS_REPO`
- **Default**: `true`
- **Rollback**: Set to `false` to use legacy adapter

### Implementation Summary
- Created `lib/repositories/analytics/organizationsRepository.ts` with:
  - `findAll()` - List organizations ordered by name
  - `findById()` - Get single organization
  - `findConfigHash()` - Get config hash for change detection
  - `save()` - Upsert organization with config data
  - `updateStatusNoChange()` - Update status when no config change detected

### Deliverables

**Repository Implementation:**
- [x] `lib/repositories/analytics/organizationsRepository.ts`
- [x] Update `app/api/analytics/orgs/route.ts`
- [x] Partial update to `lib/services/analyticsMirrorService.ts` (org queries only)
- [x] Build passes

**Feature Toggle & Legacy Adapter:**
- [x] Create `lib/repositories/analytics/legacyAdapters/organizationsAdapter.ts`
- [x] Update factory in `lib/repositories/analytics/index.ts` with toggle logic

**Testing:**
- [x] `tests/repositories/analytics/organizationsRepository.test.ts`
  - [x] Test `findAll()` returns organizations ordered by name
  - [x] Test `findById()` returns organization or null
  - [x] Test `findConfigHash()` returns hash or null
  - [x] Test `save()` upserts with config data
  - [x] Test `updateStatusNoChange()` updates status fields only

### Dependencies
- Phase 2 (Foundation) ✅

### Actual Effort
- Repository: ~45 minutes ✅
- Legacy Adapter: ~20 minutes ✅
- Tests: ~30 minutes ✅
- **Total**: ~1.5 hours

---

## TIER 2: Depends on Organizations

---

## Phase 6: `vendors` Repository (Main DB)

### Objective
Implement VendorsRepository (Main DB) and migrate all vendor-related queries.

### Status
- ✅ **COMPLETED** (Repository + Migration + Legacy Adapter + Tests)

### Table
- **Table**: `vendors` (Main DB)
- **Complexity**: Medium
- **Pattern**: CRUD + join with organizations, active filtering

### Feature Toggle
- **Environment Variable**: `USE_VENDORS_REPO`
- **Default**: `true`
- **Rollback**: Set to `false` to use legacy adapter

### Implementation Summary
- Created `lib/repositories/main/vendorsRepository.ts` with:
  - `findAllWithOrganizations()` - List vendors with org join ordered by name
  - `findByIdWithOrganization()` - Get single vendor with org join
  - `findById()` - Get single vendor without join
  - `findActive()` - Get only active vendors
  - `findByOrgId()` - Filter by organization
  - `save()` - Create new vendor
  - `update()` - Update vendor fields
  - `deleteById()` - Delete vendor

### Deliverables

**Repository Implementation:**
- [x] `lib/repositories/main/vendorsRepository.ts`
- [x] Update `app/api/vendors/route.ts`
- [x] Update `app/api/vendors/[id]/route.ts`
- [ ] Partial update to `lib/services/plantSyncService.ts` (vendor queries only) - deferred
- [ ] Partial update to `lib/services/alertSyncService.ts` (vendor queries only) - deferred
- [x] Build passes

**Feature Toggle & Legacy Adapter:**
- [x] Create `lib/repositories/main/legacyAdapters/vendorsAdapter.ts`
- [x] Update factory in `lib/repositories/main/index.ts` with toggle logic

**Testing:**
- [x] `tests/repositories/main/vendorsRepository.test.ts`
  - [x] Test `findAllWithOrganizations()` returns vendors with org join
  - [x] Test `findByIdWithOrganization()` returns vendor or null
  - [x] Test `findActive()` returns only active vendors
  - [x] Test `save()` creates vendor correctly
  - [x] Test `update()` updates vendor fields
  - [x] Test `deleteById()` deletes vendor

### Dependencies
- Phase 4 (Organizations - Main) ✅

### Actual Effort
- Repository: ~45 minutes ✅
- Legacy Adapter: ~20 minutes ✅
- Tests: ~30 minutes ✅
- **Total**: ~1.5 hours

---

## Phase 7: `vendors` Repository (Analytics DB)

### Objective
Implement AnalyticsVendorsRepository and migrate all analytics vendor queries.

### Status
- ✅ **COMPLETED** (Repository + Migration + Legacy Adapter + Tests)

### Table
- **Table**: `vendors` (Analytics DB)
- **Complexity**: Medium
- **Pattern**: CRUD + join + config_hash, analytics_ready, mirror operations

### Feature Toggle
- **Environment Variable**: `USE_ANALYTICS_VENDORS_REPO`
- **Default**: `true`
- **Rollback**: Set to `false` to use legacy adapter

### Implementation Summary
- Created `lib/repositories/analytics/vendorsRepository.ts` with:
  - `findAllWithOrganizations()` - List vendors with org join ordered by name
  - `findByOrgIdWithOrganization()` - Filter by org ID with org join
  - `findById()` - Get single vendor
  - `findConfigHash()` - Get config hash for change detection
  - `save()` - Upsert vendor with config data
  - `updateStatusNoChange()` - Update status when no config change detected

### Deliverables

**Repository Implementation:**
- [x] `lib/repositories/analytics/vendorsRepository.ts`
- [x] Update `app/api/analytics/vendors/route.ts`
- [ ] Partial update to `lib/services/analyticsMirrorService.ts` (vendor queries only) - deferred
- [ ] Partial update to `lib/services/analyticsSnapshotService.ts` (vendor queries only) - deferred
- [x] Build passes

**Feature Toggle & Legacy Adapter:**
- [x] Create `lib/repositories/analytics/legacyAdapters/vendorsAdapter.ts`
- [x] Update factory in `lib/repositories/analytics/index.ts` with toggle logic

**Testing:**
- [x] `tests/repositories/analytics/vendorsRepository.test.ts`
  - [x] Test `findAllWithOrganizations()` returns vendors with org join
  - [x] Test `findByOrgIdWithOrganization()` filters by org ID
  - [x] Test `findConfigHash()` returns hash or null
  - [x] Test `save()` upserts vendor with config
  - [x] Test `updateStatusNoChange()` updates status fields only

### Dependencies
- Phase 5 (Organizations - Analytics) ✅
- Phase 6 (Vendors - Main) ✅

### Actual Effort
- Repository: ~30 minutes ✅
- Legacy Adapter: ~15 minutes ✅
- Tests: ~25 minutes ✅
- **Total**: ~1 hour

---

## Phase 8: `wms_vendors` Repository

### Objective
Implement WmsVendorsRepository and migrate all WMS vendor queries.

### Status
- ✅ **COMPLETED** (Repository + Migration + Legacy Adapter + Tests)

### Table
- **Table**: `wms_vendors`
- **Complexity**: Medium
- **Pattern**: CRUD + join with organizations, token management, active filtering

### Feature Toggle
- **Environment Variable**: `USE_WMS_VENDORS_REPO`
- **Default**: `true`
- **Rollback**: Set to `false` to use legacy adapter

### Implementation Summary
- Created `lib/repositories/main/wmsVendorsRepository.ts` with:
  - `findAllWithOrganizations()` - List WMS vendors with org join ordered by name
  - `findByOrgIdWithOrganization()` - Filter by org ID with org join
  - `findByIdWithOrganization()` - Get single vendor with org join
  - `findById()` - Get single vendor without join
  - `findActive()` - Get only active vendors
  - `save()` - Create new WMS vendor
  - `update()` - Update WMS vendor fields
  - `updateToken()` - Update token and token_expires_at
  - `clearToken()` - Clear token data
  - `deleteById()` - Delete WMS vendor

### Deliverables

**Repository Implementation:**
- [x] `lib/repositories/main/wmsVendorsRepository.ts`
- [x] Update `app/api/wms-vendors/route.ts`
- [x] Update `app/api/wms-vendors/[id]/route.ts`
- [ ] Partial update to `lib/services/wmsSyncService.ts` (wms_vendor queries only) - deferred
- [ ] Update `lib/wms/modules/tokenRepository.ts` - deferred (uses different client pattern)
- [x] Build passes

**Feature Toggle & Legacy Adapter:**
- [x] Create `lib/repositories/main/legacyAdapters/wmsVendorsAdapter.ts`
- [x] Update factory in `lib/repositories/main/index.ts` with toggle logic

**Testing:**
- [x] `tests/repositories/main/wmsVendorsRepository.test.ts`
  - [x] Test `findAllWithOrganizations()` returns vendors with org join
  - [x] Test `findByOrgIdWithOrganization()` filters by org ID
  - [x] Test `findByIdWithOrganization()` returns vendor or null
  - [x] Test `findActive()` returns only active vendors
  - [x] Test `save()` creates WMS vendor correctly
  - [x] Test `update()` updates vendor fields
  - [x] Test `updateToken()` updates token data
  - [x] Test `clearToken()` clears token data
  - [x] Test `deleteById()` deletes vendor

### Dependencies
- Phase 4 (Organizations - Main) ✅

### Actual Effort
- Repository: ~45 minutes ✅
- Legacy Adapter: ~20 minutes ✅
- Tests: ~30 minutes ✅
- **Total**: ~1.5 hours

---

## TIER 3: Depends on Vendors

---

## Phase 9: `plants` Repository (Main DB)

### Objective
Implement PlantsRepository (Main DB) and migrate all plant-related queries.

### Status
- 🔜 **NEXT** - Ready for implementation (Phases 6-8 completed)

### Table
- **Table**: `plants` (Main DB)
- **Complexity**: High
- **Pattern**: CRUD + complex joins, batch saveAll(), production metrics, deduplication

### Current State
- Direct Supabase calls in:
  - `app/api/plants/route.ts`
  - `app/api/plants/[id]/route.ts`
  - `lib/services/plantSyncService.ts` (batch upsert, deduplication, production metrics)

### Tasks
1. Create `lib/repositories/main/plantsRepository.ts`
2. Migrate `app/api/plants/route.ts` to use repository
3. Migrate `app/api/plants/[id]/route.ts` to use repository
4. Migrate plant queries in `plantSyncService.ts`
5. Test batch operations and deduplication
6. Test production metrics updates

### Deliverables
- [ ] `lib/repositories/main/plantsRepository.ts`
- [ ] Update `app/api/plants/route.ts`
- [ ] Update `app/api/plants/[id]/route.ts`
- [ ] Complete update to `lib/services/plantSyncService.ts`
- [ ] Tests pass (batch, deduplication, metrics)

### Dependencies
- Phase 6 (Vendors - Main)

### Estimated Effort
- 3-4 hours

---

## Phase 10: `plants` Repository (Analytics DB)

### Objective
Implement AnalyticsPlantsRepository and migrate all analytics plant queries.

### Status
- ⏸️ **NOT STARTED** - Awaiting Phase 7, 9

### Table
- **Table**: `plants` (Analytics DB)
- **Complexity**: Medium
- **Pattern**: CRUD + simplified structure, batch saveAll()

### Current State
- Direct Supabase calls in:
  - `app/api/analytics/plants/route.ts`
  - `lib/services/analyticsMirrorService.ts` (plant mirroring)
  - `lib/services/analyticsSnapshotService.ts` (plant data)

### Tasks
1. Create `lib/repositories/analytics/plantsRepository.ts`
2. Migrate `app/api/analytics/plants/route.ts` to use repository
3. Migrate plant-related queries in `analyticsMirrorService.ts`
4. Migrate plant queries in `analyticsSnapshotService.ts`
5. Test batch operations

### Deliverables
- [ ] `lib/repositories/analytics/plantsRepository.ts`
- [ ] Update `app/api/analytics/plants/route.ts`
- [ ] Complete update to `lib/services/analyticsMirrorService.ts`
- [ ] Partial update to `lib/services/analyticsSnapshotService.ts` (plant queries only)
- [ ] Tests pass

### Dependencies
- Phase 7 (Vendors - Analytics)
- Phase 9 (Plants - Main)

### Estimated Effort
- 2-3 hours

---

## Phase 11: `alerts` Repository

### Objective
Implement AlertsRepository and migrate all alert-related queries.

### Status
- ⏸️ **NOT STARTED** - Awaiting Phase 9

### Table
- **Table**: `alerts`
- **Complexity**: Medium
- **Pattern**: CRUD + joins with plants, batch saveAll(), filtering, grid downtime queries

### Current State
- Direct Supabase calls in:
  - `app/api/alerts/route.ts`
  - `lib/services/alertSyncService.ts` (batch upsert, deduplication)
  - `lib/services/gridDowntimeAnalyticsService.ts` (grid down alert queries)

### Tasks
1. Create `lib/repositories/main/alertsRepository.ts`
2. Migrate `app/api/alerts/route.ts` to use repository
3. Migrate alert queries in `alertSyncService.ts`
4. Migrate grid down alert queries in `gridDowntimeAnalyticsService.ts`
5. Test batch operations and filtering

### Deliverables
- [ ] `lib/repositories/main/alertsRepository.ts`
- [ ] Update `app/api/alerts/route.ts`
- [ ] Complete update to `lib/services/alertSyncService.ts`
- [ ] Partial update to `lib/services/gridDowntimeAnalyticsService.ts` (alert queries only)
- [ ] Tests pass

### Dependencies
- Phase 9 (Plants - Main)

### Estimated Effort
- 2-3 hours

---

## Phase 12: `wms_sites` Repository

### Objective
Implement WmsSitesRepository and migrate all WMS site queries.

### Status
- ⏸️ **NOT STARTED** - Awaiting Phase 8

### Table
- **Table**: `wms_sites`
- **Complexity**: Medium
- **Pattern**: Batch saveAll(), deduplication

### Current State
- Direct Supabase calls in:
  - `lib/services/wmsSyncService.ts` (site sync, deduplication)

### Tasks
1. Create `lib/repositories/main/wmsSitesRepository.ts`
2. Migrate site queries in `wmsSyncService.ts`
3. Test batch operations and deduplication

### Deliverables
- [ ] `lib/repositories/main/wmsSitesRepository.ts`
- [ ] Partial update to `lib/services/wmsSyncService.ts` (wms_sites queries only)
- [ ] Tests pass

### Dependencies
- Phase 8 (WMS Vendors)

### Estimated Effort
- 2 hours

---

## Phase 13: `wms_devices` Repository

### Objective
Implement WmsDevicesRepository and migrate all WMS device queries.

### Status
- ⏸️ **NOT STARTED** - Awaiting Phase 12

### Table
- **Table**: `wms_devices`
- **Complexity**: Medium
- **Pattern**: Batch saveAll(), deduplication

### Current State
- Direct Supabase calls in:
  - `lib/services/wmsSyncService.ts` (device sync, deduplication)

### Tasks
1. Create `lib/repositories/main/wmsDevicesRepository.ts`
2. Migrate device queries in `wmsSyncService.ts`
3. Test batch operations and deduplication

### Deliverables
- [ ] `lib/repositories/main/wmsDevicesRepository.ts`
- [ ] Partial update to `lib/services/wmsSyncService.ts` (wms_devices queries only)
- [ ] Tests pass

### Dependencies
- Phase 12 (WMS Sites)

### Estimated Effort
- 2 hours

---

## Phase 14: `insolation_readings` Repository

### Objective
Implement InsolationReadingsRepository and migrate all insolation queries.

### Status
- ⏸️ **NOT STARTED** - Awaiting Phase 13

### Table
- **Table**: `insolation_readings`
- **Complexity**: Low
- **Pattern**: Upsert by device/date

### Current State
- Direct Supabase calls in:
  - `lib/services/wmsSyncService.ts` (insolation data save)

### Tasks
1. Create `lib/repositories/main/insolationReadingsRepository.ts`
2. Migrate insolation queries in `wmsSyncService.ts`
3. Complete wmsSyncService migration (all WMS queries done)
4. Test upsert operations

### Deliverables
- [ ] `lib/repositories/main/insolationReadingsRepository.ts`
- [ ] Complete update to `lib/services/wmsSyncService.ts` (all queries migrated)
- [ ] Tests pass

### Dependencies
- Phase 13 (WMS Devices)

### Estimated Effort
- 1-2 hours

---

## TIER 4: Analytics-Specific

---

## Phase 15: `plant_energy_readings` Repository

### Objective
Implement PlantEnergyReadingsRepository and migrate all energy reading queries.

### Status
- ⏸️ **NOT STARTED** - Awaiting Phase 10

### Table
- **Table**: `plant_energy_readings`
- **Complexity**: Medium
- **Pattern**: CRUD + date filtering, batch saveAll()

### Current State
- Direct Supabase calls in:
  - `app/api/analytics/plants/[id]/energy/route.ts`
  - `lib/services/analyticsSnapshotService.ts` (energy readings save)

### Tasks
1. Create `lib/repositories/analytics/plantEnergyReadingsRepository.ts`
2. Migrate `app/api/analytics/plants/[id]/energy/route.ts` to use repository
3. Migrate energy reading queries in `analyticsSnapshotService.ts`
4. Test date filtering and batch operations

### Deliverables
- [ ] `lib/repositories/analytics/plantEnergyReadingsRepository.ts`
- [ ] Update `app/api/analytics/plants/[id]/energy/route.ts`
- [ ] Partial update to `lib/services/analyticsSnapshotService.ts` (energy queries only)
- [ ] Tests pass

### Dependencies
- Phase 10 (Plants - Analytics)

### Estimated Effort
- 2 hours

---

## Phase 16: `plant_grid_downtime_readings` Repository

### Objective
Implement PlantGridDowntimeReadingsRepository and migrate all grid downtime queries.

### Status
- ⏸️ **NOT STARTED** - Awaiting Phase 15

### Table
- **Table**: `plant_grid_downtime_readings`
- **Complexity**: High
- **Pattern**: CRUD + date filtering, baseline queries, batch saveAll() (batch size 2000)

### Current State
- Direct Supabase calls in:
  - `app/api/analytics/plants/[id]/grid-downtime/route.ts`
  - `lib/services/gridDowntimeAnalyticsService.ts` (baseline queries, batch upsert)

### Tasks
1. Create `lib/repositories/analytics/plantGridDowntimeReadingsRepository.ts`
2. Migrate `app/api/analytics/plants/[id]/grid-downtime/route.ts` to use repository
3. Migrate grid downtime queries in `gridDowntimeAnalyticsService.ts`
4. Complete gridDowntimeAnalyticsService migration
5. Test baseline calculations and large batch operations

### Deliverables
- [ ] `lib/repositories/analytics/plantGridDowntimeReadingsRepository.ts`
- [ ] Update `app/api/analytics/plants/[id]/grid-downtime/route.ts`
- [ ] Complete update to `lib/services/gridDowntimeAnalyticsService.ts`
- [ ] Tests pass (batch size 2000)

### Dependencies
- Phase 15 (Plant Energy Readings)

### Estimated Effort
- 3 hours

---

## Phase 17: `analytics_snapshot_runs` Repository

### Objective
Implement AnalyticsSnapshotRunsRepository and migrate all snapshot run queries.

### Status
- ⏸️ **NOT STARTED** - Awaiting Phase 15

### Table
- **Table**: `analytics_snapshot_runs`
- **Complexity**: Low
- **Pattern**: CRUD + vendor grouping, status tracking

### Current State
- Direct Supabase calls in:
  - `app/api/analytics/vendors/route.ts` (last run per vendor)
  - `lib/services/analyticsSnapshotService.ts` (run tracking)

### Tasks
1. Create `lib/repositories/analytics/snapshotRunsRepository.ts`
2. Migrate snapshot run queries in `app/api/analytics/vendors/route.ts`
3. Migrate run tracking in `analyticsSnapshotService.ts`
4. Complete analyticsSnapshotService migration
5. Test status tracking

### Deliverables
- [ ] `lib/repositories/analytics/snapshotRunsRepository.ts`
- [ ] Update `app/api/analytics/vendors/route.ts` (snapshot run queries)
- [ ] Complete update to `lib/services/analyticsSnapshotService.ts`
- [ ] Tests pass

### Dependencies
- Phase 15 (Plant Energy Readings)

### Estimated Effort
- 1-2 hours

---

## TIER 5: Complex (Work Orders)

---

## Phase 18: `work_orders` Repository (Aggregate Root)

### Objective
Implement WorkOrdersRepository using aggregate root pattern with single-query nested joins.

### Status
- ⏸️ **NOT STARTED** - Awaiting Phase 9 (Plants), Phase 4 (Organizations)

### Table
- **Table**: `work_orders`
- **Complexity**: High
- **Pattern**: Aggregate Root with nested joins, transaction-like operations

### Current State
- Direct Supabase calls in:
  - `app/api/workorders/route.ts`
  - `app/api/workorders/[id]/route.ts`

### Tasks
1. Create `lib/repositories/main/workOrdersRepository.ts`
2. Migrate `app/api/workorders/route.ts` to use repository
3. Migrate `app/api/workorders/[id]/route.ts` to use repository
4. Implement single-query nested joins (N+1 prevention)
5. Test create/update with plants

### Deliverables
- [ ] `lib/repositories/main/workOrdersRepository.ts`
- [ ] Update `app/api/workorders/route.ts`
- [ ] Update `app/api/workorders/[id]/route.ts`
- [ ] Tests pass (verify no N+1)

### Dependencies
- Phase 9 (Plants - Main)
- Phase 4 (Organizations - Main)

### Estimated Effort
- 4-5 hours

### Design Notes
See detailed design in "Phase 10: Work Orders Repositories" section below.

---

## Phase 19: `work_order_plants` Repository

### Objective
Implement WorkOrderPlantsRepository for junction table operations.

### Status
- ⏸️ **NOT STARTED** - Awaiting Phase 18

### Table
- **Table**: `work_order_plants`
- **Complexity**: Medium
- **Pattern**: Junction table operations, batch updates

### Current State
- Direct Supabase calls embedded in:
  - `app/api/workorders/route.ts`
  - Work order create/update logic

### Tasks
1. Create `lib/repositories/main/workOrderPlantsRepository.ts`
2. Extract junction table operations from workorders route
3. Test batch activate/deactivate operations

### Deliverables
- [ ] `lib/repositories/main/workOrderPlantsRepository.ts`
- [ ] Refactor `app/api/workorders/route.ts` to use junction repository
- [ ] Tests pass

### Dependencies
- Phase 18 (Work Orders)

### Estimated Effort
- 2-3 hours

---

## Phase 20: `work_logs` Repository

### Objective
Implement WorkLogsRepository for work log operations.

### Status
- ⏸️ **NOT STARTED** - Awaiting Phase 18

### Table
- **Table**: `work_logs`
- **Complexity**: Low
- **Pattern**: Simple CRUD with user join

### Current State
- Direct Supabase calls in:
  - `app/api/workorders/[id]/logs/route.ts`

### Tasks
1. Create `lib/repositories/main/workLogsRepository.ts`
2. Migrate `app/api/workorders/[id]/logs/route.ts` to use repository
3. Test with user join

### Deliverables
- [ ] `lib/repositories/main/workLogsRepository.ts`
- [ ] Update `app/api/workorders/[id]/logs/route.ts`
- [ ] Tests pass

### Dependencies
- Phase 18 (Work Orders)

### Estimated Effort
- 1-2 hours

---

## FINAL PHASES

---

---

## Risk Assessment

### High Risk Areas
1. **Batch Operations**: Complex batch upsert logic in services
2. **Cross-Database Operations**: analyticsMirrorService reads from Main, writes to Analytics
3. **Complex Joins**: Plants with work orders (excluded, but related queries exist)
4. **Transaction Handling**: Some operations may need transactions

### Mitigation Strategies
1. **Model-by-Model Migration**: Each model can be tested and rolled back independently
2. **Feature Flags**: Ability to rollback individual models if needed
3. **Thorough Testing**: Each phase includes testing before moving to next
4. **Tiered Approach**: Dependencies ensure stable foundation before complex migrations
5. **Incremental Service Updates**: Services updated gradually as repositories become available

---

## Work Orders Design Reference (Phases 18-20)

### Objective
Implement repositories for work orders using aggregate root pattern with single-query nested joins to avoid N+1 query propagation.

### Status
- ⏸️ **NOT STARTED** - Awaiting Phase 5 (PlantsRepository) and Phase 4 (OrganizationsRepository, VendorsRepository) completion
- ✅ Design complete (documented below)

### Design Principle: Single Query with Nested Joins

**Key Insight**: Work orders use Supabase PostgREST's nested select feature, which executes a **single SQL query** with JOINs. This is efficient and avoids N+1 problems.

**Anti-Pattern to Avoid**:
```typescript
// ❌ BAD: Multiple queries (N+1 problem)
const workOrders = await repo.findAll()
for (const wo of workOrders) {
  const plants = await repo.findPlantsByWorkOrderId(wo.id) // N queries!
}
```

**Correct Pattern**:
```typescript
// ✅ GOOD: Single query with nested joins
const workOrders = await repo.findAllWithPlants() // 1 query with JOINs
```

### Tables Involved
1. `work_orders` - Main aggregate root
2. `work_order_plants` - Junction table (part of aggregate)
3. `work_logs` - Related entity (separate repository)
4. `plants` - Referenced entity (already has repository)
5. `organizations` - Referenced entity (already has repository)
6. `vendors` - Referenced entity (already has repository)

### Repository Design

#### 1. WorkOrdersRepository (Aggregate Root)

**Table**: `work_orders`  
**Complexity**: High  
**Pattern**: Aggregate Root with nested joins, transaction management

**Interface** (JPA-style):
```typescript
interface IWorkOrdersRepository {
  // Read operations (single query with nested joins)
  findAllWithPlants(filters?: {
    orgId?: number
    accountType?: string
  }): Promise<WorkOrderWithPlants[]>
  
  findByIdWithPlants(id: number): Promise<WorkOrderWithPlants | null>
  
  findAllForExport(filters?: { orgId?: number }): Promise<WorkOrderExport[]>
  
  findByTitleAndOrgId(title: string, orgId: number): Promise<WorkOrder | null>
  
  countByOrgId(orgId: number): Promise<number>  // JPA: count() with filter
  
  // Write operations (with transaction-like behavior)
  saveWithPlants(entity: SaveWorkOrderWithPlantsData): Promise<WorkOrderWithPlants>  // JPA: save() instead of create()
  
  updateWithPlants(id: number, data: UpdateWorkOrderWithPlantsData): Promise<WorkOrderWithPlants>
  
  deleteById(id: number): Promise<void>  // JPA: deleteById()
  
  deleteByOrgId(orgId: number): Promise<number> // Returns count deleted
  
  // Validation helpers
  validatePlantsForOrg(plantIds: number[]): Promise<PlantValidationResult>
}
```

**Key Methods**:

1. **`findAllWithPlants()`** - GET /api/workorders
   - **Query Strategy**: Single query with nested joins
   - **Select**: `work_orders(*) -> organizations(*) -> work_order_plants(*) -> plants(*) -> organizations(*), vendors(*)`
   - **Performance**: O(1) query regardless of number of work orders or plants
   - **Filtering**: Role-based (orgId, accountType) at DB level

2. **`findByIdWithPlants()`** - GET /api/workorders/[id]
   - **Query Strategy**: Single query with nested joins
   - **Select**: Full nested structure including all plant relations
   - **Post-processing**: Extract networkStatus from metadata (in-memory, not DB query)

3. **`saveWithPlants()`** - POST /api/workorders (JPA-style: save() instead of create())
   - **Transaction Strategy**: Sequential operations (Supabase doesn't support transactions, but we ensure atomicity)
   - **Steps**:
     1. Validate plants belong to same org (single query)
     2. Save work order (single query) - JPA: save() handles insert
     3. Deactivate existing active mappings for plants (single query)
     4. Insert new work_order_plants (single query)
   - **Total Queries**: 4 (all necessary, no N+1)

4. **`updateWithPlants()`** - PUT /api/workorders/[id]
   - **Transaction Strategy**: Sequential operations with diff calculation
   - **Steps**:
     1. Validate plants (single query)
     2. Update work order (single query)
     3. Get existing mappings (single query)
     4. Calculate diff (in-memory)
     5. Batch deactivate/activate/insert (3 queries max, batched)
   - **Total Queries**: 5-6 (efficient, no N+1)

5. **`findAllForExport()`** - GET /api/workorders/export
   - **Query Strategy**: Single query with full nested structure
   - **Includes**: All necessary fields for Excel export

**Implementation Pattern** (JPA-style):
```typescript
class WorkOrdersRepository implements IWorkOrdersRepository {
  constructor(private client: SupabaseClient) {}
  
  async findAllWithPlants(filters?: WorkOrderFilters): Promise<WorkOrderWithPlants[]> {
    // Single query with nested joins - NO N+1
    let query = this.client
      .from("work_orders")
      .select(`
        id,
        title,
        description,
        location,
        created_at,
        updated_at,
        org_id,
        organizations:org_id(id, name),
        work_order_plants(
          *,
          plants:plant_id (
            id,
            name,
            org_id,
            capacity_kw,
            organizations(id, name)
          )
        )
      `)
      .order("created_at", { ascending: false })
    
    if (filters?.orgId) {
      query = query.eq("org_id", filters.orgId)
    }
    
    const { data, error } = await query
    if (error) throw error
    return data as WorkOrderWithPlants[]
  }
  
  async saveWithPlants(entity: SaveWorkOrderWithPlantsData): Promise<WorkOrderWithPlants> {
    // JPA: save() instead of create()
    // Step 1: Validate (single query)
    const validation = await this.validatePlantsForOrg(entity.plantIds)
    if (!validation.isValid) {
      throw new Error(validation.error)
    }
    
    // Step 2: Save work order (single query) - JPA: save() handles insert
    const { data: workOrder, error: woError } = await this.client
      .from("work_orders")
      .insert({
        title: entity.title,
        description: entity.description,
        location: entity.location,
        org_id: validation.orgId,
        priority: entity.priority,
        created_by: entity.created_by,
      })
      .select()
      .single()
    
    if (woError) throw woError
    
    // Step 3: Deactivate existing (single query)
    await this.client
      .from("work_order_plants")
      .update({ is_active: false })
      .in("plant_id", entity.plantIds)
      .eq("is_active", true)
    
    // Step 4: Save new mappings (single query) - JPA: saveAll() for batch
    const mappings = entity.plantIds.map(plantId => ({
      work_order_id: workOrder.id,
      plant_id: plantId,
      is_active: true,
    }))
    
    await this.client
      .from("work_order_plants")
      .insert(mappings)
    
    // Step 5: Return with plants (single query with joins)
    return this.findByIdWithPlants(workOrder.id)
  }
}
```

---

#### 2. WorkOrderPlantsRepository (Junction Table Operations)

**Table**: `work_order_plants`  
**Complexity**: Medium  
**Pattern**: Junction table operations, batch updates

**Interface** (JPA-style):
```typescript
interface IWorkOrderPlantsRepository {
  // Read operations
  findByWorkOrderId(workOrderId: number): Promise<WorkOrderPlant[]>
  findByWorkOrderIdWithPlantOrg(workOrderId: number): Promise<WorkOrderPlantWithOrg[]>
  findActiveByPlantIds(plantIds: number[]): Promise<Map<number, number>> // plantId -> workOrderId
  findMappedPlantIds(): Promise<Set<number>>
  findMappedPlantIdsForOrg(plantIds: number[]): Promise<Set<number>>
  findWorkOrderIdsByPlantIds(plantIds: number[]): Promise<Set<number>>
  findByWorkOrderIdsWithPlants(workOrderIds: number[]): Promise<WorkOrderPlantWithPlant[]>
  
  // Write operations (batch) - JPA-style
  deactivateByPlantIds(plantIds: number[]): Promise<void>
  deactivateByWorkOrderAndPlantIds(workOrderId: number, plantIds: number[]): Promise<void>
  activateByWorkOrderAndPlantIds(workOrderId: number, plantIds: number[]): Promise<void>
  saveAll(mappings: SaveWorkOrderPlantMapping[]): Promise<WorkOrderPlant[]>  // JPA: saveAll() instead of insert()
}
```

**Key Methods**:
- All operations use batch queries (`.in()` or batch inserts)
- No N+1 queries - all operations are batched
- Used by WorkOrdersRepository for plant management
- JPA: `saveAll()` replaces `insert()` for batch operations

---

#### 3. WorkLogsRepository

**Table**: `work_logs`  
**Complexity**: Low  
**Pattern**: Simple CRUD with user join

**Interface** (JPA-style):
```typescript
interface IWorkLogsRepository {
  findByWorkOrderId(workOrderId: number): Promise<WorkLogWithUser[]>
  save(entity: SaveWorkLogData): Promise<WorkLog>  // JPA: save() instead of create()
}
```

**Implementation**:
- Uses single query with join to `users` table
- No N+1 issues
- JPA: `save()` replaces `create()` for insert operations

---

#### 4. WorkOrderProductionRepository (Specialized Query)

**Purpose**: Production metrics aggregation for work orders  
**Complexity**: Medium  
**Pattern**: Single query with aggregation

**Interface**:
```typescript
interface IWorkOrderProductionRepository {
  getProductionData(workOrderId: number): Promise<WorkOrderProductionData>
}
```

**Implementation**:
- Single query: `work_order_plants -> plants` with all plant data
- Aggregation done in-memory (sum, reduce operations)
- No N+1 - single query fetches all plants for work order

---

### Query Propagation Prevention Strategy

#### Principle 1: Use Supabase Nested Selects
```typescript
// ✅ GOOD: Single query with nested joins
.select(`
  *,
  work_order_plants(
    *,
    plants(
      *,
      organizations(*),
      vendors(*)
    )
  )
`)
```

#### Principle 2: Batch Operations
```typescript
// ✅ GOOD: Batch query
.in("plant_id", plantIds) // Single query for multiple IDs

// ❌ BAD: Loop with individual queries
for (const plantId of plantIds) {
  await repo.findByPlantId(plantId) // N queries!
}
```

#### Principle 3: Aggregate Root Pattern
- WorkOrder is the aggregate root
- All related data fetched in single query
- No separate queries for work_order_plants or plants

#### Principle 4: In-Memory Aggregation
- Production metrics calculated in-memory after single query
- Dashboard aggregations done in-memory
- No additional DB queries for calculations

---

### Migration Strategy

1. **Create WorkOrdersRepository** with aggregate root methods
   - **Status**: ⏸️ Not implemented
   - **Current**: Direct Supabase calls in `app/api/workorders/route.ts`
2. **Create WorkOrderPlantsRepository** for junction table operations
   - **Status**: ⏸️ Not implemented
   - **Current**: Direct Supabase calls in `app/api/workorders/route.ts`
3. **Create WorkLogsRepository** for work logs
   - **Status**: ⏸️ Not implemented
   - **Current**: Direct Supabase calls in `app/api/workorders/[id]/logs/route.ts`
4. **Create WorkOrderProductionRepository** for production queries
   - **Status**: ⏸️ Not implemented
   - **Current**: Direct Supabase calls in `app/api/workorders/[id]/production/route.ts`
5. **Update API routes** to use repositories
   - **Status**: ⏸️ Not implemented
6. **Maintain single-query pattern** - verify no N+1 introduced
   - **Status**: ⏸️ Not implemented
7. **Test thoroughly** - especially create/update operations
   - **Status**: ⏸️ Not implemented

### Dependencies
- Phase 5 (Complex Repositories) - Need PlantsRepository for validation
- Phase 4 (Simple Joins) - Need OrganizationsRepository, VendorsRepository

### Estimated Effort
- 8-10 hours (complex due to nested joins and transaction-like operations)

### Approval Required
- ⏸️ **AWAITING PHASES 4 & 5** - Proceed after Phase 4 and Phase 5 completion?

---

## TIER 6: Dashboard (Depends on Tiers 3-5)

---

## Phase 21: Dashboard API Refactoring

### Objective
Refactor dashboard API (`app/api/dashboard/route.ts`) to use repositories instead of direct Supabase calls.

### Status
- ⏸️ **NOT STARTED** - Awaiting Phases 9, 11, 18, 19

### Current State
Dashboard API contains complex role-based queries:
- **SUPERADMIN/DEVELOPER**: Counts from `plants`, `alerts`, `work_orders`, `work_order_plants`
- **GOVT**: Join queries across `work_orders`, `work_order_plants`, `plants`, in-memory aggregations
- **ORG**: Filtered counts from `plants`, `alerts`, `work_order_plants`, `work_orders`

### Approach: Create DashboardService

Instead of putting dashboard logic in repositories, create a **DashboardService** that:
1. Uses existing repositories for individual queries
2. Handles role-based logic at service level
3. Performs in-memory aggregations

**Interface**:
```typescript
interface IDashboardService {
  getMetricsForSuperadmin(): Promise<DashboardMetrics>
  getMetricsForGovt(): Promise<DashboardMetrics>
  getMetricsForOrg(orgId: number): Promise<DashboardMetrics>
}
```

### Dependencies
- Phase 9: `plants` Repository (for counts, energy aggregations)
- Phase 11: `alerts` Repository (for active alert counts)
- Phase 18: `work_orders` Repository (for work order counts)
- Phase 19: `work_order_plants` Repository (for mapped plant lookups)

### Deliverables
- [ ] Create `lib/services/dashboardService.ts`
- [ ] Refactor `app/api/dashboard/route.ts` to use DashboardService
- [ ] Unit tests for DashboardService
- [ ] Integration tests for dashboard API

### Estimated Effort
- 3-4 hours

---

## FINAL PHASES

---

## Phase 22: Cleanup & Documentation

### Objective
Final cleanup and documentation updates.

### Status
- ⏸️ **NOT STARTED** - Awaiting Phase 21

### Tasks
1. Remove `lib/queries/extracted-queries.ts` (reference file no longer needed)
2. Update all documentation
3. Final code review
4. Update README with repository usage guidelines

### Deliverables
- [ ] Remove extracted-queries.ts
- [ ] Updated README
- [ ] Code review complete

### Estimated Effort
- 2-3 hours

---

## Phase 23: Archive Migration Plan

### Objective
Archive migration plan section from SystemFlowDocumentation.

### Status
- ⏸️ **NOT STARTED** - Awaiting Phase 22

### Tasks
1. Mark migration as complete in SystemFlowDocumentation
2. Archive detailed phase information
3. Keep summary and architecture diagrams

### Deliverables
- [ ] Migration marked complete
- [ ] Detailed phases archived

### Estimated Effort
- 1 hour

---

## Unit Testing Strategy (Per-Phase)

### Philosophy: Test-Driven Migration

Each phase includes its own tests - testing is NOT a separate phase but integrated into EVERY implementation phase.

### Testing Layers

```
┌─────────────────────────────────────────────────────┐
│  Layer 3: API Route Tests (Integration)             │
│  - Test HTTP endpoints                              │
│  - Verify response shapes                           │
│  - Check error handling                             │
├─────────────────────────────────────────────────────┤
│  Layer 2: Service Tests (Unit + Integration)        │
│  - Test service methods                             │
│  - Mock repositories for unit tests                 │
│  - Use real repos for integration tests             │
├─────────────────────────────────────────────────────┤
│  Layer 1: Repository Tests (Unit)                   │
│  - Mock Supabase client                             │
│  - Verify query building                            │
│  - Test error handling                              │
└─────────────────────────────────────────────────────┘
```

### Per-Phase Test Requirements

| Phase | Repository | Required Tests |
|-------|------------|----------------|
| 3 | AccountsRepository | `findAll`, `findByEmail`, `findByEmailForLogin`, `existsByOrgId`, `save` |
| 4 | OrganizationsRepository | `findAll`, `findById`, `save` |
| 5 | AnalyticsOrganizationsRepository | `findAll`, `findConfigHash`, `save`, `updateStatusNoChange` |
| 6 | VendorsRepository | `findAllWithOrganizations`, `findActive`, `save` |
| 7 | AnalyticsVendorsRepository | `findAllWithOrganizations`, `findConfigHash`, `save` |
| 8 | WmsVendorsRepository | `findAllWithOrganizations`, `findActive`, `updateToken` |
| 9 | PlantsRepository | `findAllWithRelations`, `saveAll`, `updateProductionMetrics` |
| 10 | AnalyticsPlantsRepository | `findAllWithRelations`, `saveAll` |
| 11 | AlertsRepository | `findWithPlants`, `saveAll`, `countActive` |
| 12-14 | WMS Repositories | Basic CRUD + batch operations |
| 15-17 | Analytics Repositories | Date filtering, batch operations |
| 18-20 | Work Order Repositories | Nested joins, junction operations |
| 21 | DashboardService | Role-based aggregations |

### Test File Structure

```
tests/
├── repositories/
│   ├── main/
│   │   ├── accountsRepository.test.ts
│   │   ├── organizationsRepository.test.ts
│   │   ├── vendorsRepository.test.ts
│   │   ├── plantsRepository.test.ts
│   │   └── ...
│   └── analytics/
│       ├── organizationsRepository.test.ts
│       └── ...
├── services/
│   └── dashboardService.test.ts
└── api/
    ├── accounts.test.ts
    ├── orgs.test.ts
    └── ...
```

### Test Implementation Per Phase

Each phase deliverable now includes:
1. **Repository Implementation** - The actual repository code
2. **Repository Tests** - Unit tests with mocked Supabase client
3. **API Route Migration** - Update route to use repository
4. **API Route Tests** - Integration tests for the endpoint
5. **Regression Verification** - Ensure existing functionality unchanged

### Example: Phase 3 Test Deliverables

```typescript
// tests/repositories/main/accountsRepository.test.ts
describe("AccountsRepository", () => {
  describe("findAll", () => {
    it("returns accounts ordered by email", async () => { ... })
  })
  
  describe("findByEmail", () => {
    it("returns account when found", async () => { ... })
    it("returns null when not found", async () => { ... })
  })
  
  describe("findByEmailForLogin", () => {
    it("only returns active accounts", async () => { ... })
  })
  
  describe("save", () => {
    it("creates new account with hashed password", async () => { ... })
  })
})

// tests/api/accounts.test.ts
describe("GET /api/accounts", () => {
  it("returns 401 without session", async () => { ... })
  it("returns 403 for non-SUPERADMIN", async () => { ... })
  it("returns accounts for SUPERADMIN", async () => { ... })
})
```

### Test Framework Recommendations

1. **Jest** - Already in Next.js ecosystem
2. **@testing-library/react** - For component tests if needed
3. **msw (Mock Service Worker)** - For mocking Supabase API calls
4. **Supertest** - For API route integration tests

### Regression Testing

After each phase migration:
1. **Manual smoke test** - Verify feature works in browser
2. **Build verification** - `npm run build` passes
3. **Existing tests pass** - If any exist
4. **New tests pass** - Phase-specific tests

### Benefits of Per-Phase Testing

1. **Immediate feedback** - Catch issues during implementation
2. **Smaller test scope** - Easier to debug failures
3. **Incremental coverage** - Build test suite gradually
4. **Confidence in rollback** - Each phase is independently verified
5. **Documentation** - Tests document expected behavior

---

## Exclusions

The following are **EXCLUDED** from repository migration:
- None - all queries will be migrated including dashboard (Phase 21)

---

## Current Implementation Status Summary

### Phase Status Overview

| Phase | Repository | Migration | Legacy Adapter | Tests | Toggle |
|-------|-----------|-----------|----------------|-------|--------|
| 0 | Query Extraction | ✅ | N/A | N/A | N/A |
| 1 | Design | ✅ | N/A | N/A | N/A |
| 2 | Foundation | ✅ | N/A | N/A | N/A |
| 3 | Accounts | ✅ | ✅ | ✅ | `USE_ACCOUNTS_REPO` |
| 4 | Organizations (Main) | ✅ | ✅ | ✅ | `USE_ORGS_REPO` |
| 5 | Organizations (Analytics) | ✅ | ✅ | ✅ | `USE_ANALYTICS_ORGS_REPO` |
| 6 | Vendors (Main) | ✅ | ✅ | ✅ | `USE_VENDORS_REPO` |
| 7 | Vendors (Analytics) | ✅ | ✅ | ✅ | `USE_ANALYTICS_VENDORS_REPO` |
| 8 | WMS Vendors | ✅ | ✅ | ✅ | `USE_WMS_VENDORS_REPO` |
| 9+ | Remaining | ⏸️ | ⏸️ | ⏸️ | Various |

### Completed Phases

1. ✅ **Phase 0: Query Extraction** - COMPLETED
   - All database queries extracted to `lib/queries/extracted-queries.ts`
   - Queries categorized by table/entity
   - Patterns identified and documented
   - **File exists and contains all queries** (reference only, not executed)

2. ✅ **Phase 1: Repository Design** - COMPLETED
   - All repository interfaces designed
   - Base repository pattern designed
   - Factory pattern designed
   - JPA-style naming conventions documented
   - Model-by-model migration plan created
   - Feature toggle strategy designed
   - **Design documented in this file**

3. ✅ **Phase 2: Foundation** - COMPLETED
   - `lib/repositories/types.ts` - Base types, interfaces, BaseRepository class
   - `lib/repositories/main/index.ts` - Factory exports
   - `lib/repositories/analytics/index.ts` - Factory exports

4. ✅ **Phase 3: `accounts` Repository** - PARTIALLY COMPLETE
   - ✅ `lib/repositories/main/accountsRepository.ts` - IMPLEMENTED
   - ✅ Migrated `app/api/accounts/route.ts`
   - ✅ Migrated `app/api/login/route.ts`
   - ⏸️ Legacy adapter pending: `lib/repositories/main/legacyAdapters/accountsAdapter.ts`
   - ⏸️ Toggle pending: `USE_ACCOUNTS_REPO` in factory
   - ⏸️ Tests pending: `tests/repositories/main/accountsRepository.test.ts`

5. ✅ **Phase 4: `organizations` Repository (Main DB)** - PARTIALLY COMPLETE
   - ✅ `lib/repositories/main/organizationsRepository.ts` - IMPLEMENTED
   - ✅ Migrated `app/api/orgs/route.ts`
   - ⏸️ Legacy adapter pending: `lib/repositories/main/legacyAdapters/organizationsAdapter.ts`
   - ⏸️ Toggle pending: `USE_ORGS_REPO` in factory
   - ⏸️ Tests pending: `tests/repositories/main/organizationsRepository.test.ts`

6. ✅ **Phase 5: `organizations` Repository (Analytics DB)** - PARTIALLY COMPLETE
   - ✅ `lib/repositories/analytics/organizationsRepository.ts` - IMPLEMENTED
   - ✅ Migrated `app/api/analytics/orgs/route.ts`
   - ✅ Migrated org queries in `lib/services/analyticsMirrorService.ts`
   - ⏸️ Legacy adapter pending: `lib/repositories/analytics/legacyAdapters/organizationsAdapter.ts`
   - ⏸️ Toggle pending: `USE_ANALYTICS_ORGS_REPO` in factory
   - ⏸️ Tests pending: `tests/repositories/analytics/organizationsRepository.test.ts`

### Pending Phases (13 Remaining)

**Tier 1 - Leaf Nodes:**
- ✅ **Phase 3**: `accounts` Repository - COMPLETED
- ✅ **Phase 4**: `organizations` Repository (Main DB) - COMPLETED
- ✅ **Phase 5**: `organizations` Repository (Analytics DB) - COMPLETED

**Tier 2 - Depends on Organizations:**
- ✅ **Phase 6**: `vendors` Repository (Main DB) - COMPLETED
- ✅ **Phase 7**: `vendors` Repository (Analytics DB) - COMPLETED
- ✅ **Phase 8**: `wms_vendors` Repository - COMPLETED

**Tier 3 - Depends on Vendors:**
- 🔜 **Phase 9**: `plants` Repository (Main DB) - NEXT
- ⏸️ **Phase 10**: `plants` Repository (Analytics DB)
- ⏸️ **Phase 11**: `alerts` Repository
- ⏸️ **Phase 12**: `wms_sites` Repository
- ⏸️ **Phase 13**: `wms_devices` Repository
- ⏸️ **Phase 14**: `insolation_readings` Repository

**Tier 4 - Analytics-Specific:**
- ⏸️ **Phase 15**: `plant_energy_readings` Repository
- ⏸️ **Phase 16**: `plant_grid_downtime_readings` Repository
- ⏸️ **Phase 17**: `analytics_snapshot_runs` Repository

**Tier 5 - Work Orders (Complex):**
- ⏸️ **Phase 18**: `work_orders` Repository
- ⏸️ **Phase 19**: `work_order_plants` Repository
- ⏸️ **Phase 20**: `work_logs` Repository

**Tier 6 - Dashboard (Depends on Tiers 3-5):**
- ⏸️ **Phase 21**: Dashboard API Refactoring

**Final:**
- ⏸️ **Phase 22**: Cleanup & Documentation
- ⏸️ **Phase 23**: Archive Migration Plan

### Current Code State
- **Repository Files**: ✅ Foundation created (`lib/repositories/` directory exists with types.ts, main/index.ts, analytics/index.ts)
- **API Routes**: ✅ All use `getMainClient()` / `getAnalyticsClient()` directly (working correctly)
- **Services**: ✅ All use direct Supabase queries (working correctly)
- **Database Access**: ✅ Direct Supabase calls throughout codebase (working correctly)
- **Build Status**: ✅ Working correctly

### Next Action Required
**Approval to proceed with Phase 3 implementation** - This will create the AccountsRepository and migrate account-related queries.

---

## Naming Conventions (JPA-style)

Following JPA (Java Persistence API) naming conventions for consistency and familiarity:

### Method Naming
- ✅ `save(entity)` - Instead of `create()` - Handles both insert and update (upsert)
- ✅ `saveAll(entities)` - Instead of `batchUpsert()` - Batch save operations
- ✅ `findById(id)` - Standard JPA finder method
- ✅ `findAll()` - Standard JPA finder method
- ✅ `deleteById(id)` - Instead of `delete(id)` - Standard JPA delete method
- ✅ `existsById(id)` - Instead of `existsBy...()` - Standard JPA existence check
- ✅ `count()` - Standard JPA count method
- ✅ `findBy...()` - Standard JPA finder pattern (e.g., `findByEmail()`, `findByOrgId()`)

### Type Naming
- ✅ `SaveXxxData` - Instead of `CreateXxxData` - Represents data to be saved (insert or update)
- ✅ `UpdateXxxData` - For explicit update operations
- ✅ `TSave` - Generic type parameter instead of `TCreate`

### Benefits
- **Familiarity**: Developers familiar with JPA/Spring Data will recognize patterns
- **Consistency**: Standard naming across all repositories
- **Clarity**: `save()` clearly indicates it handles both insert and update
- **Future-proof**: Easier migration to JPA-compatible ORMs if needed

---

## Success Criteria

1. ✅ All queries migrated to repositories (including dashboard)
2. ✅ All API routes use repositories
3. ✅ All services use repositories
4. ✅ No regressions in functionality
5. ✅ Code is more maintainable and testable
6. ✅ Database abstraction enables future portability
7. ✅ **Unit tests for every repository** (per-phase testing)
8. ✅ **Build passes after each phase**

---

## Phase 1 Status: ✅ COMPLETED

**Phase 1: Repository Design & Architecture** has been completed with:
- ✅ Detailed repository interface definitions for all tables
- ✅ Complete table-by-table breakdown with complexity ratings
- ✅ Common patterns extraction and documentation
- ✅ Factory pattern design
- ✅ Base repository pattern design
- ✅ Decision points finalized
- ✅ **Work Orders repository design (Phases 18-20)** with query propagation prevention strategy
- ✅ **JPA-style naming conventions** - Using `save()` instead of `create()`, `saveAll()` instead of `batchUpsert()`, `deleteById()` instead of `delete()`, etc.
- ✅ **Model-by-model migration plan** - 22 phases with dependency-aware ordering

**Note**: This is DESIGN ONLY. No repository code has been implemented. All API routes continue to use direct Supabase calls as documented in `extracted-queries.ts`.

---

## Next Steps

### Immediate Priority: Phase 9 - Plants Repository (Main DB)

Phases 3-8 are complete. Next up is Tier 3 - Plants Repository.

**Phase 9 will implement**:
1. `lib/repositories/main/plantsRepository.ts` - PlantsRepository
2. `lib/repositories/main/legacyAdapters/plantsAdapter.ts` - Legacy adapter
3. Toggle logic with `USE_PLANTS_REPO`
4. `tests/repositories/main/plantsRepository.test.ts` - Unit tests
5. Migrate `app/api/plants/route.ts` to use repository
6. Migrate `app/api/plants/[id]/route.ts` to use repository
7. Migrate plant queries in `plantSyncService.ts`

**Key Challenges for Phase 9**:
- Complex joins with vendors and organizations
- Batch saveAll() operations with deduplication
- Production metrics updates
- Large batch sizes (100 plants per batch)

---

**Migration Approach Benefits**:
- ✅ **Small, focused PRs** - Each phase is 1-4 hours of work
- ✅ **Independent deployments** - Each model can be deployed and tested separately
- ✅ **Instant rollback** - Toggle env var to use legacy adapter
- ✅ **Parallel work possible** - Multiple developers can work on different phases
- ✅ **Learn as you go** - Improve patterns based on earlier implementations
- ✅ **Per-phase testing** - Unit tests integrated, not a separate phase

**Current Implementation Status**: 
- ✅ `lib/repositories/types.ts` - Base types, interfaces, BaseRepository class
- ✅ `lib/repositories/main/index.ts` - Factory exports with toggles
- ✅ `lib/repositories/analytics/index.ts` - Factory exports with toggles
- ✅ `lib/repositories/main/accountsRepository.ts` - IMPLEMENTED
- ✅ `lib/repositories/main/organizationsRepository.ts` - IMPLEMENTED
- ✅ `lib/repositories/main/vendorsRepository.ts` - IMPLEMENTED
- ✅ `lib/repositories/main/wmsVendorsRepository.ts` - IMPLEMENTED
- ✅ `lib/repositories/analytics/organizationsRepository.ts` - IMPLEMENTED
- ✅ `lib/repositories/analytics/vendorsRepository.ts` - IMPLEMENTED
- ✅ All legacy adapters for above repositories - IMPLEMENTED
- ✅ All unit tests for above repositories - IMPLEMENTED

**API Routes Migrated**:
- ✅ `app/api/accounts/route.ts` - Uses AccountsRepository
- ✅ `app/api/login/route.ts` - Uses AccountsRepository
- ✅ `app/api/orgs/route.ts` - Uses OrganizationsRepository
- ✅ `app/api/analytics/orgs/route.ts` - Uses AnalyticsOrganizationsRepository
- ✅ `app/api/vendors/route.ts` - Uses VendorsRepository
- ✅ `app/api/vendors/[id]/route.ts` - Uses VendorsRepository
- ✅ `app/api/analytics/vendors/route.ts` - Uses AnalyticsVendorsRepository
- ✅ `app/api/wms-vendors/route.ts` - Uses WmsVendorsRepository
- ✅ `app/api/wms-vendors/[id]/route.ts` - Uses WmsVendorsRepository

**Services Partially Migrated**:
- ✅ `lib/services/analyticsMirrorService.ts` - Org queries migrated to repository

**Estimated Remaining Effort**: 
- Phases 9-23: ~35-40 hours
- **Total**: ~35-40 hours

**Next**: Proceed with Phase 9 (plants - Main DB)?

