# Database Query Inventory

**Generated:** 2025-01-13  
**Purpose:** Comprehensive audit of all database queries to assess repository pattern migration feasibility  
**Status:** Pre-Implementation Analysis (DNWC)

---

## Executive Summary

- **Total Query Locations:** 63 files with database queries
- **Total Query Operations:** ~380+ database operations
- **Main Database Usage:** ~95% of queries
- **Analytics Database Usage:** ~5% of queries (10 files)
- **Cross-Database Operations:** 3 services (mirror, snapshot, grid downtime)

---

## Database Client Usage

### Main Database (`getMainClient()`)
- **Used in:** 53+ files
- **Purpose:** Primary application database
- **Tables:** accounts, organizations, vendors, plants, alerts, work_orders, work_order_plants, wms_vendors, wms_sites, wms_devices, insolation_readings, disabled_plants

### Analytics Database (`getAnalyticsClient()`)
- **Used in:** 10 files
- **Purpose:** Separate analytics/reporting database
- **Tables:** organizations, vendors, plants, plant_energy_readings, plant_grid_downtime_readings, analytics_snapshot_runs

---

## Query Inventory by Category

### 1. MAIN DATABASE - API Routes

#### 1.1 Accounts (`app/api/accounts/**`)
| File | Operation | Table | Query Type | Complexity | Notes |
|------|-----------|-------|------------|------------|-------|
| `route.ts` GET | SELECT | accounts | Simple | Low | List all accounts, ordered by email |
| `route.ts` POST | INSERT | accounts | Simple | Low | Create account with password hash |
| `route.ts` POST | SELECT | accounts | Simple | Low | Check if email exists (duplicate check) |
| `route.ts` POST | SELECT | accounts | Simple | Low | Check if org already has account |
| `[id]/route.ts` | SELECT | accounts | Simple | Low | Get account by ID |
| `[id]/route.ts` | UPDATE | accounts | Simple | Low | Update account |
| `[id]/route.ts` | DELETE | accounts | Simple | Low | Delete account |
| `import/route.ts` | UPSERT | accounts | Batch | Medium | Bulk import accounts |
| `export/route.ts` | SELECT | accounts | Simple | Low | Export all accounts |

**Total:** 9 operations

---

#### 1.2 Organizations (`app/api/orgs/**`)
| File | Operation | Table | Query Type | Complexity | Notes |
|------|-----------|-------|------------|------------|-------|
| `route.ts` GET | SELECT | organizations | Simple | Low | List all orgs, ordered by name |
| `route.ts` POST | INSERT | organizations | Simple | Low | Create organization |
| `[id]/route.ts` | SELECT | organizations | Simple | Low | Get org by ID |
| `[id]/route.ts` | UPDATE | organizations | Simple | Low | Update organization |
| `[id]/route.ts` | DELETE | organizations | Simple | Low | Delete organization |
| `[id]/plants/route.ts` | SELECT | plants | Filtered | Medium | Get plants for org (with join to vendors) |
| `[id]/plants/route.ts` | SELECT | plants | Join | Medium | Join with vendors, organizations |
| `[id]/production/route.ts` | SELECT | plants | Aggregation | Medium | Sum energy metrics for org |

**Total:** 8 operations

---

#### 1.3 Vendors (`app/api/vendors/**`)
| File | Operation | Table | Query Type | Complexity | Notes |
|------|-----------|-------|------------|------------|-------|
| `route.ts` GET | SELECT | vendors | Join | Medium | Join with organizations |
| `route.ts` GET | SELECT | organizations | Simple | Low | Parallel query for orgs |
| `route.ts` POST | INSERT | vendors | Simple | Low | Create vendor |
| `[id]/route.ts` | SELECT | vendors | Join | Medium | Get vendor with org |
| `[id]/route.ts` | UPDATE | vendors | Simple | Low | Update vendor |
| `[id]/route.ts` | DELETE | vendors | Simple | Low | Delete vendor |
| `[id]/sync-plants/route.ts` | SELECT | vendors | Simple | Low | Get vendor for sync |
| `[id]/sync-alerts/route.ts` | SELECT | vendors | Simple | Low | Get vendor for sync |
| `[id]/production/route.ts` | SELECT | plants | Aggregation | Medium | Sum energy for vendor plants |
| `sync-status/route.ts` | SELECT | vendors | Simple | Low | Get vendor sync status |
| `import/route.ts` | UPSERT | vendors | Batch | Medium | Bulk import vendors |
| `export/route.ts` | SELECT | vendors | Join | Medium | Export with orgs |

