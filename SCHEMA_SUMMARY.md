# Database Schema Summary - Fresh Install

## Overview
This document describes the complete database schema for WOMS (Work Order Management System) as a fresh install. All migrations have been consolidated into `001_initial_schema.sql`.

## Schema Structure

### Core Tables

#### 1. **accounts** (Authentication)
- Custom authentication (NOT Supabase Auth)
- One account per organization (for ORG type)
- Types: SUPERADMIN, ORG, GOVT
- **Relationships:**
  - `org_id` → `organizations.id` (nullable, required for ORG type)

#### 2. **organizations**
- Organizations in the system
- **Relationships:**
  - Referenced by: `accounts.org_id`, `vendors.org_id`, `plants.org_id`

#### 3. **vendors**
- Vendor integrations (Solarman, Sungrow, etc.)
- **Mapped to organizations** (one org can have multiple vendors)
- **Relationships:**
  - `org_id` → `organizations.id` (required for vendor-org mapping)
  - Referenced by: `plants.vendor_id`

#### 4. **plants**
- Solar plants with production metrics
- **Production Metrics** (from Production Overview dashboard):
  - `capacity_kw` - Installed Capacity
  - `current_power_kw` - Current Power
  - `daily_energy_mwh` - Daily Energy
  - `monthly_energy_mwh` - Monthly Energy
  - `yearly_energy_mwh` - Yearly Energy
  - `total_energy_mwh` - Total Energy
  - `performance_ratio` - PR (0-1, shown as percentage)
  - `last_update_time` - Last sync timestamp
- **Relationships:**
  - `org_id` → `organizations.id` (required)
  - `vendor_id` → `vendors.id` (required)
  - Referenced by: `work_order_plants.plant_id`, `alerts.plant_id`, `work_order_plant_eff.plant_id`
- **Constraints:**
  - Unique: `(vendor_id, vendor_plant_id)` - prevents duplicate plants from same vendor

#### 5. **work_orders**
- Static work orders (no status field per requirements)
- **Relationships:**
  - `created_by` → `accounts.id`
  - Referenced by: `work_order_plants.work_order_id`, `work_order_plant_eff.work_order_id`

#### 6. **work_order_plants**
- Junction table: Work Orders ↔ Plants
- **Constraints:**
  - Unique: `(work_order_id, plant_id)` - prevents duplicate plant assignments
  - Unique: `(plant_id) WHERE is_active = true` - **one active work order per plant**
- **Business Rules:**
  - Plants can only be in ONE active work order
  - Work orders can only contain plants from the SAME organization

#### 7. **alerts**
- System alerts from vendors
- **Relationships:**
  - `plant_id` → `plants.id`

#### 8. **work_order_plant_eff**
- Efficiency metrics for plants in work orders
- **Relationships:**
  - `work_order_id` → `work_orders.id`
  - `plant_id` → `plants.id`

## Key Business Rules

### 1. Organization-Vendor-Plant Hierarchy
```
Organization (1)
  └── Vendors (many, same or different types)
       └── Plants (many per vendor)
```

### 2. Work Order Constraints
- **Single Organization**: All plants in a work order must belong to the same organization
- **One Active WO per Plant**: A plant can only be in ONE active work order at a time
- **Static Work Orders**: No status field (per requirements)

### 3. Account-Organization Relationship
- **One Account per Org**: Each organization has exactly ONE account (type: ORG)
- **SUPERADMIN/GOVT**: No org_id (system-level accounts)

## Production Metrics Flow

### Data Source
- Fetched from vendor APIs (e.g., Solarman v2 search endpoint)
- Stored during plant sync operation

### Aggregation Levels
1. **Plant Level**: Individual plant metrics
2. **Vendor Level**: Sum/Average across all plants for that vendor
3. **Work Order Level**: Sum/Average across all plants in work order (for GOVT admin)

### Metrics Stored
- Current Power (kW)
- Installed Capacity (kWp) - already exists as `capacity_kw`
- Daily Energy (MWh)
- Monthly Energy (MWh)
- Yearly Energy (MWh)
- Total Energy (MWh)
- Performance Ratio (PR) - 0-1 range, displayed as percentage
- Last Update Time

## Migration Files

### Fresh Install (Use This)
- `001_initial_schema.sql` - **Complete schema** (includes all features)
- `002_rls_policies.sql` - Row Level Security policies
- `003_telemetry_db_schema.sql` - Separate telemetry database
- `004_manual_user_setup.sql` - Default users with bcrypt hashes

### Upgrade Path (For Existing Installations)
- `006_add_org_id_to_vendors.sql` - Adds org_id to vendors (obsolete, now in 001)
- `007_add_plant_production_metrics.sql` - Adds production metrics (obsolete, now in 001)

## Indexes

### Performance Indexes
- `idx_vendors_org_id` - Fast vendor lookup by org
- `idx_plants_org_id` - Fast plant lookup by org
- `idx_plants_vendor_id` - Fast plant lookup by vendor
- `idx_plants_vendor_id_org_id` - Composite index for vendor+org queries
- `idx_plants_last_update_time` - Fast queries by update time
- `uq_active_plant` - Unique constraint for one active WO per plant

## Verification

The schema includes automatic verification that:
- All 8 tables are created
- Production metrics columns exist in plants table
- org_id column exists in vendors table

## Notes

- **No ALTER statements needed** for fresh installs - everything is in CREATE TABLE
- **Clean slate approach** - DROP statements ensure clean install
- **All relationships properly defined** with foreign keys and CASCADE deletes
- **Production metrics** are optional (nullable) - populated during sync

