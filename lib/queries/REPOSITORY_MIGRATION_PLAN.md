# Repository Pattern Migration Plan

## Executive Summary

This document outlines a phased approach to migrate all database queries from direct Supabase calls to a centralized repository pattern. The migration will improve maintainability, testability, and enable future database portability.

**Status**: Planning Phase - Awaiting approval before implementation

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

## Phase 2: Base Repository & Types (Foundation)

### Objective
Create foundation: base repository class, types, interfaces.

### Tasks
1. Create `lib/repositories/types.ts`:
   - Base repository interface
   - Common types (BatchResult, RepositoryOptions, etc.)
   - Base repository class with common CRUD

2. Create factory pattern:
   - `getMainClient()` / `getAnalyticsClient()` usage
   - Repository factory functions

### Dependencies
- None (foundation phase)

### Estimated Effort
- 2-3 hours

### Approval Required
- ✅ Proceed with Phase 2?

---

## Phase 3: Simple CRUD Repositories (Low Risk)

### Objective
Implement repositories for simple tables with minimal joins.

### Tables (Priority Order)
1. **accounts** - Simple CRUD, email lookup
2. **organizations** (Main DB) - Simple CRUD
3. **organizations** (Analytics DB) - CRUD + config operations

### Migration Strategy
- Create repository
- Update API routes one at a time
- Test each route
- Verify no regressions

### Dependencies
- Phase 2 (Base Repository)

### Estimated Effort
- 4-6 hours

### Approval Required
- ✅ Proceed with Phase 3?

---

## Phase 4: Repositories with Simple Joins

### Objective
Implement repositories for tables with simple joins (1-2 level).

### Tables (Priority Order)
1. **vendors** (Main DB) - CRUD + join with organizations
2. **vendors** (Analytics DB) - CRUD + join + config operations
3. **wms_vendors** - CRUD + join with organizations
4. **alerts** - CRUD + join with plants, filtering

### Migration Strategy
- Create repository with join methods
- Update API routes
- Update services that use these queries
- Test thoroughly

### Dependencies
- Phase 3 (Simple CRUD)

### Estimated Effort
- 6-8 hours

### Approval Required
- ✅ Proceed with Phase 4?

---

## Phase 5: Complex Repositories (Plants & WMS)

### Objective
Implement repositories for complex tables with multiple relationships and batch operations.

### Tables (Priority Order)
1. **plants** (Main DB) - CRUD + joins + batch upsert + production metrics
2. **plants** (Analytics DB) - CRUD + joins + batch upsert
3. **wms_sites** - CRUD + batch upsert + deduplication
4. **wms_devices** - CRUD + batch upsert + deduplication
5. **insolation_readings** - CRUD + upsert by device/date

### Migration Strategy
- Create repository with all query patterns
- Update API routes
- Update services (plantSyncService, wmsSyncService)
- Test batch operations carefully
- Verify deduplication logic

### Dependencies
- Phase 4 (Simple Joins)

### Estimated Effort
- 10-12 hours

### Approval Required
- ✅ Proceed with Phase 5?

---

## Phase 6: Analytics-Specific Repositories

### Objective
Implement repositories for analytics-specific tables and operations.

### Tables (Priority Order)
1. **plant_energy_readings** - CRUD + date filtering + batch upsert
2. **plant_grid_downtime_readings** - CRUD + date filtering + baseline queries + batch upsert
3. **analytics_snapshot_runs** - CRUD + vendor grouping + status tracking

### Migration Strategy
- Create repositories
- Update analytics API routes
- Update services (analyticsSnapshotService, gridDowntimeAnalyticsService)
- Test date filtering and aggregations
- Verify baseline calculations

### Dependencies
- Phase 5 (Complex Repositories)

### Estimated Effort
- 6-8 hours

### Approval Required
- ✅ Proceed with Phase 6?

---

## Phase 7: Service Layer Migration

### Objective
Migrate all services to use repositories instead of direct Supabase calls.

### Services (Priority Order)
1. **analyticsMirrorService** - Cross-database operations
2. **analyticsSnapshotService** - Analytics operations
3. **gridDowntimeAnalyticsService** - Complex calculations
4. **plantSyncService** - Batch operations
5. **alertSyncService** - Batch operations
6. **wmsSyncService** - WMS operations

