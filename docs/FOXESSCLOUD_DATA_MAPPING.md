# FoxESS Cloud Data Mapping Documentation

This document explains what data is stored in the database for FoxESS Cloud (FOXESSCLOUD) vendors and how FoxESS Open API attributes map to database columns.

**Status:** FoxESS data mapping is implemented and aligned with the adapter (`foxesscloudAdapter.ts`), sync/telemetry services, and the `plants` table. All mappings below reflect the current code.

## Data Flow Overview

```
FoxESS Open API
  POST /op/v0/plant/list        → minimal list (stationID, name, ianaTimezone only)
  GET  /op/v0/plant/detail?id=  → per-plant detail (capacity, address, createDate, modules)
  POST /op/v0/device/list       → deviceSN[] per plant
  GET  /op/v0/device/generation?sn=...  → today, month, year, cumulate (per device)
    ↓
FoxesscloudAdapter.listPlants() / listPlant()
    ↓
sync-plants API route / live telemetry sync
    ↓
Database (plants table)
```

The **plant list** API does not return capacity, address, or createDate. The adapter calls **plant/detail** per `stationID` to get those fields (and `modules`). Telemetry (daily/monthly/yearly/current power) still comes from device/generation and device/real/query.

---

## 1. FoxESS Authentication Model

FoxESS does **not** use a login/token flow. It uses a **static API key + per-request MD5 signature**.

- **Credentials**: `{ "apiKey": "..." }` in `vendors.credentials`
- **Headers per request**: `token` (apiKey), `timestamp` (ms), `signature` = MD5(`path + "\r\n" + apiKey + "\r\n" + timestamp`), `lang: "en"`
- **path**: URL path only (e.g. `/op/v0/plant/list`), not full URL
- `authenticate()` returns the apiKey and performs no HTTP call. Token storage fields in DB can remain null.

---

## 2. API Endpoints

Each endpoint is documented with **Request** (params + body) then **Response**. POST requests use `Content-Type: application/json`.

---

### 2.1 Plant list — POST /op/v0/plant/list

**Request**

| Where | Name | Type | Required | Description |
|-------|------|------|----------|-------------|
| Body | `currentPage` | number | Yes | 1-based page index |
| Body | `pageSize` | number | Yes | Page size (adapter uses 100) |

```json
{
  "currentPage": 1,
  "pageSize": 100
}
```

**Response** (minimal — list does not include capacity, address, or createTime)

```json
{
  "errno": 0,
  "msg": "Operation successful",
  "result": {
    "total": 2,
    "data": [
      {
        "name": "3500-24-2082-0-3",
        "ianaTimezone": "Asia/Calcutta",
        "stationID": "83180474-a329-4629-9ea2-fb82fee3e95b"
      },
      {
        "name": "3500-24-2071-0-3",
        "ianaTimezone": "Asia/Calcutta",
        "stationID": "00c1020a-4a9a-4edc-b075-308eb0fa7586"
      }
    ],
    "pageSize": 100,
    "currentPage": 1
  }
}
```

Success: `errno === 0`. Pagination: `currentPage`, `pageSize`, `total`. Use **plant/detail** per `stationID` for capacity, address, createDate, modules.

---

### 2.2 Plant detail — GET /op/v0/plant/detail

Used per plant to get full info (list does not provide these). Does **not** provide telemetry.

**Request**

| Where | Name | Type | Required | Description |
|-------|------|------|----------|-------------|
| Query | `id` | string | Yes | Plant/station ID (stationID from list) |

Example: `GET /op/v0/plant/detail?id=00c1020a-4a9a-4edc-b075-308eb0fa7586`

**Response**

```json
{
  "errno": 0,
  "msg": "Operation successful",
  "result": {
    "country": "IN",
    "address": "Chandigarh ",
    "installer": { "phone": "", "name": "solaryaan ltd", "email": "solaryaan ltd" },
    "city": "Chandigarh ",
    "timezone": "Asia/Calcutta",
    "postcode": "160023",
    "stationName": "3500-24-2071-0-3",
    "user": { "phone": "", "name": "", "email": "document@mechatroniksolar.com" },
    "modules": [
      { "moduleSN": "709G3E9F53EB220", "deviceSN": "SYS1191161C3141" }
    ],
    "capacity": 3.0,
    "createDate": "2025-04-12 17:46:42 IST+0530"
  }
}
```

Mapping: `capacity` → capacity_kw; `stationName` → name; `address` (and city, postcode, country) → location (JSONB); `createDate` → vendor_created_date, start_operating_time; `result.modules` → metadata.modules.

---

### 2.3 Device list — POST /op/v0/device/list

**Request**

| Where | Name | Type | Required | Description |
|-------|------|------|----------|-------------|
| Body | `currentPage` | number | Yes | 1-based page index |
| Body | `pageSize` | number | Yes | Page size (adapter uses 20) |

```json
{
  "currentPage": 1,
  "pageSize": 20
}
```

**Response**

