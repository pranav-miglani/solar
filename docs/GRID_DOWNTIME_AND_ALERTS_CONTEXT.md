# Grid Downtime & Alerts – Full Context for ShineMonitor Alert API Analysis

This document provides end-to-end context: how grid downtime is computed, how alerts are tied to plants, existing vendor alert APIs (Solarman, SolarDM), and what ShineMonitor needs so you can optimize the ShineMonitor alert curl/params (e.g. `queryPlantWarning`).

---

## 1. Alerts table (main DB)

- **Table**: `alerts`
- **Key columns**:
  - `id` (SERIAL PK)
  - `plant_id` (INTEGER, FK → plants.id) – **our** internal plant id
  - `vendor_id` (INTEGER, FK → vendors.id)
  - `vendor_plant_id` (TEXT) – vendor’s plant/station id (e.g. Solarman stationId as string, SolarDM plantId)
  - `vendor_alert_id` (TEXT) – vendor’s alert id (for dedup)
  - `alert_time` (TIMESTAMPTZ) – when alert **started**
  - `end_time` (TIMESTAMPTZ, nullable) – when alert **ended**; null = still active
  - `grid_down_seconds` (INTEGER) – computed: `max(0, end_time - alert_time)` in seconds
  - `grid_down_benefit_kwh` (NUMERIC(12,3)) – computed (see below)
  - `title` (TEXT), `description` (TEXT), `severity` (enum), `status` (enum: ACTIVE, RESOLVED, ACKNOWLEDGED)
- **Uniqueness**: `(vendor_id, vendor_plant_id, vendor_alert_id)` when `vendor_alert_id IS NOT NULL`
- **Grid-down alerts**: We only treat alerts as “grid down” when `description = 'GRID_DOWN'` (title/description normalized from “No Mains Voltage” / “There is no mains voltage”).

---

## 2. Grid downtime computation (at alert sync time)

Done in `lib/services/alertSyncService.ts` when we **insert/update** each alert.

### 2.1 `grid_down_seconds`

- **Formula**: `max(0, end_time - alert_time)` in seconds.
- **When**: Only when both `alert_time` and `end_time` exist. If `end_time` is null (open alert), we do **not** set `grid_down_seconds` (stays null).

### 2.2 `grid_down_benefit_kwh`

- **Formula**: `0.5 × hours × capacity_kw`
  - `hours` = overlap of the alert interval `[alert_time, end_time]` with the **9:00–16:00 local window** (in the plant/vendor timezone).
  - `capacity_kw` = plant’s `capacity_kw` from our DB (from plant mapping).
- **Functions**:
  - `calculateGridDownHoursWithinWindow(start, end, timeZone)` – returns hours of overlap with 9–16 local.
  - `calculateGridDownBenefitKwh(start, end, capacityKw, timeZone)` – returns `0.5 * hours * capacityKw`, rounded to 3 decimals.
- **Timezone**:
  - Solarman: uses `raw.timezone` from the alert if present; otherwise fallback (e.g. `"Asia/Calcutta"`).
  - SolarDM: uses `"Asia/Calcutta"` (no timezone in API).
- **If** `start`/`end` missing, or `capacityKw` ≤ 0, or `hours` ≤ 0 → `grid_down_benefit_kwh` is stored as **null**.

So at **alert level** we store:
- One **grid_down_seconds** per alert (total duration).
- One **grid_down_benefit_kwh** per alert (benefit only for 9–16 window, using plant capacity).

---

## 3. Plant-level: how alerts are tied to plants

- Alerts are **per plant**: each row has `plant_id` (our id) and `vendor_plant_id` (vendor’s id).
- **Plant mapping** is built once per vendor before fetching alerts:
  - We load from DB: `plants` for that `vendor_id` with `id`, `vendor_plant_id`, `capacity_kw`.
  - **Solarman**: Map key = numeric `stationId` (we parse `vendor_plant_id` as number). API returns `stationId` per alert.
  - **SolarDM**: Map key = string `plantId`. API returns `plantId` per alert.
- Each vendor alert is then:
  - Mapped to our `plant_id` and `vendor_plant_id` via this map.
  - Rejected if there’s no matching plant (e.g. station not yet synced).
- **capacity_kw** from the same plant row is used **only** for `grid_down_benefit_kwh`; it is **not** stored on the alert row.

So “at plant level” means:
- Every alert row has exactly one `plant_id` and one `vendor_plant_id`.
- Grid downtime **seconds** are stored on the alert; **benefit** uses that plant’s `capacity_kw` at computation time.

---

## 4. Grid downtime analytics (plant-level aggregates)