### Migration Strategy
- Update services one at a time
- Replace direct Supabase calls with repository methods
- Maintain existing business logic
- Test each service thoroughly
- Verify cron jobs still work

### Dependencies
- Phases 3-6 (All Repositories)

### Estimated Effort
- 8-10 hours

### Approval Required
- ✅ Proceed with Phase 7?

---

## Phase 8: Testing & Validation

### Objective
Comprehensive testing and validation of all migrations.

### Tasks
1. Unit tests for repositories (if applicable)
2. Integration tests for API routes
3. End-to-end tests for services
4. Performance validation
5. Regression testing

### Dependencies
- Phase 7 (Service Migration)

### Estimated Effort
- 4-6 hours

### Approval Required
- ✅ Proceed with Phase 8?

---

## Phase 9: Cleanup & Documentation

### Objective
Final cleanup and documentation.

### Tasks
1. Remove `lib/queries/extracted-queries.ts` (reference file)
2. Update documentation
3. Code review
4. Final validation

### Dependencies
- Phase 8 (Testing)

### Estimated Effort
- 2-3 hours

### Approval Required
- ✅ Proceed with Phase 9?

---

## Risk Assessment

### High Risk Areas
1. **Batch Operations**: Complex batch upsert logic in services
2. **Cross-Database Operations**: analyticsMirrorService reads from Main, writes to Analytics
3. **Complex Joins**: Plants with work orders (excluded, but related queries exist)
4. **Transaction Handling**: Some operations may need transactions

### Mitigation Strategies
1. **Incremental Migration**: One table/service at a time
2. **Feature Flags**: Ability to rollback if needed
3. **Thorough Testing**: Test each phase before proceeding
4. **Code Review**: Review each phase before next

---

## Phase 10: Work Orders Repositories (Complex Nested Joins)

### Objective
Implement repositories for work orders using aggregate root pattern with single-query nested joins to avoid N+1 query propagation.

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
2. **Create WorkOrderPlantsRepository** for junction table operations
3. **Create WorkLogsRepository** for work logs
4. **Create WorkOrderProductionRepository** for production queries
5. **Update API routes** to use repositories
6. **Maintain single-query pattern** - verify no N+1 introduced
7. **Test thoroughly** - especially create/update operations

### Dependencies
- Phase 5 (Complex Repositories) - Need PlantsRepository for validation
- Phase 4 (Simple Joins) - Need OrganizationsRepository, VendorsRepository

### Estimated Effort
- 8-10 hours (complex due to nested joins and transaction-like operations)

### Approval Required
- ✅ Proceed with Phase 10?

---

## Exclusions

The following are **EXCLUDED** from migration per requirements:
- `dashboard` route queries (complex aggregations, role-based logic)
- Any queries involving work orders that are part of dashboard aggregations

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

1. ✅ All queries (except exclusions) migrated to repositories
2. ✅ All API routes use repositories
3. ✅ All services use repositories
4. ✅ No regressions in functionality
5. ✅ Code is more maintainable and testable
6. ✅ Database abstraction enables future portability

---

## Phase 1 Status: ✅ COMPLETED

**Phase 1: Repository Design & Architecture** has been completed with:
- ✅ Detailed repository interface definitions for all tables
- ✅ Complete table-by-table breakdown with complexity ratings
- ✅ Common patterns extraction and documentation
- ✅ Factory pattern design
- ✅ Base repository pattern design
- ✅ Decision points finalized
- ✅ **Work Orders repository design (Phase 10)** with query propagation prevention strategy
- ✅ **JPA-style naming conventions** - Using `save()` instead of `create()`, `saveAll()` instead of `batchUpsert()`, `deleteById()` instead of `delete()`, etc.

---

## Next Steps

**READY FOR PHASE 2: Base Repository & Types (Foundation)**

Phase 1 design is complete and documented above, including work orders design with N+1 prevention. The next phase will implement:
1. `lib/repositories/types.ts` with base interfaces and classes
2. Factory pattern implementation
3. Common types and utilities

**Question**: Should I proceed with Phase 2 implementation, or would you like to review/modify the Phase 1 design first?