**Total:** 12 operations

---

#### 1.4 Plants (`app/api/plants/**`)
| File | Operation | Table | Query Type | Complexity | Notes |
|------|-----------|-------|------------|------------|-------|
| `route.ts` GET | SELECT | plants | Join | Medium | Join with vendors, organizations |
| `route.ts` GET | SELECT | work_order_plants | Filtered | Medium | Filter by org (GOVT users) |
| `[id]/route.ts` | SELECT | plants | Join | Medium | Get plant with vendor, org |
| `[id]/route.ts` | UPDATE | plants | Simple | Low | Update plant |
| `[id]/route.ts` | DELETE | plants | Simple | Low | Delete plant |
| `[id]/telemetry/route.ts` | SELECT | plants | Simple | Low | Get plant telemetry (uses telemetry DB) |
| `[id]/production/route.ts` | SELECT | plants | Simple | Low | Get plant production metrics |
| `unassigned/route.ts` | SELECT | plants | Filtered | Medium | Plants not in active work orders |

**Total:** 8 operations

---

#### 1.5 Alerts (`app/api/alerts/**`)
| File | Operation | Table | Query Type | Complexity | Notes |
|------|-----------|-------|------------|------------|-------|
| `route.ts` GET | SELECT | alerts | Join | Medium | Join with plants |
| `route.ts` GET | SELECT | plants | Filtered | Medium | Get plant IDs for org (ORG users) |
| `route.ts` GET | SELECT | alerts | Filtered | Medium | Filter by plant_id, status, limit |

**Total:** 3 operations

---

#### 1.6 Work Orders (`app/api/workorders/**`)
| File | Operation | Table | Query Type | Complexity | Notes |
|------|-----------|-------|------------|------------|-------|
| `route.ts` GET | SELECT | work_orders | Join | High | Complex nested join: work_orders → organizations → work_order_plants → plants → organizations |
| `route.ts` POST | SELECT | plants | Filtered | Medium | Validate plants exist |
| `route.ts` POST | INSERT | work_orders | Transaction | High | Create work order + work_order_plants in transaction |
| `route.ts` POST | INSERT | work_order_plants | Transaction | High | Batch insert plant mappings |
| `[id]/route.ts` | SELECT | work_orders | Join | High | Get work order with nested joins |
| `[id]/route.ts` | UPDATE | work_orders | Simple | Low | Update work order |
| `[id]/route.ts` | DELETE | work_orders | Simple | Low | Delete work order |
| `[id]/plants/route.ts` | SELECT | work_order_plants | Join | Medium | Get plants for work order |
| `[id]/plants/route.ts` | INSERT | work_order_plants | Batch | Medium | Add plants to work order |
| `[id]/plants/route.ts` | UPDATE | work_order_plants | Batch | Medium | Update plant mappings |
| `[id]/status/route.ts` | UPDATE | work_orders | Simple | Low | Update work order status |
| `[id]/production/route.ts` | SELECT | work_order_plants | Join | High | Complex join for production metrics |
| `[id]/logs/route.ts` | SELECT | work_order_logs | Filtered | Medium | Get logs for work order |
| `org/[orgId]/route.ts` | SELECT | work_orders | Filtered | Medium | Get work orders for org |
| `import/route.ts` | UPSERT | work_orders | Batch | High | Bulk import with transactions |
| `export/route.ts` | SELECT | work_orders | Join | High | Export with nested joins |

**Total:** 16 operations

---