- **Service**: `lib/services/gridDowntimeAnalyticsService.ts`
- **Source**: Only alerts with `description = 'GRID_DOWN'` from main DB.
- **Target**: Analytics DB table `plant_grid_downtime_readings` (per plant, per day).

### 4.1 How it’s computed

- **Window**: Last 100 days (configurable), in **IST** (Asia/Kolkata).
- **9–16 IST rule**: For each alert we count only seconds that fall inside 9:00–16:00 **IST** on each day; multi-day alerts are split by IST day.
- **Per plant**:
  - All GRID_DOWN alerts for that `plant_id` are grouped.
  - For each IST day in the window we sum the “9–16 IST” seconds from those alerts → `daily_grid_down_seconds`.
  - We then form a **running total** over the window (using a baseline if present) → `total_grid_down_seconds` per day.
- **Baseline**: From previous runs (function `get_latest_grid_downtime_baselines(cutoff_date)`). New plants or first run use no baseline (start from 0).

### 4.2 Table `plant_grid_downtime_readings` (analytics)

- `plant_id`, `reading_date` (IST date), `org_id`, `vendor_id`, `vendor_plant_id`
- `daily_grid_down_seconds` – seconds of grid down in 9–16 IST for that day
- `total_grid_down_seconds` – cumulative total up to that day
- Unique on `(plant_id, reading_date)`.

So **plant-level** grid downtime in analytics = daily and cumulative **seconds** (9–16 IST only), derived from `alerts` where `description = 'GRID_DOWN'`.

---

## 5. Solarman alert API (reference for “all plants” vendor API)

- **Base**: PRO API base URL (e.g. from env or config), e.g. `https://globalapi.solarmanpv.com` or PRO-specific URL.
- **Endpoint**: `POST /maintain-s/operating/station/alert`
- **Query params** (for pagination/sort):
  - `order.direction=ASC`
  - `order.property=alertTime`
  - `size=100`
  - `page=<pageNumber>` (1-based)
- **Body** (JSON):
  - `alertQueryName: "No Mains Voltage"`
  - `language: "en"`
  - `status: "-1"` (all statuses)
  - `timeZone: "Asia/Calcutta"`
- **Auth**: Bearer token (from adapter `authenticate()`).
- **Response**: List of alerts; each has at least:
  - `id`, `stationId`, `alertTime`, `endTime` (Unix seconds; endTime null if active)
  - `alertName`, `deviceType`, `level`, `influence`, `timezone`
- **Our filter**: We only process items with `deviceType === "INVERTER"` (filter in code; not sent to API).
- **Plant mapping**: We map `stationId` (number) → our plant via `plants.vendor_plant_id` (stored as string; we parse to number for Solarman).

So for ShineMonitor you can compare: we need something that returns alerts for **all plants** (or per-plant with a loop), with **alert id**, **plant/site id**, **start time**, **end time**, and ideally **alert type** so we can normalize to “grid down”.

---

## 6. SolarDM alert API (reference for “all plants” + query filter)

- **Endpoint**: `GET {baseUrl}/dms/inverter_fault/page_list/all`
- **Query params**:
  - `current=<page>` (1-based)
  - `size=100`
  - `faultInfo=There is no mains voltage` (filter on server)
- **Auth**: Bearer (or adapter’s auth).
- **Response**: `data.records[]` with e.g.:
  - `id`, `plantId`, `happenTime`, `recoverTime` (dates as `"YYYY-MM-DD HH:mm:ss"`)
  - `faultInfo`, `faultLevel`, etc.
- **Plant mapping**: We map `plantId` (string) → our plant via `plants.vendor_plant_id`.
- **Date filter**: We optionally filter by our lookback window in code (`alertsStartDate` from vendor credentials, max 1 year).

So ShineMonitor could support:
- Either an “all plants” list with pagination, or a per-plant endpoint we call in a loop.
- Some way to filter by “grid down” type (e.g. fault name or code) and by date if the API allows.

---

## 7. ShineMonitor: existing client pattern (for curl/param design)

- **Auth**: Sign/salt/token. Every request needs:
  - `sign` = SHA1(salt + secret + token + `"&action=<action>&<param1>=<value1>&..."`)
  - `salt` = current timestamp (ms)
  - `token` from auth response
  - Query string for sign is **all params except sign, salt, token**, in order, prefixed with `&`.
- **Base URL**: e.g. `https://web.shinemonitor.com/public` or from `SHINEMONITOR_API_BASE_URL`.
- **Existing pattern** (e.g. daily telemetry):
  - GET `{base}/?sign=...&salt=...&token=...&action=queryPlantActiveOuputPowerOneDay&plantid={vendorPlantId}&date=YYYY-MM-DD`
- **Doc says**: Alerts → `action=queryPlantWarning` (exact param set not specified in our repo).

