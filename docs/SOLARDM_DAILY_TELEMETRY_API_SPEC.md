# SolarDM Daily Telemetry API Spec

Spec for the SolarDM **daily** telemetry endpoint used to fetch interval-level power data for a single plant on a single day. Implementation: `lib/vendors/solarDmAdapter.ts` → `getDailyTelemetryRecords()`.

---

## Endpoint

| Item | Value |
|------|--------|
| **Method** | `GET` |
| **Path** | `/dms/data_panel/history/stats/daily/{plantId}` |
| **Full URL** | `{baseUrl}/dms/data_panel/history/stats/daily/{plantId}?plantId={plantId}&type=date&time={date}` |

`baseUrl` comes from vendor config / env (e.g. `SOLARDM_API_BASE_URL`).

---

## Request

### Path parameter

| Name | Type | Description |
|------|------|-------------|
| `plantId` | string | Vendor plant ID (e.g. `"12345"`). Same value must be repeated in query. |

### Query parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `plantId` | string | Yes | Same as path (repeated in query). |
| `type` | string | Yes | Literal `"date"` for daily stats. |
| `time` | string | Yes | Date in **YYYY-MM-DD** (e.g. `2025-02-10`). |

### Headers

| Name | Value |
|------|--------|
| `Accept` | `application/json, text/plain, */*` |
| `Authorization` | `Bearer {token}` |

Token is obtained via adapter `authenticate()` (SolarDM login/token flow).

### Example

```http
GET /dms/data_panel/history/stats/daily/12345?plantId=12345&type=date&time=2025-02-10
Accept: application/json, text/plain, */*
Authorization: Bearer <token>
```

---

## Response

### Envelope

- **Content-Type**: `application/json`
- Top-level shape: `{ code, message?, data? }`
  - `code`: `0` = success; non-zero = error.
  - `message`: Present on error.
  - `data`: Present on success; see below.

### Success body (`code === 0`)

```json
{
  "code": 0,
  "data": {
    "dataList": [
      {
        "time": "2025-02-10 00:20:00",
        "generationPower": 1200
      },
      ...
    ]
  }
}
```

### `data.dataList[]` (per interval)

| Field | Type | Description |
|-------|------|-------------|
| `time` | string | Interval timestamp in **YYYY-MM-DD HH:mm:ss** (server/local time; timezone not specified in API). |
| `generationPower` | number | Average or instantaneous power for the interval, in **watts (W)**. |

- Intervals are **20 minutes** (our code assumes this when computing daily energy: `energy_kwh = (generationPower / 1000) * (20/60)`).
- Number of points per day depends on API (e.g. 72 points for 24h at 20-min spacing).

---

## How we use it in code

1. **URL**: `baseUrl + "/dms/data_panel/history/stats/daily/" + plantIdStr + "?plantId=" + plantIdStr + "&type=date&time=" + dateStr`
2. **Auth**: Bearer token from `authenticate()`.
3. **Parse**:  
   - Require `data.code === 0` and `data.data.dataList` (array).  
   - Map each `item`:  
     - `item.time` → parse to Unix seconds for `dateTime`.  
     - `item.generationPower` → used as-is in **W** (converted to kW only when computing energy).
4. **Statistics**:  
   - Daily generation (kWh) = sum over all intervals of `(generationPower / 1000) * (20/60)`.

---

## Normalized output (adapter contract)

`getDailyTelemetryRecords(plantId, year, month, day)` returns:

- **statistics**:  
  - `systemId`, `year`, `month`, `day`, `generationValue` (daily kWh), optional `fullPowerHoursDay`, `acceptDay` (YYYY-MM-DD).
- **records**:  
  - `systemId`, `generationPower` (W), `dateTime` (Unix seconds), optional `generationCapacity`, `timeZoneOffset` (SolarDM does not provide these; set to `null`).

---

## Notes

- **Interval**: 20 minutes (fixed in our calculation). If the API ever returns a different interval, the formula in `solarDmAdapter.ts` (e.g. `intervalHours = 20/60`) would need to be updated.
- **Timezone**: API does not return timezone; we parse `time` as-is. For correct daily boundaries, confirm whether `time` is plant local or UTC.
- **Errors**: Non-OK HTTP or `code !== 0` or missing `data.dataList` result in a thrown error from the adapter.