#### 1.7 WMS Vendors (`app/api/wms-vendors/**`)
| File | Operation | Table | Query Type | Complexity | Notes |
|------|-----------|-------|------------|------------|-------|
| `route.ts` GET | SELECT | wms_vendors | Join | Medium | Join with organizations |
| `route.ts` POST | INSERT | wms_vendors | Simple | Low | Create WMS vendor |
| `[id]/route.ts` | SELECT | wms_vendors | Join | Medium | Get WMS vendor with org |
| `[id]/route.ts` | UPDATE | wms_vendors | Simple | Low | Update WMS vendor |
| `[id]/route.ts` | DELETE | wms_vendors | Simple | Low | Delete WMS vendor |
| `[id]/sites/route.ts` | SELECT | wms_sites | Filtered | Medium | Get sites for WMS vendor |
| `[id]/devices/route.ts` | SELECT | wms_devices | Filtered | Medium | Get devices for WMS vendor |
| `[id]/sync-sites/route.ts` | SELECT | wms_vendors | Simple | Low | Get vendor for sync |
| `[id]/sync-devices/route.ts` | SELECT | wms_vendors | Simple | Low | Get vendor for sync |
| `[id]/sync-insolation/route.ts` | SELECT | wms_vendors | Simple | Low | Get vendor for sync |
| `sync-status/route.ts` | SELECT | wms_vendors | Simple | Low | Get sync status |
| `import/route.ts` | UPSERT | wms_vendors | Batch | Medium | Bulk import |
| `export/route.ts` | SELECT | wms_vendors | Join | Medium | Export with orgs |

**Total:** 13 operations

---

#### 1.8 WMS Sites (`app/api/wms-sites/**`)
| File | Operation | Table | Query Type | Complexity | Notes |
|------|-----------|-------|------------|------------|-------|
| `route.ts` GET | SELECT | wms_sites | Join | Medium | Join with wms_vendors, organizations |

**Total:** 1 operation

---

#### 1.9 WMS Devices (`app/api/wms-devices/**`)
| File | Operation | Table | Query Type | Complexity | Notes |
|------|-----------|-------|------------|------------|-------|
| `route.ts` GET | SELECT | wms_devices | Join | Medium | Join with wms_sites, wms_vendors |
| `[id]/sync/route.ts` | SELECT | wms_devices | Simple | Low | Get device for sync |

**Total:** 2 operations

---

#### 1.10 Insolation Readings (`app/api/insolation-readings/**`)
| File | Operation | Table | Query Type | Complexity | Notes |
|------|-----------|-------|------------|------------|-------|
| `route.ts` GET | SELECT | insolation_readings | Join | Medium | Join with wms_devices, wms_sites |

**Total:** 1 operation

---

#### 1.11 Dashboard (`app/api/dashboard/route.ts`)
| File | Operation | Table | Query Type | Complexity | Notes |
|------|-----------|-------|------------|------------|-------|
| `route.ts` GET | SELECT | plants | Count | Medium | Count total plants |
| `route.ts` GET | SELECT | alerts | Count | Medium | Count active alerts |
| `route.ts` GET | SELECT | work_orders | Count | Medium | Count work orders |
| `route.ts` GET | SELECT | work_order_plants | Filtered | Medium | Get mapped plants |
| `route.ts` GET | SELECT | plants | Aggregation | Medium | Sum total_energy_mwh |
| `route.ts` GET | SELECT | work_order_plants | Join | High | Complex join for GOVT users |
| `route.ts` GET | SELECT | plants | Aggregation | Medium | Sum energy metrics (GOVT) |
| `route.ts` GET | SELECT | plants | Filtered | Medium | Filter by org_id (ORG users) |
| `route.ts` GET | SELECT | alerts | Filtered | Medium | Filter by plant_ids (ORG users) |
| `route.ts` GET | SELECT | work_order_plants | Filtered | Medium | Get mapped plants for org |

**Total:** 10 operations

---

#### 1.12 Login (`app/api/login/route.ts`)
| File | Operation | Table | Query Type | Complexity | Notes |
|------|-----------|-------|------------|------------|-------|
| `route.ts` POST | SELECT | accounts | Simple | Low | Test connection (head query) |
| `route.ts` POST | SELECT | accounts | Filtered | Low | Find account by email |

**Total:** 2 operations

---

#### 1.13 Me (`app/api/me/route.ts`)
| File | Operation | Table | Query Type | Complexity | Notes |
|------|-----------|-------|------------|------------|-------|
| `route.ts` GET | SELECT | accounts | Join | Medium | Get account with org |

