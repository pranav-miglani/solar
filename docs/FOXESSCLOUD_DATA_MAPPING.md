# FoxESS Cloud Data Mapping Documentation

This document explains what data is stored in the database for FoxESS Cloud (FOXESSCLOUD) vendors and how FoxESS Open API attributes map to database columns.

## Data Flow Overview

```
FoxESS Open API
  POST /op/v0/plant/list     → stations
  POST /op/v0/device/list    → deviceSN[] per plant
  GET  /op/v0/device/generation?sn=...  → today, month, year, cumulate (per device)
    ↓
FoxesscloudAdapter.listPlants() / listPlant()
    ↓
sync-plants API route / live telemetry sync
    ↓
Database (plants table)
```

---

## 1. FoxESS Authentication Model

FoxESS does **not** use a login/token flow. It uses a **static API key + per-request MD5 signature**.

- **Credentials**: `{ "apiKey": "..." }` in `vendors.credentials`
- **Headers per request**: `token` (apiKey), `timestamp` (ms), `signature` = MD5(`path + "\r\n" + apiKey + "\r\n" + timestamp`), `lang: "en"`
- **path**: URL path only (e.g. `/op/v0/plant/list`), not full URL
- `authenticate()` returns the apiKey and performs no HTTP call. Token storage fields in DB can remain null.

---

## 2. FoxESS API Response Structures

### Plant list — POST /op/v0/plant/list

```json
{
  "errno": 0,
  "result": {
    "currentPage": 1,
    "pageSize": 100,
    "total": 5,
    "data": [
      {
        "stationID": "abc123",
        "name": "My Solar Plant",
        "capacity": 10.5,
        "address": "123 Solar St",
        "lat": 28.6139,
        "lon": 77.2090,
        "timezone": "Asia/Kolkata",
        "status": 1,
        "createTime": 1609459200
      }
    ]
  }
}
```

Success: `errno === 0`. Pagination: `currentPage`, `pageSize`, `total`.

### Device list — POST /op/v0/device/list

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

### Device generation — GET /op/v0/device/generation?sn={deviceSN}

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

All values in **kWh** except when stored as MWh (see unit table below).

---

## 3. Adapter Transformation (FoxesscloudAdapter)

### Plant (listPlants / listPlant)

| FoxESS Field | Adapter Processing | Plant Object Field |
|--------------|-------------------|-------------------|
| `station.stationID` | Direct | `id` |
| `station.name` | Direct | `name` |
| `station.capacity` | Direct (already kW) | `capacityKw` |
| `station.lat` | Combined | `location.lat` |
| `station.lon` | **Note: FoxESS uses "lon"** | `location.lng` |
| `station.address` | Combined | `location.address` |
| Aggregated device `today` | Sum across devices | `metadata.dailyEnergyKwh` (kWh) |
| Aggregated device `month` | Sum ÷ 1000 | `metadata.monthlyEnergyMwh` |
| Aggregated device `year` | Sum ÷ 1000 | `metadata.yearlyEnergyMwh` |
| Aggregated device `cumulate` | Sum ÷ 1000 | `metadata.totalEnergyMwh` |
| Real-time `generationPower` | POST /op/v1/device/real/query, W → kW | `metadata.currentPowerKw` |
| `station.status` | mapFoxStatus(1=NORMAL, 2=ALL_OFFLINE, 3=PARTIAL_OFFLINE) | `metadata.networkStatus` |
| `station.createTime` | Unix (sec) → ISO | `metadata.vendorCreatedDate`, `metadata.startOperatingTime` |
| `station.timezone` | Direct | `metadata.timezone` |

### Network status mapping

| FoxESS status | metadata.networkStatus |
|---------------|------------------------|
| 1 | NORMAL |
| 2 | ALL_OFFLINE |
| 3 | PARTIAL_OFFLINE |
| default | ALL_OFFLINE |

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
