# Vendor Onboarding Guide

This document outlines the requirements and process for onboarding a new vendor integration into WOMS (Work Order Management System). Use this guide to understand what data is required, how it's stored, and what needs to be implemented.

## Table of Contents

1. [Overview](#overview)
2. [Vendor Configuration Requirements](#vendor-configuration-requirements)
3. [Database Schema](#database-schema)
4. [Required API Endpoints](#required-api-endpoints)
5. [Data Mapping Requirements](#data-mapping-requirements)
6. [Solarman Example](#solarman-example)
7. [Implementation Checklist](#implementation-checklist)
8. [Testing Requirements](#testing-requirements)

---

## Overview

WOMS uses a vendor adapter pattern to integrate with different solar inverter vendors. Each vendor must implement a standardized interface that provides:

- **Plant Listing**: Fetch all plants/stations from the vendor
- **Authentication**: Handle vendor API authentication and token management
- **Production Metrics**: Extract and normalize production data
- **Telemetry Data**: (Optional) Real-time and historical telemetry
- **Alerts**: (Optional) Alert/notification synchronization

The system stores vendor-specific data in a normalized format in the database, allowing for consistent UI and reporting across all vendors.

---

## Vendor Configuration Requirements

### 1. Database Configuration

When creating a vendor in the database, the following fields are required:

#### `vendors` Table

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | TEXT | ✅ Yes | Vendor display name (e.g., "Solarman Production") |
| `vendor_type` | ENUM | ✅ Yes | One of: `SOLARMAN`, `SUNGROW`, `OTHER` |
| `credentials` | JSONB | ✅ Yes | Vendor-specific authentication credentials (see below) |
| `org_id` | INTEGER | Optional | Organization ID (NULL for global/shared vendors) |
| `is_active` | BOOLEAN | Optional | Active status (default: `true`) |

#### Credentials Structure

Credentials are stored as JSONB and are vendor-specific. Common fields include:

```json
{
  "username": "vendor_username",
  "password": "vendor_password",
  "apiKey": "optional_api_key",
  "clientId": "optional_client_id",
  "clientSecret": "optional_client_secret"
}
```

**Note**: Credentials are stored as-is in the database. Encryption should be handled at the application level if required.

### 2. Environment Variables

API base URLs are stored in environment variables, not in the database:

- `SOLARMAN_API_BASE_URL` - Base URL for Solarman API
- `SOLARMAN_PRO_API_BASE_URL` - (Optional) PRO API base URL for Solarman
- `SUNGROW_API_BASE_URL` - Base URL for Sungrow API
- `{VENDOR}_API_BASE_URL` - Pattern for other vendors

**Example**:
```env
SOLARMAN_API_BASE_URL=https://globalapi.solarmanpv.com
SOLARMAN_PRO_API_BASE_URL=https://globalpro.solarmanpv.com
```

### 3. Token Management

The system automatically handles token storage and refresh:

- **Storage**: Tokens are cached in the `vendors` table (`access_token`, `refresh_token`, `token_expires_at`)
- **Validation**: Tokens are checked before use to avoid expired token errors
- **Refresh**: Adapters should implement token refresh logic when supported by the vendor API

---

## Database Schema

### Plants Table - Required Fields

All plants must map to the following database columns:

#### Core Fields (Required)

| Column | Type | Description | Source |
|--------|------|-------------|--------|
| `id` | SERIAL | Auto-generated primary key | System |
| `org_id` | INTEGER | Organization ID | Vendor config |
| `vendor_id` | INTEGER | Vendor ID | Vendor config |
| `vendor_plant_id` | TEXT | **Vendor's unique plant ID** | Vendor API |
| `name` | TEXT | Plant/station name | Vendor API |
| `capacity_kw` | NUMERIC(10,2) | Installed capacity in kW | Vendor API |

#### Location Fields (Optional but Recommended)

| Column | Type | Description | Source |
|--------|------|-------------|--------|
| `location` | JSONB | Location data | Vendor API |
| | | `{ lat: number, lng: number, address: string }` | |

#### Production Metrics (Required for Dashboard)

| Column | Type | Description | Source | Unit |
|--------|------|-------------|--------|------|
| `current_power_kw` | NUMERIC(10,3) | Current generation power | Vendor API | kW |
| `daily_energy_kwh` | NUMERIC(10,3) | Daily energy generation | Vendor API | **kWh** |
| `monthly_energy_mwh` | NUMERIC(10,3) | Monthly energy generation | Vendor API | MWh |
| `yearly_energy_mwh` | NUMERIC(10,3) | Yearly energy generation | Vendor API | MWh |
| `total_energy_mwh` | NUMERIC(10,3) | Total cumulative energy | Vendor API | MWh |
| `last_update_time` | TIMESTAMPTZ | Last vendor update timestamp | Vendor API | ISO 8601 |

#### Metadata Fields (Optional but Recommended)

| Column | Type | Description | Source |
|--------|------|-------------|--------|
| `network_status` | TEXT | Network status (NORMAL, ALL_OFFLINE, PARTIAL_OFFLINE) | Vendor API |
| `vendor_created_date` | TIMESTAMPTZ | Original creation date from vendor | Vendor API |
| `start_operating_time` | TIMESTAMPTZ | When plant started operating | Vendor API |
| `last_refreshed_at` | TIMESTAMPTZ | Last DB sync timestamp | System (NOW()) |

#### Constraints

- **Unique Constraint**: `(vendor_id, vendor_plant_id)` - Prevents duplicate plants from the same vendor
- **Foreign Keys**: `org_id` → `organizations.id`, `vendor_id` → `vendors.id`

---

## Required API Endpoints

Your vendor adapter must implement the following methods (defined in `BaseVendorAdapter`):

### 1. `authenticate(): Promise<string>`

**Purpose**: Authenticate with vendor API and return access token

**Requirements**:
- Handle token caching (check `token_expires_at` before re-authenticating)
- Store tokens in database using `setTokenStorage(vendorId, supabaseClient)`
- Return access token as string
- Handle authentication errors gracefully

**Example Flow**:
```typescript
async authenticate(): Promise<string> {
  // 1. Check if token exists and is valid
  const cachedToken = await this.getTokenFromDB()
  if (cachedToken && !this.isTokenExpired()) {
    return cachedToken
  }
  
  // 2. Authenticate with vendor API
  const response = await fetch(`${baseUrl}/auth`, {
    method: 'POST',
    body: JSON.stringify({ username, password })
  })
  
  // 3. Extract token and expiration
  const { access_token, expires_in } = await response.json()
  
  // 4. Store token in database
  await this.storeTokenInDB(access_token, expires_in)
  
  return access_token
}
```

### 2. `listPlants(): Promise<Plant[]>`

**Purpose**: Fetch all plants/stations from vendor API

**Requirements**:
- Return array of `Plant` objects
- Each plant must have: `id`, `name`, `capacityKw`
- Include production metrics in `metadata` object
- Handle pagination if vendor API supports it
- Normalize data units (see [Data Mapping Requirements](#data-mapping-requirements))

**Plant Interface**:
```typescript
interface Plant {
  id: string                    // Vendor's plant ID (as string)
  name: string                  // Plant name
  capacityKw: number           // Installed capacity in kW
  location?: {                 // Optional location
    lat?: number
    lng?: number
    address?: string
  }
  metadata?: {                 // Production metrics and vendor-specific data
    currentPowerKw?: number    // Current power in kW
    dailyEnergyKwh?: number    // Daily energy in kWh
    monthlyEnergyMwh?: number   // Monthly energy in MWh
    yearlyEnergyMwh?: number    // Yearly energy in MWh
    totalEnergyMwh?: number     // Total energy in MWh
    lastUpdateTime?: string     // ISO 8601 timestamp
    // ... vendor-specific fields
  }
}
```

### 3. Optional: `getTelemetry(plantId: string, ...): Promise<TelemetryData[]>`

**Purpose**: Fetch historical telemetry data

**Requirements**:
- Return array of telemetry data points
- Support date range queries
- Normalize timestamps to UTC

### 4. Optional: `getAlerts(plantId: string, ...): Promise<Alert[]>`

**Purpose**: Fetch alerts/notifications from vendor

**Requirements**:
- Return array of alert objects
- Map vendor severity levels to: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- Include vendor alert ID for deduplication
- Include alert timestamps (`alert_time`, `end_time`) if available
- Filter by device type if vendor supports it (e.g., only INVERTER alerts)

**Alert Interface**:
```typescript
interface Alert {
  vendorAlertId?: string    // Vendor's unique alert ID (for deduplication)
  title: string             // Alert title/name
  description?: string       // Alert description/message
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  metadata?: Record<string, any>  // Vendor-specific alert data
}
```

**Note**: The `normalizeAlert()` method should transform vendor-specific alert data into this format.

---

## Alert Mapping Requirements

### Alert Database Schema

The `alerts` table stores vendor alerts with the following structure:

| Column | Type | Description | Source |
|--------|------|-------------|--------|
| `id` | SERIAL | Primary key | System |
| `plant_id` | INTEGER | Foreign key to plants | System (from vendor_plant_id lookup) |
| `vendor_id` | INTEGER | Foreign key to vendors | Vendor config |
| `vendor_alert_id` | TEXT | Vendor's unique alert ID | Vendor API |
| `vendor_plant_id` | TEXT | Vendor's plant/station ID | Vendor API |
| `station_id` | BIGINT | Station ID (numeric, if applicable) | Vendor API |
| `device_type` | TEXT | Device type (e.g., "INVERTER") | Vendor API |
| `alert_time` | TIMESTAMPTZ | When alert started | Vendor API |
| `end_time` | TIMESTAMPTZ | When alert ended (nullable) | Vendor API |
| `grid_down_seconds` | INTEGER | Computed downtime in seconds | Calculated: `max(0, end_time - alert_time)` |
| `grid_down_benefit_kwh` | NUMERIC(12,3) | Downtime benefit energy | Calculated: `0.5 × hours(9AM-4PM overlap) × capacity_kw` |
| `title` | TEXT | Alert title | Vendor API |
| `description` | TEXT | Alert description | Vendor API |
| `severity` | ENUM | LOW, MEDIUM, HIGH, CRITICAL | Mapped from vendor |
| `status` | ENUM | ACTIVE, RESOLVED, ACKNOWLEDGED | Mapped from vendor |
| `metadata` | JSONB | Additional vendor data | Vendor API |
| `created_at` | TIMESTAMPTZ | Creation timestamp | System |
| `updated_at` | TIMESTAMPTZ | Last update timestamp | System |
| `resolved_at` | TIMESTAMPTZ | Resolution timestamp (nullable) | System |

### Alert Sync Implementation

Alerts are synced via a dedicated service (`alertSyncService.ts`) that:

1. **Fetches alerts from vendor API** using the adapter's `getAlerts()` method
2. **Maps vendor data** to database format
3. **Calculates derived fields**:
   - `grid_down_seconds`: Duration between `alert_time` and `end_time`
   - `grid_down_benefit_kwh`: Energy benefit during grid downtime (9 AM - 4 PM local time)
4. **Upserts alerts** (insert new, update existing based on `vendor_alert_id`)

### Alert Data Mapping

#### Required Fields

| Database Column | Vendor Field | Conversion Notes |
|----------------|--------------|------------------|
| `vendor_alert_id` | `id` or `alertId` | Convert to string, use for deduplication |
| `vendor_plant_id` | `stationId` or `plantId` | Vendor's plant identifier (as string) |
| `station_id` | `stationId` | Numeric station ID (if available) |
| `device_type` | `deviceType` | Filter for specific types (e.g., "INVERTER") |
| `title` | `alertName` or `alertType` | Alert title/name |
| `description` | `message` or `description` | Alert description (optional) |
| `alert_time` | `alertTime` or `timestamp` | Convert to ISO 8601 (Unix seconds → ISO) |
| `end_time` | `endTime` or `resolvedAt` | Convert to ISO 8601 (nullable) |

#### Severity Mapping

Map vendor severity levels to standardized enum:

```typescript
// Example: Solarman severity mapping
const severityMap: Record<number, Alert["severity"]> = {
  0: "LOW",      // Info
  1: "MEDIUM",   // Warning
  2: "HIGH",     // Error
}

// Upgrade to CRITICAL if safety impact
if (rawData.influence === 2 || rawData.influence === 3) {
  severity = "CRITICAL" // Safety impact is critical
}
```

**Standard Severity Levels**:
- `LOW`: Informational alerts, minor issues
- `MEDIUM`: Warnings, production impact
- `HIGH`: Errors, significant issues
- `CRITICAL`: Safety issues, critical failures

#### Status Mapping

Map vendor alert status to standardized enum:

```typescript
// Example: Map based on end_time presence
function mapAlertStatus(endTime: number | null | undefined): AlertStatus {
  if (endTime && endTime > 0) {
    return "RESOLVED" // Alert has ended
  }
  return "ACTIVE" // Alert is still active
}
```

**Standard Status Levels**:
- `ACTIVE`: Alert is currently active
- `RESOLVED`: Alert has been resolved/ended
- `ACKNOWLEDGED`: Alert has been acknowledged by user

#### Timestamp Conversion

Convert vendor timestamps to ISO 8601 format:

```typescript
// Unix timestamp (seconds) → ISO string
const alertTimeDate = raw.alertTime 
  ? new Date(raw.alertTime * 1000).toISOString() 
  : null

// Unix timestamp (milliseconds) → ISO string
const alertTimeDate = raw.alertTime 
  ? new Date(raw.alertTime).toISOString() 
  : null
```

#### Grid Downtime Calculation

The system automatically calculates:
- **`grid_down_seconds`**: `max(0, end_time - alert_time)` in seconds
- **`grid_down_benefit_kwh`**: `0.5 × hours(overlap between 9AM-4PM local time) × installed_capacity_kw`

**Example Calculation**:
```typescript
// Alert from 8 AM to 6 PM (10 hours total)
// Overlap with 9 AM - 4 PM window: 7 hours
// Plant capacity: 5 kW
// Benefit: 0.5 × 7 hours × 5 kW = 17.5 kWh
```

### Alert Sync Configuration

Vendors can configure alert sync behavior:

1. **Lookback Period**: Set `alertsStartDate` in vendor credentials (ISO date string)
   - Default: 1 year lookback
   - Example: `"2024-01-01"` in credentials JSON

2. **Device Type Filtering**: Filter alerts by device type (e.g., only INVERTER alerts)

3. **Pagination**: Handle paginated alert responses (if vendor supports it)

### Alert Sync Endpoints

Alerts are synced via:
- **Manual Sync**: `/api/vendors/[id]/sync-alerts` (POST)
- **Cron Job**: Automatic sync every 15 minutes (configurable)

### Solarman Alert Example

**Endpoint**: `POST /maintain-s/operating/station/alert/v2/list`

**Request**:
```json
{
  "alertQueryName": "No Mains Voltage",
  "language": "en",
  "status": "-1",
  "timeZone": "Asia/Calcutta",
  "page": 1,
  "size": 100
}
```

**Response Structure**:
```json
{
  "total": 10,
  "data": [
    {
      "id": "12345",
      "stationId": 693934,
      "deviceType": "INVERTER",
      "alertName": "No Mains Voltage",
      "alertTime": 1763279487,
      "endTime": 1763283087,
      "level": 2,
      "influence": 2,
      "timezone": "Asia/Calcutta"
    }
  ]
}
```

**Mapping**:
- `id` → `vendor_alert_id`
- `stationId` → `vendor_plant_id` (as string) and `station_id` (as number)
- `deviceType` → `device_type` (filter for "INVERTER" only)
- `alertName` → `title`
- `alertTime` → `alert_time` (Unix seconds → ISO)
- `endTime` → `end_time` (Unix seconds → ISO)
- `level` + `influence` → `severity` (mapped via `mapSolarmanSeverity()`)

---

## Data Mapping Requirements

### Unit Conversions

The system expects data in specific units. Your adapter must convert vendor data to these units:

| Metric | Required Unit | Conversion Notes |
|--------|---------------|------------------|
| **Capacity** | kW | If vendor provides in W, divide by 1000 |
| **Current Power** | kW | If vendor provides in W, divide by 1000 |
| **Daily Energy** | **kWh** | Store in kWh (not MWh) to avoid rounding errors |
| **Monthly Energy** | MWh | If vendor provides in kWh, divide by 1000 |
| **Yearly Energy** | MWh | If vendor provides in kWh, divide by 1000 |
| **Total Energy** | MWh | If vendor provides in kWh, divide by 1000 |

### Timestamp Handling

- **Vendor Timestamps**: May be Unix timestamps (seconds or milliseconds) or ISO strings
- **Database Storage**: Always convert to ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`)
- **Timezone**: Store in UTC, convert from vendor timezone if needed

**Example**:
```typescript
// Unix timestamp (seconds) → ISO string
const lastUpdateTime = station.lastUpdateTime 
  ? new Date(Math.floor(station.lastUpdateTime) * 1000).toISOString() 
  : null

// Unix timestamp (milliseconds) → ISO string
const lastUpdateTime = station.lastUpdateTime 
  ? new Date(station.lastUpdateTime).toISOString() 
  : null
```

### Location Data

Location should be structured as:
```typescript
location: {
  lat: number,      // Latitude (decimal degrees)
  lng: number,      // Longitude (decimal degrees)
  address: string   // Full address string
}
```

If vendor provides separate fields, combine them:
```typescript
const location = {
  lat: station.locationLat,
  lng: station.locationLng,
  address: station.locationAddress
}
```

### Network Status Normalization

Network status values should be normalized to:
- `NORMAL` - All systems operational
- `ALL_OFFLINE` - All devices offline
- `PARTIAL_OFFLINE` - Some devices offline

**Important**: Trim whitespace from vendor responses (e.g., `' ALL_OFFLINE'` → `'ALL_OFFLINE'`)

```typescript
networkStatus: station.networkStatus ? String(station.networkStatus).trim() : null
```

---

## Solarman Example

This section provides a complete example using Solarman as a reference implementation.

### 1. Vendor Configuration

**Database Entry**:
```sql
INSERT INTO vendors (name, vendor_type, credentials, org_id, is_active)
VALUES (
  'Solarman Production',
  'SOLARMAN',
  '{"username": "vendor_username", "password": "vendor_password"}'::jsonb,
  1,
  true
);
```

**Environment Variables**:
```env
SOLARMAN_API_BASE_URL=https://globalapi.solarmanpv.com
SOLARMAN_PRO_API_BASE_URL=https://globalpro.solarmanpv.com
```

### 2. Authentication

**Endpoint**: `POST /oauth/token`

**Request**:
```json
{
  "username": "vendor_username",
  "password": "vendor_password",
  "grant_type": "password"
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Implementation**:
- Token is cached in `vendors.access_token`
- Expiration stored in `vendors.token_expires_at`
- Token is validated before each API call

### 3. Plant Listing

**Endpoint**: `POST /maintain-s/operating/station/v2/search` (PRO API)

**Request**:
```json
{
  "station": {
    "powerTypeList": ["PV"]
  }
}
```

**Response Structure**:
```json
{
  "total": 3,
  "data": [
    {
      "station": {
        "id": 693934,
        "name": "Bindu singla",
        "installedCapacity": 5.0,
        "generationPower": 2196.0,
        "generationValue": 12.5,
        "generationMonth": 350.0,
        "generationYear": 4200.0,
        "generationUploadTotalOffset": 50000.0,
        "locationLat": 30.740103,
        "locationLng": 76.744538,
        "locationAddress": "Chandigarh",
        "networkStatus": "NORMAL",
        "lastUpdateTime": 1763279487,
        "createdDate": 1580112893,
        "startOperatingTime": 1580112893
      }
    }
  ]
}
```

### 4. Data Mapping

| Solarman Field | Type | Conversion | Database Column |
|----------------|------|------------|-----------------|
| `station.id` | number | `toString()` | `vendor_plant_id` |
| `station.name` | string | Direct | `name` |
| `station.installedCapacity` | number (kW) | Direct | `capacity_kw` |
| `station.generationPower` | number (W) | `/ 1000` | `current_power_kw` |
| `station.generationValue` | number (kWh) | Direct | `daily_energy_kwh` |
| `station.generationMonth` | number (kWh) | `/ 1000` | `monthly_energy_mwh` |
| `station.generationYear` | number (kWh) | `/ 1000` | `yearly_energy_mwh` |
| `station.generationUploadTotalOffset` | number (kWh) | `/ 1000` | `total_energy_mwh` |
| `station.lastUpdateTime` | number (Unix seconds) | `new Date(ts * 1000).toISOString()` | `last_update_time` |
| `station.locationLat` | number | Combined | `location.lat` |
| `station.locationLng` | number | Combined | `location.lng` |
| `station.locationAddress` | string | Combined | `location.address` |
| `station.networkStatus` | string | `.trim()` | `network_status` |
| `station.createdDate` | number (Unix seconds) | `new Date(ts * 1000).toISOString()` | `vendor_created_date` |
| `station.startOperatingTime` | number (Unix seconds) | `new Date(ts * 1000).toISOString()` | `start_operating_time` |

### 5. Alert Synchronization

**Endpoint**: `POST /maintain-s/operating/station/alert/v2/list`

**Request**:
```json
{
  "alertQueryName": "No Mains Voltage",
  "language": "en",
  "status": "-1",
  "timeZone": "Asia/Calcutta",
  "page": 1,
  "size": 100
}
```

**Response**:
```json
{
  "total": 10,
  "data": [
    {
      "id": "12345",
      "stationId": 693934,
      "deviceType": "INVERTER",
      "alertName": "No Mains Voltage",
      "alertTime": 1763279487,
      "endTime": 1763283087,
      "level": 2,
      "influence": 2,
      "timezone": "Asia/Calcutta"
    }
  ]
}
```

**Alert Mapping**:
- `id` → `vendor_alert_id` (as string)
- `stationId` → `vendor_plant_id` (as string) and `station_id` (as number)
- `deviceType` → `device_type` (filter for "INVERTER" only)
- `alertName` → `title`
- `alertTime` → `alert_time` (Unix seconds → ISO 8601)
- `endTime` → `end_time` (Unix seconds → ISO 8601)
- `level` + `influence` → `severity` (mapped via `mapSolarmanSeverity()`)

**Severity Mapping**:
```typescript
// level: 0=Info, 1=Warning, 2=Error
const severityMap = {
  0: "LOW",
  1: "MEDIUM",
  2: "HIGH",
}

// influence: 0=No impact, 1=Production, 2=Safety, 3=Production+Safety
// Safety influence (2 or 3) upgrades to CRITICAL
if (influence === 2 || influence === 3) {
  severity = "CRITICAL"
}
```

### 6. Adapter Implementation

**File**: `lib/vendors/solarmanAdapter.ts`

**Key Methods**:
- `authenticate()` - Handles OAuth token flow
- `listPlants()` - Fetches plants from PRO API
- `getTokenFromDB()` - Retrieves cached token
- `storeTokenInDB()` - Stores token with expiration
- `getProApiBaseUrl()` - Gets API base URL from env vars
- `normalizeAlert()` - Maps Solarman alert format to standard Alert interface

**Registration**: Adapter is registered in `lib/vendors/vendorManager.ts`:
```typescript
case 'SOLARMAN':
  return new SolarmanAdapter(config)
```

---

## Implementation Checklist

Use this checklist when implementing a new vendor adapter:

### Phase 1: Setup

- [ ] Create vendor adapter class extending `BaseVendorAdapter`
- [ ] Register adapter in `vendorManager.ts`
- [ ] Add vendor type to `vendor_type` ENUM in database
- [ ] Set up environment variables for API base URL
- [ ] Document vendor-specific credentials structure

### Phase 2: Authentication

- [ ] Implement `authenticate()` method
- [ ] Handle token caching (check expiration before re-auth)
- [ ] Implement `setTokenStorage()` for token persistence
- [ ] Implement `getTokenFromDB()` and `storeTokenInDB()`
- [ ] Handle authentication errors (401, 403, etc.)
- [ ] Test token refresh flow (if supported)

### Phase 3: Plant Listing

- [ ] Implement `listPlants()` method
- [ ] Map vendor plant ID to `vendor_plant_id` (as string)
- [ ] Extract and normalize plant name
- [ ] Extract and convert capacity to kW
- [ ] Extract location data (lat, lng, address)
- [ ] Handle pagination (if vendor API supports it)
- [ ] Test with multiple plants

### Phase 4: Production Metrics

- [ ] Extract `current_power_kw` (convert from W to kW if needed)
- [ ] Extract `daily_energy_kwh` (store in kWh, not MWh)
- [ ] Extract `monthly_energy_mwh` (convert from kWh to MWh)
- [ ] Extract `yearly_energy_mwh` (convert from kWh to MWh)
- [ ] Extract `total_energy_mwh` (convert from kWh to MWh)
- [ ] Extract `last_update_time` (convert to ISO 8601)
- [ ] Handle null/missing values gracefully

### Phase 5: Metadata Fields

- [ ] Extract `network_status` (normalize and trim)
- [ ] Extract `vendor_created_date` (convert to ISO 8601)
- [ ] Extract `start_operating_time` (convert to ISO 8601)
- [ ] Store additional vendor-specific fields in metadata

### Phase 6: Data Persistence

- [ ] Test plant sync via `/api/vendors/[id]/sync-plants`
- [ ] Verify data is stored correctly in `plants` table
- [ ] Verify `vendor_plant_id` uniqueness constraint
- [ ] Test upsert behavior (updating existing plants)
- [ ] Verify `last_refreshed_at` is set to current timestamp

### Phase 7: Alert Synchronization (Optional)

- [ ] Implement `getAlerts()` method in adapter
- [ ] Implement `normalizeAlert()` method
- [ ] Map vendor severity levels to standard enum (LOW, MEDIUM, HIGH, CRITICAL)
- [ ] Map vendor status to standard enum (ACTIVE, RESOLVED, ACKNOWLEDGED)
- [ ] Extract and convert alert timestamps (alert_time, end_time)
- [ ] Extract vendor_alert_id for deduplication
- [ ] Extract vendor_plant_id and station_id
- [ ] Extract device_type (if applicable)
- [ ] Filter alerts by device type (e.g., only INVERTER alerts)
- [ ] Handle pagination (if vendor API supports it)
- [ ] Test alert sync via `/api/vendors/[id]/sync-alerts`
- [ ] Verify alerts are stored correctly in database
- [ ] Verify grid_down_seconds and grid_down_benefit_kwh are calculated
- [ ] Test alert deduplication (same vendor_alert_id)

### Phase 8: Optional Features

- [ ] Implement `getTelemetry()` (if vendor supports it)
- [ ] Implement `getRealtime()` (if vendor supports it)

### Phase 9: Testing

- [ ] Test authentication with valid credentials
- [ ] Test authentication with invalid credentials
- [ ] Test plant listing with empty result
- [ ] Test plant listing with multiple plants
- [ ] Test data normalization (units, timestamps)
- [ ] Test error handling (network errors, API errors)
- [ ] Test token expiration and refresh
- [ ] Test sync via UI (vendor sync page)

### Phase 10: Documentation

- [ ] Document vendor API endpoints
- [ ] Document request/response formats
- [ ] Document data mapping (create data mapping doc)
- [ ] Document any vendor-specific quirks or limitations
- [ ] Update this onboarding guide with vendor-specific notes

---

## Testing Requirements

### 1. Unit Tests

Test adapter methods in isolation:
- Authentication flow
- Token caching logic
- Data normalization functions
- Unit conversions

### 2. Integration Tests

Test adapter with real vendor API (use test credentials):
- Full authentication flow
- Plant listing with real data
- Data persistence to database
- Error scenarios

### 3. Manual Testing

Test via UI:
1. Create vendor in database
2. Configure credentials
3. Trigger sync via `/superadmin/vendor-sync`
4. Verify plants appear in plant listing
5. Verify production metrics display correctly
6. Verify location data (if available)
7. Test error scenarios (invalid credentials, API down)

### 4. Data Validation

Verify data quality:
- All required fields are populated
- Units are correct (kW, kWh, MWh)
- Timestamps are valid ISO 8601 format
- Location coordinates are valid (lat: -90 to 90, lng: -180 to 180)
- Network status values are normalized
- No duplicate plants (same `vendor_id` + `vendor_plant_id`)
- Alert severity values are valid (LOW, MEDIUM, HIGH, CRITICAL)
- Alert status values are valid (ACTIVE, RESOLVED, ACKNOWLEDGED)
- Alert timestamps are valid ISO 8601 format
- No duplicate alerts (same `vendor_id` + `vendor_alert_id` + `plant_id`)
- Grid downtime calculations are correct

---

## Common Pitfalls

### 1. Unit Conversion Errors

**Problem**: Storing daily energy in MWh instead of kWh
**Solution**: Always store `daily_energy_kwh` in kWh (not MWh)

**Problem**: Forgetting to convert W to kW
**Solution**: Divide by 1000 when vendor provides power in watts

### 2. Timestamp Handling

**Problem**: Storing Unix timestamps as-is
**Solution**: Always convert to ISO 8601 format

**Problem**: Timezone confusion
**Solution**: Store all timestamps in UTC

### 3. Token Management

**Problem**: Not checking token expiration
**Solution**: Always validate `token_expires_at` before using cached token

**Problem**: Not handling token refresh
**Solution**: Implement refresh logic if vendor supports it

### 4. Data Normalization

**Problem**: Not trimming whitespace from status fields
**Solution**: Always `.trim()` string values from vendor API

**Problem**: Case sensitivity in status values
**Solution**: Normalize to uppercase (e.g., `'normal'` → `'NORMAL'`)

### 5. Error Handling

**Problem**: Not handling API errors gracefully
**Solution**: Catch and log errors, return meaningful error messages

**Problem**: Not handling missing/null values
**Solution**: Use nullish coalescing (`??`) and optional chaining (`?.`)

### 6. Alert Mapping

**Problem**: Not mapping vendor severity levels correctly
**Solution**: Create explicit mapping function (e.g., `mapSolarmanSeverity()`)

**Problem**: Not handling alert deduplication
**Solution**: Use `vendor_alert_id` + `vendor_id` + `plant_id` as unique key

**Problem**: Not converting alert timestamps correctly
**Solution**: Always convert vendor timestamps to ISO 8601 format

**Problem**: Not calculating grid downtime benefit
**Solution**: Implement `calculateGridDownBenefitKwh()` using 9 AM - 4 PM window

---

## Support

For questions or issues during vendor onboarding:

1. Review existing vendor adapters (e.g., `solarmanAdapter.ts`)
2. Check data mapping documentation (e.g., `docs/SOLARMAN_DATA_MAPPING.md`)
3. Review database schema (`supabase/migrations/001_initial_schema.sql`)
4. Contact the development team

---

## Appendix: Vendor Adapter Interface

```typescript
abstract class BaseVendorAdapter {
  abstract authenticate(): Promise<string>
  abstract listPlants(): Promise<Plant[]>
  
  // Optional methods
  getTelemetry?(plantId: string, ...args: any[]): Promise<TelemetryData[]>
  getAlerts?(plantId: string, ...args: any[]): Promise<Alert[]>
  getRealtime?(plantId: string): Promise<RealtimeData>
  
  // Token management
  setTokenStorage?(vendorId: number, supabaseClient: any): void
}
```

---

**Last Updated**: 2025-01-XX
**Version**: 1.0