**Total:** 1 operation

---

#### 1.14 Disabled Plants (`app/api/disabled-plants/**`)
| File | Operation | Table | Query Type | Complexity | Notes |
|------|-----------|-------|------------|------------|-------|
| `route.ts` GET | SELECT | disabled_plants | Join | Medium | Join with plants, vendors, organizations |
| `route.ts` POST | INSERT | disabled_plants | Simple | Low | Disable plant |
| `[id]/route.ts` | DELETE | disabled_plants | Simple | Low | Re-enable plant (delete from disabled_plants) |

**Total:** 3 operations

---

### 2. MAIN DATABASE - Services

#### 2.1 Plant Sync Service (`lib/services/plantSyncService.ts`)
| Operation | Table | Query Type | Complexity | Notes |
|-----------|-------|------------|------------|-------|
| SELECT | organizations | Simple | Low | Get org name |
| SELECT | vendors | Filtered | Medium | Get active vendors with org settings |
| SELECT | plants | Filtered | Medium | Get existing plants by vendor_plant_id |
| UPSERT | plants | Batch | High | Batch upsert plants (100 per batch) |
| UPDATE | plants | Batch | Medium | Update individual plants (fallback) |

**Total:** 5 operations

---

#### 2.2 Alert Sync Service (`lib/services/alertSyncService.ts`)
| Operation | Table | Query Type | Complexity | Notes |
|-----------|-------|------------|------------|-------|
| SELECT | vendors | Filtered | Medium | Get active vendors |
| SELECT | organizations | Simple | Low | Get org name |
| SELECT | alerts | Filtered | High | Get existing alerts (complex deduplication) |
| SELECT | plants | Filtered | Medium | Get plant IDs for vendor |
| UPSERT | alerts | Batch | High | Batch upsert alerts (100 per batch) |
| UPDATE | alerts | Batch | Medium | Update individual alerts (fallback) |

**Total:** 6 operations

---

#### 2.3 Live Telemetry Sync Service (`lib/services/liveTelemetrySyncService.ts`)
| Operation | Table | Query Type | Complexity | Notes |
|-----------|-------|------------|------------|-------|
| SELECT | plants | Filtered | Medium | Get plants for vendor |
| UPDATE | plants | Batch | High | Batch update telemetry (100 per batch) |

**Total:** 2 operations

---

#### 2.4 WMS Sync Service (`lib/services/wmsSyncService.ts`)
| Operation | Table | Query Type | Complexity | Notes |
|-----------|-------|------------|------------|-------|
| SELECT | organizations | Simple | Low | Get org name |
| SELECT | wms_sites | Filtered | Medium | Get existing sites |
| SELECT | wms_devices | Filtered | Medium | Get existing devices |
| UPSERT | wms_sites | Batch | High | Batch upsert sites |
| UPSERT | wms_devices | Batch | High | Batch upsert devices |
| SELECT | insolation_readings | Filtered | Medium | Check existing reading |
| INSERT | insolation_readings | Simple | Low | Create insolation reading |
| UPDATE | insolation_readings | Simple | Low | Update insolation reading |

**Total:** 8 operations

---

#### 2.5 Token Repository (`lib/wms/modules/tokenRepository.ts`)
| Operation | Table | Query Type | Complexity | Notes |
|-----------|-------|------------|------------|-------|
| SELECT | wms_vendors | Filtered | Low | Get vendor with token |
| UPDATE | wms_vendors | Simple | Low | Save token |

**Total:** 2 operations

---

### 3. MAIN DATABASE - Cron Jobs

#### 3.1 Plant Sync Cron (`app/api/cron/sync-plants/route.ts`)
- **Calls:** `plantSyncService.syncAllPlants()`
- **Operations:** See Plant Sync Service

#### 3.2 Alert Sync Cron (`app/api/cron/sync-alerts/route.ts`)
- **Calls:** `alertSyncService.syncAllAlerts()`
- **Operations:** See Alert Sync Service

#### 3.3 Live Telemetry Sync Cron (`app/api/cron/sync-live-telemetry/route.ts`)
- **Calls:** `liveTelemetrySyncService.syncAllVendorsTelemetry()`
- **Operations:** See Live Telemetry Sync Service