```json
{
  "errno": 0,
  "result": {
    "data": [
      {
        "deviceSN": "XYZ001",
        "deviceType": "H1",
        "plantID": "abc123",
        "status": 1
      }
    ]
  }
}
```

Used to build `stationID → deviceSN[]`. One plant can have multiple inverters.

---

### 2.4 Device generation — GET /op/v0/device/generation

**Request**

| Where | Name | Type | Required | Description |
|-------|------|------|----------|-------------|
| Query | `sn` | string | Yes | Device serial number |

Example: `GET /op/v0/device/generation?sn=XYZ001`

**Response**

```json
{
  "errno": 0,
  "result": {
    "today": 1.23,
    "month": 45.67,
    "year": 512.34,
    "cumulate": 9876.5
  }
}
```

All values in **kWh** (converted to MWh where stored; see unit table later).

---

### 2.5 Real-time power — POST /op/v1/device/real/query

**Request**

| Where | Name | Type | Required | Description |
|-------|------|------|----------|-------------|
| Body | `sns` | string[] | Yes | Array of device serial numbers |
| Body | `variables` | string[] | Yes | e.g. `["generationPower"]` |

```json
{
  "sns": ["XYZ001", "XYZ002"],
  "variables": ["generationPower"]
}
```

**Response**

Result keyed by device SN; each entry has `variable` and `value` (or `data`). Power in **W**; adapter converts to kW.

---

### 2.6 Daily history — POST /op/v0/device/history/query

**Request**

| Where | Name | Type | Required | Description |
|-------|------|------|----------|-------------|
| Body | `sn` | string | Yes | Device serial number |
| Body | `variables` | string[] | Yes | e.g. `["generationPower"]` |
| Body | `begin` | number | Yes | Start of day in UTC milliseconds |
| Body | `end` | number | Yes | End of day in UTC milliseconds |

```json
{
  "sn": "XYZ001",
  "variables": ["generationPower"],
  "begin": 1609459200000,
  "end": 1609545599999
}
```

**Response**

`result.datas[]` with `variable` and `data: Array<[epochMs, powerW]>`. 5-minute intervals. Adapter aggregates multiple devices per plant and converts power W → kW where needed.

---

### 2.7 Monthly report — POST /op/v0/device/report/query

**Request**

| Where | Name | Type | Required | Description |
|-------|------|------|----------|-------------|
| Body | `sn` | string | Yes | Device serial number |
| Body | `year` | number | Yes | Year (e.g. 2025) |
| Body | `month` | number | Yes | Month 1–12 |
| Body | `dimension` | string | Yes | `"month"` for daily values in month |
| Body | `variables` | string[] | Yes | e.g. `["generation"]` |

```json
{
  "sn": "XYZ001",
  "year": 2025,
  "month": 6,
  "dimension": "month",
  "variables": ["generation"]
}
```

**Response**

`result.data[]` with `index` (day 1–31) and `value` (daily kWh). Adapter sums per day across devices and stores as MWh in records.

---

### 2.8 Yearly report — POST /op/v0/device/report/query

**Request**

| Where | Name | Type | Required | Description |
|-------|------|------|----------|-------------|
| Body | `sn` | string | Yes | Device serial number |
| Body | `year` | number | Yes | Year (e.g. 2025) |
| Body | `dimension` | string | Yes | `"year"` for monthly values in year |
| Body | `variables` | string[] | Yes | e.g. `["generation"]` |

No `month` in body.

```json
{
  "sn": "XYZ001",
  "year": 2025,
  "dimension": "year",
  "variables": ["generation"]
}
```

**Response**

`result.data[]` with `index` (month 1–12) and `value` (monthly kWh). Adapter sums per month across devices and stores as MWh in records.

---

### 2.9 Device errors (alerts) — GET /op/v0/device/error/query

**Request**

| Where | Name | Type | Required | Description |
|-------|------|------|----------|-------------|
| Query | `sn` | string | Yes | Device serial number |

Example: `GET /op/v0/device/error/query?sn=XYZ001`

**Response**

Array of error items: `id`, `errorCode`, `errorName`, `deviceSN`, `level` (0=LOW, 1=MEDIUM, 2=HIGH, 3=CRITICAL), `startTime`, `endTime` (Unix seconds). Adapter normalizes to `vendorAlertId`, `title`, `description`, `severity`.

---

## 3. Adapter Transformation (FoxesscloudAdapter)

### Plant (listPlants / listPlant)

Flow: **list** (minimal) → **detail** per stationID → device/list + device/generation (and real/query for current power) for telemetry.

