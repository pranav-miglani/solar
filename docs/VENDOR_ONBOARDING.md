# Vendor Onboarding Guide

This document outlines the requirements and process for onboarding a new vendor integration into Solar Information System (SIS). Use this guide to understand what data is required, how it's stored, and what needs to be implemented.

## Table of Contents

1. [Overview](#overview)
2. [Vendor Configuration Requirements](#vendor-configuration-requirements)
3. [Database Schema](#database-schema)
4. [Required API Endpoints](#required-api-endpoints)
5. [Alert Mapping Requirements](#alert-mapping-requirements)
6. [Data Mapping Requirements](#data-mapping-requirements)
7. [Vendor Comparison: Solarman vs SolarDM](#vendor-comparison-solarman-vs-solardm)
8. [Solarman Example](#solarman-example)
9. [SolarDM Example](#solardm-example)
10. [PVBlink Example](#pvblink-example)
11. [Foxesscloud Example](#foxesscloud-example)
12. [ShineMonitor Example](#shinemonitor-example)
13. [Implementation Checklist](#implementation-checklist)
14. [Testing Requirements](#testing-requirements)
15. [Common Pitfalls](#common-pitfalls)

---

## Overview

Solar Information System uses a vendor adapter pattern to integrate with different solar inverter vendors. Each vendor must implement a standardized interface that provides:

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
| `vendor_type` | ENUM | ✅ Yes | One of: `SOLARMAN`, `SOLARDM`, `SHINEMONITOR`, `PVBLINK`, `FOXESSCLOUD`, `OTHER` |
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
- `SOLARDM_API_BASE_URL` - Base URL for SolarDM API
- `SHINEMONITOR_API_BASE_URL` - Base URL for ShineMonitor API
- `PVBLINK_API_BASE_URL` - Base URL for PVBlink API
- `FOXESSCLOUD_API_BASE_URL` - Base URL for Foxesscloud API
- `{VENDOR}_API_BASE_URL` - Pattern for other vendors

**Example**:
```env
SOLARMAN_API_BASE_URL=https://globalapi.solarmanpv.com
SOLARMAN_PRO_API_BASE_URL=https://globalpro.solarmanpv.com
SOLARDM_API_BASE_URL=http://global.solar-dm.com:8010
SHINEMONITOR_API_BASE_URL=https://web.shinemonitor.com/public
PVBLINK_API_BASE_URL=https://cloud.pvblink.com
FOXESSCLOUD_API_BASE_URL=https://www.foxesscloud.com
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
- Include production metrics in `metadata` object (live telemetry fields: currentPowerKw, dailyEnergyKwh, monthlyEnergyMwh, yearlyEnergyMwh, totalEnergyMwh, networkStatus)
- Handle pagination if vendor API supports it
- Normalize data units (see [Data Mapping Requirements](#data-mapping-requirements))

### 3. Optional: `listPlant(vendorPlantId: string): Promise<Plant | null>`

**Purpose**: Fetch a single plant by vendor plant ID

**Requirements**:
- Return a single `Plant` object or `null` if not found
- Used for live telemetry sync in PER_PLANT mode (when `telemetry_sync_mode = PER_PLANT`)
- Used for enriching plants during plant sync if live telemetry is missing from `listPlants()` response (configurable via `ENABLE_PER_PLANT_LIVE_TELEMETRY` env var)
- Default implementation throws an error - vendors should override if they support per-plant fetching
- Should include the same live telemetry fields as `listPlants()` (currentPowerKw, dailyEnergyKwh, etc.)

**Note**: This method is optional but recommended for vendors that support per-plant API endpoints, as it enables more efficient live telemetry sync in PER_PLANT mode.

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

### 4. Optional: `getTelemetry(plantId: string, ...): Promise<TelemetryData[]>`

**Purpose**: Fetch historical telemetry data

**Requirements**:
- Return array of telemetry data points
- Support date range queries
- Normalize timestamps to UTC

### 5. Optional: `getAlerts(plantId: string, ...): Promise<Alert[]>`

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
- `stationId` → `vendor_plant_id` (as string)
- `deviceType` → Filtered (only "INVERTER" alerts are processed, but not stored)
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

## Vendor Comparison: Solarman vs SolarDM

This section compares the two currently supported vendors to help understand implementation differences and similarities.

### Authentication Comparison

| Aspect | Solarman | SolarDM |
|--------|----------|---------|
| **Endpoint** | `POST /account/v1.0/token` | `POST /ums/business/email_login` |
| **Method** | Query parameter (`?appId=...`) + JSON body | JSON body only |
| **Required Credentials** | `appId`, `appSecret`, `username`, `passwordSha256`, `solarmanOrgId` (optional) | `email`, `passwordRSA` |
| **Token Response** | `access_token`, `expires_in`, `refresh_token` | `token`, `refreshToken`, `expiresIn` |
| **Token Storage** | `access_token`, `token_expires_at` | `access_token`, `token_expires_at` |
| **Token Type** | Bearer token | Bearer token |
| **Base URL** | `https://globalapi.solarmanpv.com` or `https://globalpro.solarmanpv.com` | `http://global.solar-dm.com:8010` |

**Key Differences**:
- Solarman requires SHA-256 hashed password, SolarDM requires RSA-encrypted password
- Solarman supports org-level authentication (optional `orgId`), SolarDM does not
- Solarman uses query parameters for appId, SolarDM uses only JSON body

### Plant Listing Comparison

| Aspect | Solarman | SolarDM |
|--------|----------|---------|
| **Endpoint** | `POST /maintain-s/operating/station/v2/search` (PRO API) | `GET /dms/plant/list_all` |
| **Method** | POST with JSON body | GET (no body) |
| **Pagination** | Built into response (`total`, `data[]`) | Returns all plants in single response |
| **Plant ID Type** | Number (converted to string) | String |
| **Response Structure** | Nested `station` object | Flat `data[]` array |

**Data Mapping Differences**:

| Field | Solarman Source | SolarDM Source |
|-------|----------------|----------------|
| `vendor_plant_id` | `station.id` (number → string) | `id` (string) |
| `name` | `station.name` | `plantName` |
| `capacity_kw` | `station.installedCapacity` | `capacity` |
| `current_power_kw` | `station.generationPower` (W → kW) | `currentPower` (W → kW) |
| `daily_energy_kwh` | `station.generationValue` (kWh) | `dailyEnergy` (kWh) |
| `monthly_energy_mwh` | `station.generationMonth` (kWh → MWh) | `monthlyEnergy` (kWh → MWh) |
| `yearly_energy_mwh` | `station.generationYear` (kWh → MWh) | `yearlyEnergy` (kWh → MWh) |
| `total_energy_mwh` | `station.generationUploadTotalOffset` (kWh → MWh) | `totalEnergy` (kWh → MWh) |
| `location.lat` | `station.locationLat` | `latitude` |
| `location.lng` | `station.locationLng` | `longitude` |
| `location.address` | `station.locationAddress` | `address` |
| `network_status` | `station.networkStatus` (trimmed) | `communicateStatus` (1=online, 2=offline, 3=PARTIAL_OFFLINE) |
| `vendor_created_date` | `station.createdDate` (Unix seconds) | `createTime` (Unix timestamp) |
| `start_operating_time` | `station.startOperatingTime` (Unix seconds) | `createTime` (Unix timestamp) |

**Key Differences**:
- Solarman uses PRO API for richer data, SolarDM uses standard API
- Solarman plant IDs are numbers, SolarDM uses strings
- Solarman network status is string-based, SolarDM uses numeric codes
- Solarman has separate `createdDate` and `startOperatingTime`, SolarDM uses same `createTime` for both

### Alert Synchronization Comparison

| Aspect | Solarman | SolarDM |
|--------|----------|---------|
| **Endpoint** | `POST /maintain-s/operating/station/alert/v2/list` | `GET /dms/inverter_fault/page_list/all` |
| **Method** | POST with JSON body | GET with query parameters |
| **Pagination** | `page`, `size` in request body | `current`, `size` in query params |
| **Filtering** | `alertQueryName: "No Mains Voltage"` in body | `faultInfo: "There is no mains voltage"` in query |
| **Device Filter** | `deviceType: "INVERTER"` (filtered but not stored) | No device type filter (all alerts) |
| **Response Structure** | `{ total, data[] }` | `{ code, message, data: { records[], total, pages } }` |

**Alert Data Mapping**:

| Database Field | Solarman Source | SolarDM Source |
|----------------|-----------------|----------------|
| `vendor_alert_id` | `id` (string) | `id` (string) |
| `vendor_plant_id` | `stationId` (number → string) | `plantId` (string) |
| `title` | `alertName` | `faultInfo` |
| `description` | `alertName` (same as title) | `faultInfo` (same as title) |
| `alert_time` | `alertTime` (Unix seconds → ISO) | `happenTime` ("YYYY-MM-DD HH:mm:ss" → ISO) |
| `end_time` | `endTime` (Unix seconds → ISO) | `recoverTime` ("YYYY-MM-DD HH:mm:ss" → ISO) |
| `severity` | `level` + `influence` (mapped) | `faultLevel` (1=LOW, 2=MEDIUM, 3=HIGH, 4=CRITICAL) |
| `status` | Based on `endTime` presence | Based on `recoverTime` presence |

**Severity Mapping**:

**Solarman**:
```typescript
// level: 0=Info, 1=Warning, 2=Error
const severityMap = { 0: "LOW", 1: "MEDIUM", 2: "HIGH" }
// influence: 2=Safety, 3=Production+Safety → CRITICAL
if (influence === 2 || influence === 3) severity = "CRITICAL"
```

**SolarDM**:
```typescript
// faultLevel: 1=LOW, 2=MEDIUM, 3=HIGH, 4=CRITICAL
const severityMap = { 1: "LOW", 2: "MEDIUM", 3: "HIGH", 4: "CRITICAL" }
```

**Key Differences**:
- Solarman uses POST with body, SolarDM uses GET with query params
- Solarman timestamps are Unix seconds, SolarDM uses "YYYY-MM-DD HH:mm:ss" format
- Solarman severity combines `level` + `influence`, SolarDM uses single `faultLevel`
- Solarman filters by device type, SolarDM does not
- Both use same alert title for both `title` and `description` fields

### Telemetry Comparison

| Aspect | Solarman | SolarDM |
|--------|----------|---------|
| **Daily Endpoint** | `GET /maintain-s/history/power/{systemId}/record?year={year}&month={month}&day={day}` | `GET /dms/data_panel/history/stats/daily/{plantId}?type=date&time=YYYY-MM-DD` |
| **Monthly Endpoint** | `GET /maintain-s/history/power/{systemId}/stats/month?year={year}&month={month}` | `GET /dms/data_panel/history/stats/month/{plantId}?type=month&time=YYYY-MM` |
| **Yearly Endpoint** | `GET /maintain-s/history/power/{systemId}/stats/year?year={year}` | `GET /dms/data_panel/history/stats/year/{plantId}?type=year&time=YYYY` |
| **Total Endpoint** | `GET /maintain-s/history/power/{systemId}/stats/total?startYear={start}&endYear={end}` | `GET /dms/data_panel/history/stats/total/{plantId}?type=all&time=YYYY+~+YYYY` |
| **Data Format** | 5-minute intervals with power (W) | 20-minute intervals with power (W) |
| **Energy Calculation** | Sum of power over intervals | Sum of `generationEnergy` (kWh) from `dataList` |
| **Statistics** | Includes `fullPowerHours` | Does not include `fullPowerHours` |

**Key Differences**:
- Solarman uses numeric `systemId` in path, SolarDM uses string `plantId`
- Solarman provides `fullPowerHours` statistics, SolarDM does not
- Solarman uses 5-minute intervals, SolarDM uses 20-minute intervals
- Solarman calculates energy from power, SolarDM provides pre-calculated energy values

### API Request Headers Comparison

| Header | Solarman | SolarDM |
|--------|----------|---------|
| **Authorization** | `Bearer {token}` | `Bearer {token}` |
| **Accept** | `application/json, text/plain, */*` | `application/json, text/plain, */*` |
| **Content-Type** | `application/json` (POST only) | `application/json` (POST only) |
| **Additional Headers** | None required | `Accept-Language: en-US`, `Connection: keep-alive`, `Origin`, `Referer`, `User-Agent` |

**Key Differences**:
- SolarDM requires browser-like headers (Origin, Referer, User-Agent) for some endpoints
- Solarman works with minimal headers
- Both use Bearer token authentication

### Error Handling Comparison

| Aspect | Solarman | SolarDM |
|--------|----------|---------|
| **Success Code** | HTTP 200 with `success: true` | HTTP 200 with `code: 0` |
| **Error Response** | `{ success: false, msg: "error message" }` | `{ code: non-zero, message: "error message" }` |
| **Token Expiration** | Returns 401 Unauthorized | Returns 401 Unauthorized |
| **Pagination Errors** | Returns empty `data[]` array | Returns `code: 0` with empty `records[]` |

### Implementation Notes

**Common Patterns**:
- Both vendors use Bearer token authentication
- Both store tokens in database with expiration
- Both support pagination for alerts
- Both filter alerts to "No Mains Voltage" / "There is no mains voltage"
- Both calculate grid downtime benefit using 9 AM - 4 PM window

**Vendor-Specific Considerations**:
- **Solarman**: Prefer PRO API for richer plant data
- **Solarman**: Handle both user-level and org-level authentication
- **SolarDM**: Always include browser-like headers for API calls
- **SolarDM**: Handle `pages: 0` in pagination responses (calculate from `total`)
- **SolarDM**: Parse date strings in "YYYY-MM-DD HH:mm:ss" format
- **SolarDM**: Map numeric network status codes to string values

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
- `stationId` → `vendor_plant_id` (as string)
- `deviceType` → Filtered (only "INVERTER" alerts are processed, but not stored)
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

## SolarDM Example

This section provides a complete example using SolarDM as a reference implementation.

### 1. Vendor Configuration

**Database Entry**:
```sql
INSERT INTO vendors (name, vendor_type, credentials, org_id, is_active)
VALUES (
  'SolarDM Production',
  'SOLARDM',
  '{"email": "vendor@example.com", "passwordRSA": "encrypted_password"}'::jsonb,
  1,
  true
);
```

**Environment Variables**:
```env
SOLARDM_API_BASE_URL=http://global.solar-dm.com:8010
```

### 2. Authentication

**Endpoint**: `POST /ums/business/email_login`

**Request**:
```json
{
  "email": "vendor@example.com",
  "password": "encrypted_password"
}
```

**Response**:
```json
{
  "code": 0,
  "message": "Success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_string",
    "expiresIn": 3600
  }
}
```

**Implementation**:
- Token is cached in `vendors.access_token`
- Expiration stored in `vendors.token_expires_at`
- Token is validated before each API call

### 3. Plant Listing

**Endpoint**: `GET /dms/plant/list_all`

**Request**: No body, authenticated GET request

**Response Structure**:
```json
{
  "code": 0,
  "message": "Success",
  "data": [
    {
      "id": "1931246821487521793",
      "plantName": "34963900110105",
      "capacity": 5.0,
      "latitude": 30.740103,
      "longitude": 76.744538,
      "address": "Chandigarh",
      "communicateStatus": 1,
      "createTime": 1580112893000,
      "currentPower": 2196.0,
      "dailyEnergy": 12.5,
      "monthlyEnergy": 350.0,
      "yearlyEnergy": 4200.0,
      "totalEnergy": 50000.0
    }
  ]
}
```

### 4. Data Mapping

| SolarDM Field | Type | Conversion | Database Column |
|---------------|------|------------|-----------------|
| `id` | string | Direct | `vendor_plant_id` |
| `plantName` | string | Direct | `name` |
| `capacity` | number (kW) | Direct | `capacity_kw` |
| `currentPower` | number (W) | `/ 1000` | `current_power_kw` |
| `dailyEnergy` | number (kWh) | Direct | `daily_energy_kwh` |
| `monthlyEnergy` | number (kWh) | `/ 1000` | `monthly_energy_mwh` |
| `yearlyEnergy` | number (kWh) | `/ 1000` | `yearly_energy_mwh` |
| `totalEnergy` | number (kWh) | `/ 1000` | `total_energy_mwh` |
| `latitude` | number | Combined | `location.lat` |
| `longitude` | number | Combined | `location.lng` |
| `address` | string | Combined | `location.address` |
| `communicateStatus` | number | `1=online, 2=offline, 3=PARTIAL_OFFLINE` | `network_status` |
| `createTime` | number (Unix ms) | `new Date(ts).toISOString()` | `vendor_created_date` |
| `createTime` | number (Unix ms) | `new Date(ts).toISOString()` | `start_operating_time` |

### 5. Alert Synchronization

**Endpoint**: `GET /dms/inverter_fault/page_list/all?current=1&size=100&faultInfo=There%20is%20no%20mains%20voltage`

**Request**: Query parameters only (no body)

**Response**:
```json
{
  "code": 0,
  "message": "Success",
  "data": {
    "records": [
      {
        "id": "1994579265913106434",
        "faultInfo": "There is no mains voltage",
        "faultInfoEN": "There is no mains voltage",
        "faultLevel": 1,
        "plantId": "1931246821487521793",
        "happenTime": "2025-11-29 06:58:21",
        "recoverTime": null
      }
    ],
    "total": 1,
    "pages": 0
  }
}
```

**Alert Mapping**:
- `id` → `vendor_alert_id` (as string)
- `plantId` → `vendor_plant_id` (as string)
- `faultInfo` → `title` and `description` (same value)
- `happenTime` → `alert_time` ("YYYY-MM-DD HH:mm:ss" → ISO 8601)
- `recoverTime` → `end_time` ("YYYY-MM-DD HH:mm:ss" → ISO 8601, nullable)
- `faultLevel` → `severity` (1=LOW, 2=MEDIUM, 3=HIGH, 4=CRITICAL)

**Severity Mapping**:
```typescript
const severityMap = {
  1: "LOW",
  2: "MEDIUM",
  3: "HIGH",
  4: "CRITICAL"
}
```

**Important Notes**:
- Handle `pages: 0` in response by calculating from `total` records
- Parse date strings in "YYYY-MM-DD HH:mm:ss" format
- Include browser-like headers (Origin, Referer, User-Agent) for API calls

### 6. Adapter Implementation

**File**: `lib/vendors/solarDmAdapter.ts`

**Key Methods**:
- `authenticate()` - Handles email/password authentication
- `listPlants()` - Fetches plants from `/dms/plant/list_all`
- `getTokenFromDB()` - Retrieves cached token
- `storeTokenInDB()` - Stores token with expiration
- `getApiBaseUrl()` - Gets API base URL from env vars
- `normalizeAlert()` - Maps SolarDM alert format to standard Alert interface
- `getAllAlerts()` - Fetches all alerts with pagination
- `getDailyTelemetryRecords()`, `getMonthlyTelemetryRecords()`, etc. - Telemetry methods

**Registration**: Adapter is registered in `lib/vendors/vendorManager.ts`:
```typescript
case 'SOLARDM':
  return new SolarDmAdapter(config)
```

---

## PVBlink Example

This section provides a complete example using PVBlink as a reference implementation.

### 1. Vendor Configuration

**Database Entry**:
```sql
INSERT INTO vendors (name, vendor_type, credentials, org_id, is_active)
VALUES (
  'PVBlink Production',
  'PVBLINK',
  '{"email": "vendor@example.com", "password": "vendor_password"}'::jsonb,
  1,
  true
);
```

**Environment Variables**:
```env
PVBLINK_API_BASE_URL=https://cloud.pvblink.com
```

### 2. Authentication

**Endpoint**: `POST /api/pvblink/user/login`

**Request**:
```json
{
  "email": "vendor@example.com",
  "password": "vendor_password",
  "confirmPassword": null,
  "resetPasswordToken": null,
  "rememberMe": false
}
```

**Response**:
```json
{
  "data": {
    "id": "655A622AD99407D29DBA6F43EF9EFD88",
    "createdOn": "2025-05-02T06:07:47.751+00:00",
    "updatedOn": "2025-05-02T06:07:47.751+00:00",
    "activeStatus": "ACTIVE",
    "firstName": "Sun Astra Energy",
    "lastName": "solutions Pvt. Ltd.",
    "email": "sunastrasolar@gmail.com",
    "dealerId": "E87F7B4A51C7F9ACFF86483BE932BA7F",
    "mobile": "8558999110",
    "profilePic": "Screenshot 21753447048535.jpg",
    "isDealer": true,
    "accessToken": "yf2apN629pmbHprXV3J_yHTP5jJeK5gr"
  }
}
```

**Implementation**:
- Token is cached in `vendors.access_token`
- Token is stored from `data.accessToken` field
- Default expiration: 11 hours 30 minutes (41400 seconds) - stored in `token_expires_at`
- Implements retry logic: max 3 attempts on authentication errors
- Token is validated before each API call (checks expiration)

**Retry Logic**:
- On authentication error (HTTP error or missing `accessToken`), the adapter retries up to 3 times
- Uses exponential backoff (1s, 2s, 3s delays)
- Fails after 3 unsuccessful attempts

**Required Headers**:
- `Accept: application/json, text/plain, */*`
- `Accept-Language: en-GB,en-US;q=0.9,en;q=0.8`
- `Content-Type: application/json`
- `Origin: https://cloud.pvblink.com`
- `Referer: https://cloud.pvblink.com/login`
- `User-Agent: Mozilla/5.0...`

### 3. Plant Listing

**Status**: Not yet implemented - TODO when API endpoint is available

### 4. Alert Synchronization

**Status**: Not yet implemented - TODO when API endpoint is available

### 5. Adapter Implementation

**File**: `lib/vendors/pvBlinkAdapter.ts`

**Key Methods**:
- `authenticate()` - Handles email/password authentication with retry logic
- `authenticateWithRetry()` - Internal method for retry logic (max 3 attempts)
- `getTokenFromDB()` - Retrieves cached token
- `storeTokenInDB()` - Stores token with expiration (11 hours 30 minutes)
- `getApiBaseUrl()` - Gets API base URL from env vars
- `listPlants()`, `getTelemetry()`, `getRealtime()`, `getAlerts()` - TODO: Implement when API endpoints are available

**Registration**: Adapter is registered in `lib/vendors/vendorManager.ts`:
```typescript
case 'PVBLINK':
  return new PvBlinkAdapter(config)
```

**Important Notes**:
- Only `email` and `password` are required for credentials
- Token expiration: 11 hours 30 minutes (41400 seconds)
- Implements automatic retry on authentication errors (max 3 attempts)
- Browser-like headers are required for API calls

---

## ShineMonitor Example

This section provides a complete example using ShineMonitor as a reference implementation.

### 1. Vendor Configuration

**Database Entry**:
```sql
INSERT INTO vendors (name, vendor_type, credentials, org_id, is_active)
VALUES (
  'ShineMonitor Production',
  'SHINEMONITOR',
  '{"user_name": "KRPC", "pass_hash": "6c8f8c16df43ccf76d2b05da9b2f8d360eddf5d4", "company_key": "bnrl_frRFjEz8Mkn"}'::jsonb,
  1,
  true
);
```

**Environment Variables**:
```env
SHINEMONITOR_API_BASE_URL=https://web.shinemonitor.com/public
```

### 2. Authentication

**Endpoint**: `GET /?sign={sign}&salt={salt}&action=auth&usr={user_name}&company-key={company_key}`

**Authentication Process**:
1. Generate `salt` = current timestamp in milliseconds: `new Date().getTime()`
2. Generate `sign` = SHA1(salt + pass_hash + action_string)
   - `action_string` = `&action=auth&usr={user_name}&company-key={company_key}`
3. Make GET request with sign and salt as query parameters

**Example Calculation**:
- `user_name` = "KRPC"
- `pass_hash` = "6c8f8c16df43ccf76d2b05da9b2f8d360eddf5d4"
- `company_key` = "bnrl_frRFjEz8Mkn"
- `salt` = 1764487501695
- `action_string` = "&action=auth&usr=KRPC&company-key=bnrl_frRFjEz8Mkn"
- `sign` = SHA1("1764487501695" + "6c8f8c16df43ccf76d2b05da9b2f8d360eddf5d4" + "&action=auth&usr=KRPC&company-key=bnrl_frRFjEz8Mkn")
- `sign` = "7ebb5a792ff29c80fecc37f75e2b551f746e1efb"

**Request**:
```
GET /?sign=7ebb5a792ff29c80fecc37f75e2b551f746e1efb&salt=1764487501695&action=auth&usr=KRPC&company-key=bnrl_frRFjEz8Mkn
Headers:
  Accept: application/json
  Origin: https://kstar.shinemonitor.com
  Referer: https://kstar.shinemonitor.com/
```

**Response**:
```json
{
  "err": 0,
  "desc": "ERR_NONE",
  "dat": {
    "secret": "961cfabc5413955995218cae0fe5c195a783086a",
    "expire": 432000,
    "token": "fda947c492cd1af56d93bf3806b5c2ca79de3356812d84af608d52abd67443ea",
    "role": 2,
    "usr": "KRPC",
    "uid": 5077101
  }
}
```

**Implementation**:
- Token is cached in `vendors.access_token`
- Secret is stored in `vendors.token_metadata.secret`
- Expiration stored in `vendors.token_expires_at` (expire is in seconds)
- Token is validated before each API call

**Key Points**:
- Salt must be generated fresh for each authentication request
- Sign is calculated using SHA1 hash of (salt + pass_hash + action_string)
- Both `token` and `secret` are required for future API calls
- `expire` is in seconds (432000 = 5 days)
- Success is indicated by `err: 0` and `desc: "ERR_NONE"`

### 3. Adapter Implementation

**File**: `lib/vendors/shineMonitorAdapter.ts`

**Key Methods**:
- `authenticate()` - Handles sign/salt authentication flow
- `generateSalt()` - Generates current timestamp as salt
- `generateSign()` - Calculates SHA1 sign for authentication
- `getTokenFromDB()` - Retrieves cached token and secret
- `storeTokenInDB()` - Stores token, secret, and expiration
- `getApiBaseUrl()` - Gets API base URL from env vars

**Registration**: Adapter is registered in `lib/vendors/vendorManager.ts`:
```typescript
case 'SHINEMONITOR':
  return new ShineMonitorAdapter(config)
```

**Note**: Plant listing, telemetry, and alerts endpoints are not yet implemented and will need to be added once the API documentation is available.

---

## Foxesscloud Example

This section provides a complete example using Foxesscloud (PV Hub) as a reference implementation.

### 1. Vendor Configuration

**Database Entry**:
```sql
INSERT INTO vendors (name, vendor_type, credentials, org_id, is_active)
VALUES (
  'Foxesscloud Production',
  'FOXESSCLOUD',
  '{"username": "vendor_username", "passwordMD5": "md5_hashed_password"}'::jsonb,
  1,
  true
);
```

**Environment Variables**:
```env
FOXESSCLOUD_API_BASE_URL=https://www.foxesscloud.com
```

### 2. Authentication

**Endpoint**: `POST /c/v0/user/login`

**Request**:
```json
{
  "user": "vendor_username",
  "password": "md5_hashed_password"
}
```

**Response**:
```json
{
  "errno": 0,
  "result": {
    "token": "eyJpZCI6IjE4ODE2MjI1LTdhMDEtNGFlYS1hMTQ3LTJiODU0OTY1MTE3YyIsInNlY3JldCI6ImJkYjY1OGRjZWJlYzNkZmVmZjZlODBhOTI0ODg3Njg2ZDQ1NWZhNzc1N2QxNzg2ZDViMmRkNTIyYmZhZWVmMmYiLCJwYXlsb2FkIjoid0NBTDV4dC8rQThjREYwZUhJQzc0RjREZVgvV3drYlptdHgyaHRNRlNrOTYyanhGa2I2UzFpKzM0dEJTZ0ZaM1VPTytJOU1iS1E0S3B4SG1QM1ZBZTVUdHYrSDkybWhaR1pid3pEbXRHcnJLazhpZ1BVSHY5UUNpbHNEL0VsWEJORmdPc0hxNC9SYWl3ZzVQVHZJdkhwUTFoTjJRVjQ2WExmeTI5V1h0ekRmaXEwRzhaZ2c2TVJPN0hIcUZVaHc0THJOd3RicFVkNG9sdnpmd0hoL2Vnd01YNjcvMHk1bWM0cVBMNVdNMzgvSFJQMzJtRmxVRk9aZTNmc0tFWUhwMSJ9",
    "access": 1,
    "user": "MTPLCDG",
    "weakFlag": false
  }
}
```

**Implementation**:
- Token is cached in `vendors.access_token`
- Token is stored from `result.token` field
- Default expiration: 23 hours 30 minutes (84600 seconds) - stored in `token_expires_at`
- Implements retry logic: max 3 attempts on authentication errors
- Token is validated before each API call (checks expiration)

**Retry Logic**:
- On authentication error (HTTP error, `errno !== 0`, or missing `token`), the adapter retries up to 3 times
- Uses exponential backoff (1s, 2s, 3s delays)
- Fails after 3 unsuccessful attempts

**Required Headers**:
- `Accept: application/json, text/plain, */*`
- `Accept-Language: en-GB,en-US;q=0.9,en;q=0.8`
- `Content-Type: application/json;charset=UTF-8`
- `contenttype: application/json`
- `lang: en`
- `Origin: https://www.foxesscloud.com`
- `Referer: https://www.foxesscloud.com/login`
- `timezone: Asia/Calcutta`
- `timestamp: {current_timestamp}` (generated dynamically)
- `User-Agent: Mozilla/5.0...`

**Error Response**:
- Success: `errno: 0`
- Error: `errno: non-zero` (check this field, not just HTTP status)

### 3. Plant Listing

**Status**: Not yet implemented - TODO when API endpoint is available

### 4. Alert Synchronization

**Status**: Not yet implemented - TODO when API endpoint is available

### 5. Adapter Implementation

**File**: `lib/vendors/foxesscloudAdapter.ts`

**Key Methods**:
- `authenticate()` - Handles username/passwordMD5 authentication with retry logic
- `authenticateWithRetry()` - Internal method for retry logic (max 3 attempts)
- `getTokenFromDB()` - Retrieves cached token
- `storeTokenInDB()` - Stores token with expiration (23 hours 30 minutes)
- `getApiBaseUrl()` - Gets API base URL from env vars
- `listPlants()`, `getTelemetry()`, `getRealtime()`, `getAlerts()` - TODO: Implement when API endpoints are available

**Registration**: Adapter is registered in `lib/vendors/vendorManager.ts`:
```typescript
case 'FOXESSCLOUD':
  return new FoxesscloudAdapter(config)
```

**Important Notes**:
- Only `username` and `passwordMD5` (MD5 hashed password) are required for credentials
- Token expiration: 23 hours 30 minutes (84600 seconds)
- Implements automatic retry on authentication errors (max 3 attempts)
- Browser-like headers are required for API calls
- Check `errno` field in response (0 = success, non-zero = error)
- Timestamp header is generated dynamically for each request

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
- [ ] Extract live telemetry fields (currentPowerKw, dailyEnergyKwh, monthlyEnergyMwh, yearlyEnergyMwh, totalEnergyMwh, networkStatus) if available
- [ ] Handle pagination (if vendor API supports it)
- [ ] Test with multiple plants

### Phase 3.5: Optional - Per-Plant Fetching

- [ ] Implement `listPlant(vendorPlantId)` method (optional but recommended)
- [ ] Used for live telemetry sync in PER_PLANT mode
- [ ] Used for enriching plants during plant sync if live telemetry missing from listPlants()
- [ ] Include same live telemetry fields as listPlants()
- [ ] Test with single plant fetch

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
- [ ] Extract vendor_plant_id
- [ ] Filter alerts by device type (e.g., only INVERTER alerts) - filtered but not stored
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
  // Required methods
  abstract authenticate(): Promise<string>
  abstract listPlants(): Promise<Plant[]>
  abstract getTelemetry(plantId: string, startTime: Date, endTime: Date): Promise<TelemetryData[]>
  abstract getRealtime(plantId: string): Promise<RealtimeData>
  abstract getAlerts(plantId: string): Promise<Alert[]>
  
  // Optional methods
  async listPlant(vendorPlantId: string): Promise<Plant | null> {
    // Default implementation throws - vendors should override if they support per-plant fetching
    throw new Error(`listPlant() not implemented for vendor type: ${this.config.vendorType}`)
  }
  
  // Protected normalization methods
  protected abstract normalizeTelemetry(rawData: any): TelemetryData
  protected abstract normalizeAlert(rawData: any): Alert
  
  // Token management
  setTokenStorage?(vendorId: number, supabaseClient: any): void
}
```

---

**Last Updated**: 2025-01-XX
**Version**: 1.0