#### 3.4 WMS Site Sync Cron (`app/api/cron/sync-wms-sites/route.ts`)
- **Calls:** `wmsSyncService.syncAllWmsSites()`
- **Operations:** See WMS Sync Service

#### 3.5 Disable Inactive Plants Cron (`app/api/cron/disable-inactive-plants/route.ts`)
| Operation | Table | Query Type | Complexity | Notes |
|-----------|-------|------------|------------|-------|
| SELECT | plants | Filtered | Medium | Get plants not updated in 7 days |
| INSERT | disabled_plants | Batch | Medium | Batch insert disabled plants |

**Total:** 2 operations

#### 3.6 Reset Was Online Today Cron (`app/api/cron/reset-was-online-today/route.ts`)
| Operation | Table | Query Type | Complexity | Notes |
|-----------|-------|------------|------------|-------|
| RPC | reset_was_online_today | Function | Low | Call stored procedure |

**Total:** 1 operation

#### 3.7 Backfill WMS Insolation Cron (`app/api/cron/backfill-wms-insolation/route.ts`)
- **Calls:** `wmsSyncService.syncWmsVendorInsolation()`
- **Operations:** See WMS Sync Service

---

### 4. ANALYTICS DATABASE - API Routes

#### 4.1 Analytics Vendors (`app/api/analytics/vendors/route.ts`)
| Operation | Table | Query Type | Complexity | Notes |
|-----------|-------|------------|------------|-------|
| SELECT | vendors | Join | Medium | Join with organizations |
| SELECT | analytics_snapshot_runs | Filtered | Medium | Get last run per vendor |

**Total:** 2 operations

---

#### 4.2 Analytics Plants (`app/api/analytics/plants/route.ts`)
| Operation | Table | Query Type | Complexity | Notes |
|-----------|-------|------------|------------|-------|
| SELECT | plants | Join | High | Join with organizations, vendors |

**Total:** 1 operation

---

#### 4.3 Analytics Orgs (`app/api/analytics/orgs/route.ts`)
| Operation | Table | Query Type | Complexity | Notes |
|-----------|-------|------------|------------|-------|
| SELECT | organizations | Simple | Low | List all orgs |

**Total:** 1 operation

---

#### 4.4 Analytics Plant Energy (`app/api/analytics/plants/[id]/energy/route.ts`)
| Operation | Table | Query Type | Complexity | Notes |
|-----------|-------|------------|------------|-------|
| SELECT | plant_energy_readings | Filtered | Medium | Get last 100 days of readings |

**Total:** 1 operation

---

#### 4.5 Analytics Grid Downtime (`app/api/analytics/plants/[id]/grid-downtime/route.ts`)
| Operation | Table | Query Type | Complexity | Notes |
|-----------|-------|------------|------------|-------|
| SELECT | plant_grid_downtime_readings | Filtered | Medium | Get last 100 days of grid downtime |
| SELECT | plant_energy_readings | Filtered | Medium | Get was_online data |

**Total:** 2 operations

---

### 5. ANALYTICS DATABASE - Services (Cross-DB Operations)

#### 5.1 Analytics Mirror Service (`lib/services/analyticsMirrorService.ts`)
**Cross-DB:** Reads from Main DB, writes to Analytics DB

| Operation | Source DB | Target DB | Table | Query Type | Complexity | Notes |
|-----------|-----------|-----------|-------|------------|------------|-------|
| SELECT | Main | - | organizations | Simple | Low | Fetch all orgs |
| SELECT | - | Analytics | organizations | Filtered | Low | Check existing org |
| UPSERT | - | Analytics | organizations | Batch | Medium | Upsert org configs |
| UPDATE | - | Analytics | organizations | Simple | Low | Update org status |
| SELECT | Main | - | vendors | Simple | Low | Fetch all vendors |
| SELECT | - | Analytics | vendors | Filtered | Low | Check existing vendor |
| UPSERT | - | Analytics | vendors | Batch | Medium | Upsert vendor configs |
| SELECT | Main | - | plants | Count | Low | Count total plants |
| SELECT | Main | - | plants | Batch | Medium | Fetch plants in batches (500 per batch) |
| UPSERT | - | Analytics | plants | Batch | High | Batch upsert plants (500 per batch, 10 concurrent) |