| Source | FoxESS Field | Adapter Processing | Plant Object Field |
|--------|--------------|-------------------|-------------------|
| List | `station.stationID` | Direct | `id` (plantId) |
| List | `station.name` | Fallback if detail missing | `name` |
| Detail | `result.stationName` | Direct | `name` |
| Detail | `result.capacity` | Direct (kW) | `capacityKw` |
| Detail | `result.address`, `city`, `postcode`, `country` | Joined into one string | `location.address` |
| Detail | (no lat/lon in detail) | — | `location.lat` / `lng` undefined |
| Detail | `result.createDate` | Parsed (e.g. "2025-04-12 17:46:42 IST+0530" → ISO) | `metadata.vendorCreatedDate`, `metadata.startOperatingTime` |
| Detail | `result.timezone` or list `ianaTimezone` | Direct | `metadata.timezone` |
| Detail | `result.modules` | Direct | `metadata.modules` |
| Devices | Aggregated device `today` | Sum across devices | `metadata.dailyEnergyKwh` (kWh) |
| Devices | Aggregated device `month` / `year` / `cumulate` | Sum ÷ 1000 | `metadata.monthlyEnergyMwh` etc. |
| Devices | Real-time `generationPower` | POST /op/v1/device/real/query, W → kW | `metadata.currentPowerKw` |

List response only has `stationID`, `name`, `ianaTimezone`. All other plant fields (capacity, location, createDate, modules) come from **GET /op/v0/plant/detail?id={stationID}**. Telemetry still from device/generation and device/real/query.

---

## 4. Database Storage (plants table)

| Database Column | Source | Transformation | Notes |
|-----------------|--------|----------------|-------|
| `vendor_plant_id` | `plant.id` | Direct (stationID string) | FoxESS station ID |
| `name` | `plant.name` | Direct | |
| `capacity_kw` | `plant.capacityKw` | Direct | Already in kW |
| `location` | `plant.location` | JSONB | lat, lng, address |
| `current_power_kw` | `metadata.currentPowerKw` | Direct | From real/query (W→kW in adapter) |
| `daily_energy_kwh` | `metadata.dailyEnergyKwh` | Direct | **kWh** (not MWh) |
| `monthly_energy_mwh` | `metadata.monthlyEnergyMwh` | Direct | kWh→MWh in adapter |
| `yearly_energy_mwh` | `metadata.yearlyEnergyMwh` | Direct | kWh→MWh in adapter |
| `total_energy_mwh` | `metadata.totalEnergyMwh` | Direct | kWh→MWh in adapter |
| `network_status` | `metadata.networkStatus` | Direct | NORMAL / ALL_OFFLINE / PARTIAL_OFFLINE |
| `last_update_time` | `metadata.lastUpdateTime` | As-is | Often null (not in plant list) |
| `vendor_created_date` | `metadata.vendorCreatedDate` | ISO → TIMESTAMPTZ | From createTime |
| `start_operating_time` | `metadata.startOperatingTime` | ISO → TIMESTAMPTZ | From createTime |

---

## 5. Unit Conversion Reference

| FoxESS Field | Unit | Stored / Returned | Conversion |
|--------------|------|-------------------|------------|
| `station.capacity` | kW | `capacity_kw` | Direct |
| `generation.today` | kWh | `daily_energy_kwh` | Direct |
| `generation.month` | kWh | `monthly_energy_mwh` | ÷ 1000 |
| `generation.year` | kWh | `yearly_energy_mwh` | ÷ 1000 |
| `generation.cumulate` | kWh | `total_energy_mwh` | ÷ 1000 |
| `generationPower` (real-time) | W | `current_power_kw` | ÷ 1000 |
| History `data[][1]` | W | records `generationPower` | As-is (W) in daily telemetry |

---

## 6. Telemetry Methods

- **Daily**: POST `/op/v0/device/history/query` (begin/end in ms). 5-minute intervals. Power in W; energy = (powerW/1000) * (5/60) per interval.
- **Monthly**: POST `/op/v0/device/report/query` with `dimension: "month"`. `index` = day (1–31), `value` = daily kWh → MWh in records.
- **Yearly**: Same report API, `dimension: "year"`. `index` = month (1–12), value = monthly kWh → MWh.
- **Total**: GET `/op/v0/device/generation` → `cumulate` (kWh → MWh); yearly breakdown via getYearlyTelemetryRecords per year.

---

## 7. Alerts

- **Endpoint**: GET `/op/v0/device/error/query?sn={deviceSN}`
- **Severity**: level 0=LOW, 1=MEDIUM, 2=HIGH, 3=CRITICAL
- **Status**: `endTime` present → RESOLVED, else ACTIVE
- Timestamps: Unix seconds → ISO 8601 in adapter/normalizeAlert.

---

## 8. Rate Limiting

- Read: max 1 call/second per endpoint. Adapter uses batches of 10 device calls with 1.1 s delay between batches.
- 1440 calls/day per inverter (across all endpoints).

---

## 9. References

- **Adapter**: `lib/vendors/foxesscloudAdapter.ts`
- **Sync**: `app/api/vendors/[id]/sync-plants/route.ts`, live telemetry sync service
- **Telemetry API**: `app/api/plants/[id]/telemetry/route.ts` (uses `getDailyTelemetryRecords` with vendor_plant_id as string)
- **Environment**: `FOXESSCLOUD_API_BASE_URL` (default: https://www.foxesscloud.com)