So for **ShineMonitor alert curl/param optimization** you need to:
- Confirm the exact **action** name (e.g. `queryPlantWarning`).
- Confirm **required/optional params** (e.g. `plantid`, date range, page size, filters).
- Reuse the same sign/salt/token pattern as other ShineMonitor GET endpoints.
- Decide: one call for all plants (with or without pagination) vs one call per plant (and we loop).

---

## 8. Lookback and date handling

- **Lookback**: From vendor credentials `alertsStartDate` (ISO date string); if missing, 1 year. Never more than 1 year.
- **Solarman**: We pass timezone in the body; API returns alerts in that range (we don’t send explicit start/end in the snippet we have; pagination by page).
- **SolarDM**: We fetch all pages, then in code we **filter** by `alert_time >= startDate` and `alert_time <= endDate`.
- **Stored times**: We always store `alert_time` and `end_time` in DB as **timestamptz** (ISO); conversion from vendor format (Unix seconds or `"YYYY-MM-DD HH:mm:ss"`) is done in the sync service.

For ShineMonitor, ideal would be: either API supports date range (and optionally plant filter), or we get enough data and filter by date (and plant) in code like SolarDM.

---

## 9. Summary: what to feed into GPT for ShineMonitor alert curl optimization

1. **Alerts table**: We need to upsert rows with `plant_id`, `vendor_id`, `vendor_plant_id`, `vendor_alert_id`, `alert_time`, `end_time`, `title`, `description` (e.g. `GRID_DOWN`), `severity`, `status`, plus computed `grid_down_seconds` and `grid_down_benefit_kwh`.
2. **Plant-level**: Each alert must be mappable to a single plant via `vendor_plant_id`; we have `capacity_kw` from the plants table for benefit calculation.
3. **Grid downtime**: Computed from `alert_time` and `end_time` (9–16 local window, 0.5 × hours × capacity_kw). Analytics then aggregates GRID_DOWN alerts by plant and day.
4. **Solarman**: POST, body with `alertQueryName`, `timeZone`, pagination by `page`/`size`, sort by `alertTime`.
5. **SolarDM**: GET, query params `current`, `size`, `faultInfo=...`; we paginate and optionally filter by date in code.
6. **ShineMonitor**: GET with sign/salt/token; action from doc = `queryPlantWarning`; other params (plantid, date range, page, etc.) to be determined and optimized for minimal calls and correct mapping to our `alerts` and plant-level grid downtime.

Use this document as the full context when analyzing ShineMonitor’s alert API and designing/optimizing the curl (params and request shape).

---

## 10. Code references (files and functions)

| What | Location |
|------|----------|
| Grid down hours in 9–16 window | `lib/services/alertSyncService.ts`: `calculateGridDownHoursWithinWindow` (lines ~197–230) |
| Grid down benefit kWh formula | `lib/services/alertSyncService.ts`: `calculateGridDownBenefitKwh` (lines ~233–250) |
| Solarman alert sync (plant map, POST, body, pagination) | `lib/services/alertSyncService.ts`: `syncSolarmanVendorAlerts` (~line 300+) |
| SolarDM alert sync (plant map, getAllAlerts, filter) | `lib/services/alertSyncService.ts`: `syncSolarDmVendorAlerts` (~line 760+) |
| Vendor lookback date | `lib/services/alertSyncService.ts`: `getVendorAlertsStartDate` (lines ~43–66) |
| Alerts table schema | `supabase/migrations/000_fresh_install.sql`, `001_alert_schema.sql`; indexes `046_add_grid_downtime_indexes.sql`, `048_add_alerts_unique_constraint.sql` |
| Grid downtime analytics (batch alerts, per-plant daily/total) | `lib/services/gridDowntimeAnalyticsService.ts`: `runGridDowntimeAnalytics`, `processPlant`, `computeDailySecondsForAlert` |
| Analytics table and cleanup | `supabase/migrations/045_add_analytics_grid_downtime.sql`; baseline RPC `047_add_grid_downtime_baseline_function.sql` |
| Solarman PRO alert URL/body | `lib/services/alertSyncService.ts` (search for `maintain-s/operating/station/alert`) |
| SolarDM getAllAlerts URL/params | `lib/vendors/solarDmAdapter.ts`: `getAllAlerts` (~line 1211); URL `.../dms/inverter_fault/page_list/all`, params `current`, `size`, `faultInfo` |
| ShineMonitor auth/sign and existing GET pattern | `lib/vendors/shineMonitorAdapter.ts` (e.g. `getDailyTelemetryRecords`, `generateSignForApi`, query param order) |
| ShineMonitor doc (action=queryPlantWarning) | `context/VENDOR_MARKDOWN.md` (Alerts row) |