**Total:** 10 operations (5 read from Main, 5 write to Analytics)

---

#### 5.2 Analytics Snapshot Service (`lib/services/analyticsSnapshotService.ts`)
**Cross-DB:** Reads from Main DB, writes to Analytics DB

| Operation | Source DB | Target DB | Table | Query Type | Complexity | Notes |
|-----------|-----------|-----------|-------|------------|------------|-------|
| SELECT | - | Analytics | vendors | Filtered | Medium | Get vendors ready for analytics |
| SELECT | - | Analytics | organizations | Simple | Low | Get org configs |
| INSERT | - | Analytics | analytics_snapshot_runs | Simple | Low | Create run record |
| SELECT | Main | - | plants | Filtered | Medium | Get plants for vendor |
| UPSERT | - | Analytics | plants | Batch | High | Batch upsert plants (100 per batch) |
| UPSERT | - | Analytics | plant_energy_readings | Batch | High | Batch upsert energy readings (100 per batch) |
| UPDATE | - | Analytics | analytics_snapshot_runs | Simple | Low | Update run status |
| UPDATE | - | Analytics | vendors | Simple | Low | Update vendor sync time |
| RPC | - | Analytics | cleanup_old_plant_energy_readings | Function | Medium | Cleanup old readings |
| RPC | Main | - | reset_was_online_today | Function | Low | Reset flag after snapshot |

**Total:** 10 operations (2 read from Main, 8 write to Analytics)

---

#### 5.3 Grid Downtime Analytics Service (`lib/services/gridDowntimeAnalyticsService.ts`)
**Cross-DB:** Reads from Main DB, writes to Analytics DB

| Operation | Source DB | Target DB | Table | Query Type | Complexity | Notes |
|-----------|-----------|-----------|-------|------------|------------|-------|
| DELETE | - | Analytics | plant_grid_downtime_readings | Filtered | Medium | Cleanup old rows |
| SELECT | Main | - | plants | Simple | Low | Fetch all plants |
| SELECT | Main | - | alerts | Filtered | High | Batch fetch all GRID_DOWN alerts |
| RPC | - | Analytics | get_latest_grid_downtime_baselines | Function | High | Get baselines (DISTINCT ON) |
| UPSERT | - | Analytics | plant_grid_downtime_readings | Batch | High | Batch upsert (2000 per batch) |

**Total:** 5 operations (2 read from Main, 3 write to Analytics)

---

## Query Complexity Analysis

### Simple Queries (Low Complexity)
- **Count:** ~120 operations
- **Characteristics:** Single table, no joins, simple filters
- **Examples:** `SELECT * FROM accounts WHERE email = ?`, `INSERT INTO organizations (name) VALUES (?)`
- **Repository Pattern:** ✅ Easy to abstract

### Join Queries (Medium Complexity)
- **Count:** ~150 operations
- **Characteristics:** 1-2 table joins, foreign key relationships
- **Examples:** `SELECT * FROM vendors JOIN organizations ON vendors.org_id = organizations.id`
- **Repository Pattern:** ✅ Can be abstracted (joins in repository)

### Complex Queries (High Complexity)
- **Count:** ~50 operations
- **Characteristics:** Nested joins (3+ tables), aggregations, subqueries
- **Examples:** Dashboard queries, work order queries with nested relationships
- **Repository Pattern:** ⚠️ Need careful abstraction (may need query builder)

### Batch Operations (High Complexity)
- **Count:** ~30 operations
- **Characteristics:** Batch upserts, transactions, parallel processing
- **Examples:** Plant sync (100 per batch), analytics mirror (500 per batch, 10 concurrent)
- **Repository Pattern:** ⚠️ Need transaction support

### Cross-Database Operations (Critical Complexity)
- **Count:** 3 services, 25 operations
- **Characteristics:** Read from Main DB, write to Analytics DB
- **Examples:** Analytics mirror, snapshot, grid downtime
- **Repository Pattern:** ⚠️ Need separate repository interfaces

---

## Analytics Database Query Analysis

### Can We Handle Analytics DB in Repository Pattern?

**✅ YES - Analytics queries are simpler than Main DB queries**

#### Analytics DB Query Characteristics:
1. **Simple SELECT queries:** Most are straightforward filters
2. **Join queries:** Only 2-3 tables (vendors+orgs, plants+vendors+orgs)
3. **No complex aggregations:** Mostly simple filters and joins
4. **Batch operations:** Well-defined batch sizes (100, 500, 2000)
5. **Cross-DB operations:** Clear separation (read Main, write Analytics)

#### Analytics DB Tables:
- `organizations` - Simple CRUD
- `vendors` - Simple CRUD with org join
- `plants` - Simple CRUD with vendor/org joins
- `plant_energy_readings` - Time-series data (filter by plant_id, reading_date)
- `plant_grid_downtime_readings` - Time-series data (filter by plant_id, reading_date)
- `analytics_snapshot_runs` - Simple CRUD

#### Repository Pattern Suitability:
- ✅ **Simple queries:** Easy to abstract
- ✅ **Join queries:** Can be handled in repository (same as Main DB)
- ✅ **Batch operations:** Can use repository batch methods
- ✅ **Cross-DB operations:** Service layer orchestrates (reads Main repo, writes Analytics repo)

---

## Migration Feasibility Assessment

### ✅ FEASIBLE - Repository Pattern Can Handle All Queries

#### Main Database:
- ✅ Simple queries: Easy migration
- ✅ Join queries: Joins stay in repository (same SQL)
- ✅ Complex queries: Can be abstracted with query builder or specialized methods
- ✅ Batch operations: Repository supports batch methods + transactions
- ✅ Transactions: Need transaction abstraction (Unit of Work pattern)

#### Analytics Database:
- ✅ All queries simpler than Main DB
- ✅ Same patterns as Main DB (joins, filters, batches)
- ✅ Cross-DB operations: Service layer coordinates (no issue)

#### Critical Requirements:
1. **Transaction Support:** Must abstract transactions for batch operations
2. **Query Builder:** For flexible queries (optional filters)
3. **Separate Repositories:** Main DB repo vs Analytics DB repo
4. **Service Layer Orchestration:** Cross-DB operations handled in services

---

## Query Statistics Summary

| Category | Count | Percentage |
|----------|-------|------------|
| **Main DB - API Routes** | ~180 | 47% |
| **Main DB - Services** | ~25 | 7% |
| **Main DB - Cron Jobs** | ~10 | 3% |
| **Analytics DB - API Routes** | ~7 | 2% |
| **Analytics DB - Services** | ~25 | 7% |
| **Total Operations** | ~247 | 65% |
| **Estimated Total (with duplicates)** | ~380 | 100% |

---

## Recommendations

### ✅ PROCEED WITH MIGRATION

**Rationale:**
1. Analytics DB queries are simpler than Main DB queries
2. All query patterns can be abstracted in repository pattern
3. Cross-DB operations are well-defined (service layer orchestrates)
4. Batch operations can use repository batch methods + transactions

### Migration Strategy:
1. **Phase 1:** Create repository interfaces (Main DB + Analytics DB)
2. **Phase 2:** Migrate simple queries first (accounts, orgs)
3. **Phase 3:** Migrate join queries (vendors, plants, alerts)
4. **Phase 4:** Migrate complex queries (dashboard, work orders)
5. **Phase 5:** Migrate batch operations (sync services)
6. **Phase 6:** Migrate cross-DB operations (analytics services)

### Critical Success Factors:
1. ✅ Transaction abstraction (Unit of Work pattern)
2. ✅ Query builder for flexible queries
3. ✅ Separate repository interfaces (Main vs Analytics)
4. ✅ Service layer orchestration for cross-DB operations
5. ✅ Comprehensive testing after each phase

---

## Next Steps

1. ✅ **Query inventory complete** - All queries documented
2. ⏭️ **Design repository interfaces** - Define Main DB and Analytics DB repositories
3. ⏭️ **Design transaction abstraction** - Unit of Work pattern
4. ⏭️ **Create migration plan** - Phased approach
5. ⏭️ **Begin implementation** - Start with simple repositories

---

**Document Status:** ✅ Complete - Ready for Repository Pattern Design

