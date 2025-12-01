## Plant Sync Strategy and Vendor Capability Matrix

This document summarizes the current capabilities of each vendor adapter (using **Solarman** as the reference standard) and defines the strategy for **plant sync scheduling** (15‑minute vs twice‑daily), based on how and where production metrics are exposed.

---

## 1. Vendor Capability Matrix (Solarman as Standard)

### 1.1 High‑Level Matrix

| Capability                                              | SOLARMAN | SOLARDM | SHINEMONITOR | PVBLINK | FOXESSCLOUD |
|---------------------------------------------------------|:--------:|:-------:|:------------:|:-------:|:-----------:|
| Auth + token caching                                    |   ✅     |   ✅    |      ✅      |   ✅    |     ✅      |
| `listPlants()` implemented                              |   ✅     |   ✅    |      ❌      |   ✅    |     ❌      |
| Plants persisted via `plantSyncService`                 |   ✅     |   ✅    |      ❌      |   ✅    |     ❌      |
| Dashboard production metrics from `listPlants`          |   ✅     |   ✅    |      ❌      |   ✅    |     ❌      |
| Telemetry: Daily                                        |   ✅     |   ✅    |      ❌      |   ✅    |     ❌      |
| Telemetry: Monthly                                      |   ✅     |   ✅    |      ❌      |   ✅    |     ❌      |
| Telemetry: Yearly                                       |   ✅     |   ✅    |      ❌      |   ✅    |     ❌      |
| Telemetry: Total                                        |   ✅     |   ✅    |      ❌      |   ✅    |     ❌      |
| Telemetry wired to `/api/plants/[id]/telemetry`         |   ✅     |   ✅    |      ❌      |   ✅    |     ❌      |
| Alert sync (No‑mains‑voltage rule)                      |   ✅     |   ✅    |      ❌      |   ❌    |     ❌      |
| Alert cron (`syncAllAlerts`, per‑vendor sync)           |   ✅     |   ✅    |      ❌      |   ❌    |     ❌      |
| Alert mapping to `alerts` (severity / status / grid)    |   ✅     |   ✅    |      ❌      |   ❌    |     ❌      |
| Vendor onboarding docs up‑to‑date                       |   ✅     |   ✅    |      ❌      |   ⚠️    |     ⚠️      |

---

### 1.2 Per‑Vendor Notes

#### Solarman (`SOLARMAN`) – Reference Standard

- **Implemented**
  - Robust auth + token management with DB caching and expiry (`solarmanAdapter.ts`).
  - `listPlants()` via PRO API with full production metrics and location.
  - Plant sync via `plantSyncService.ts` (unit conversions, timestamps, network status, etc.).
  - Telemetry (day / month / year / total) wired into `/api/plants/[id]/telemetry` and plant dashboard UI.
  - Alert sync (`syncSolarmanVendorAlerts`) with:
    - Pagination (`size = 100`), `deviceType === "INVERTER"` filter, 1‑year / `alertsStartDate` lookback.
    - Mapping into `alerts` table with `vendor_alert_id`, `vendor_plant_id`, severity, status.
    - `grid_down_seconds` and `grid_down_benefit_kwh` (9–16h window, capacity‑aware).
  - Included in `syncAllAlerts` and manual `syncAlertsForVendor`.
  - Fully documented in `docs/VENDOR_ONBOARDING.md`.

#### SolarDM (`SOLARDM`)

- **At/near parity with Solarman**
  - Auth + token storage implemented in `solarDmAdapter.ts`.
  - `listPlants()` implemented and wired through `plantSyncService.ts` to `plants`.
  - Telemetry: day / month / year / total implemented in adapter and exposed via `/api/plants/[id]/telemetry`.
  - Alert sync (`syncSolarDmVendorAlerts`) with pagination, date filtering, severity/status mapping, and grid‑down benefit.
  - Included in `syncAllAlerts` and `syncAlertsForVendor`.
  - Documented in `docs/VENDOR_ONBOARDING.md` (minor cleanup still pending).

#### ShineMonitor (`SHINEMONITOR`)

- **Present**
  - Auth/token scheme and adapter (`shineMonitorAdapter.ts`), using sign/salt + SHA1.
  - Adapter registered in `vendorManager.ts`.

- **Missing vs Solarman**
  - `listPlants()` not implemented/wired → no ShineMonitor plants in `plants` table.
  - No telemetry methods (day / month / year / total) wired into `/api/plants/[id]/telemetry`.
  - No alert sync or mapping in `alertSyncService.ts`.
  - Onboarding docs explicitly mark plant listing, telemetry, and alerts as TODO.

#### PVBlink (`PVBLINK`)

- **Present**
  - Auth + token caching with retry logic and 11h30m expiry (`pvBlinkAdapter.ts`).
  - `listPlants()` implemented with pagination; mapped into `plants` via `plantSyncService.ts`.
  - Telemetry:
    - `getDailyTelemetryRecords` (5‑minute power + stats).
    - `getMonthlyTelemetryRecords` (daily production).
    - `getYearlyTelemetryRecords` (monthly production).
    - `getTotalTelemetryRecords` (yearly production across years).
  - All wired into `/api/plants/[id]/telemetry` for day / month / year / total views.
  - Plant detail dashboard supports PVBlink for all periods.

- **Missing vs Solarman**
  - No alert syncing:
    - No PVBlink alert adapter or sync function in `alertSyncService.ts`.
    - `syncAllAlerts` / `syncAlertsForVendor` treat `PVBLINK` as unsupported.
  - `docs/VENDOR_ONBOARDING.md` PVBlink section is partially outdated (still mentions TODOs for features that now exist, and does not yet describe alerts as the main gap).

#### Foxesscloud / PV Hub (`FOXESSCLOUD`)

- **Present**
  - Auth + token caching with MD5 password and retry (`foxesscloudAdapter.ts`).
  - Token persisted via `result.token`, expiry ~23h30m.
  - Adapter registered in `vendorManager.ts` and type added via migration.

- **Missing vs Solarman**
  - `listPlants()` not implemented → no Foxesscloud plants in `plants` table.
  - No telemetry methods (day / month / year / total) and not wired into `/api/plants/[id]/telemetry`.
  - No alert sync implementation and not supported in `alertSyncService.ts`.
  - `docs/VENDOR_ONBOARDING.md` has auth notes only; plants, telemetry, alerts remain TODO.

---

## 2. Plant Sync Strategy (15‑Minute vs Twice‑Daily)

Plant sync runs on a **clock‑based interval** that is already configured at the **organization level** (`sync_interval_minutes`, typically a multiple of 15). The vendor configuration only decides **what** is synced at that interval and **when** vendor‑level `listPlants()` calls should happen.

### 2.1 Case A – Sync via Plant List (`LIST_PLANTS`)

**Vendors (by default):**
- Solarman  
- ShineMonitor  

**Behavior:**
- At each eligible cron tick (based on the existing org‑level sync interval):
  - The system calls the adapter’s `listPlants()` for that vendor.
  - Upserts plants into the `plants` table:
    - Topology: `vendor_plant_id`, name, capacity, location, network status, etc.
    - Metrics: current power and any daily / monthly / yearly / total energy values provided by the plant list API.
- No extra vendor‑level timing is required; the existing org sync cadence is reused as‑is.

### 2.2 Case B – Sync via Individual Plants (`PER_PLANT`)

**Vendors (by default):**
- SolarDM  
- PVBlink  

**Intent:**
- For these vendors, the **preferred source of day / month / year / total metrics is the per‑plant telemetry APIs**, not `listPlants()`.

**Behavior at the main cron interval:**
- At each eligible cron tick (same org‑level interval as above):
  - The plant‑sync logic checks `plant_sync_mode` for each vendor:
    - If `LIST_PLANTS` → behaves as in 2.1.
    - If `PER_PLANT` → the list‑based sync is skipped for that vendor; the interval is reserved for per‑plant telemetry‑driven sync (to be wired in the cron that reads telemetry).

**Twice‑daily `listPlants()` for PER_PLANT vendors:**
- To keep plant topology up‑to‑date without calling `listPlants()` every 15 minutes:
  - Each vendor stores:
    - `plant_list_sync_morning_ist` (default **06:00 IST**).
    - `plant_list_sync_evening_ist` (default **23:00 IST**).
  - Around those times, a vendor‑level sync will call `listPlants()` for **PER_PLANT** vendors only, to refresh:
    - New / removed plants.
    - Updated names, capacities, and basic topology.

This division lets list‑driven vendors (Solarman / ShineMonitor) rely entirely on `listPlants()` at the configured interval, while vendors that depend on per‑plant telemetry (SolarDM / PVBlink) can:
- Use the same interval for telemetry‑based plant metrics.
- Refresh full plant lists only twice per day, at configurable times.

---

## 3. Configuration Model (Current)

The split behavior is driven purely by **vendor configuration**, on top of the existing **organization sync settings**:

- **Organization level (already existing)**
  - `auto_sync_enabled` – whether the org participates in the periodic sync.
  - `sync_interval_minutes` – the base interval (usually a multiple of 15) used by the cron.

- **Vendor level (new fields on `vendors`)**
  - `plant_sync_mode` (`LIST_PLANTS` \| `PER_PLANT`)
    - `LIST_PLANTS` → Cron syncs via `listPlants()` at the configured interval.
    - `PER_PLANT` → Cron leaves list‑based sync to the twice‑daily windows; per‑plant telemetry is responsible for metrics.
  - `plant_list_sync_morning_ist` (TIME, default `06:00`)
    - Morning time in IST when `listPlants()` should run for **PER_PLANT** vendors.
  - `plant_list_sync_evening_ist` (TIME, default `23:00`)
    - Evening time in IST when `listPlants()` should run for **PER_PLANT** vendors.

The **Vendors configuration UI** exposes these as:

- A **“Plant Sync Strategy”** section with:
  - Mode toggle:
    - “Sync via plant list (listPlants)” → `LIST_PLANTS`.
    - “Sync via individual plants” → `PER_PLANT`.
  - Morning and evening `listPlants()` times with sensible defaults that the **SUPERADMIN** can override.

The backend uses these flags when running the 15‑minute (or configured) sync to decide:

- Whether to call `listPlants()` directly for a vendor (LIST_PLANTS), or
- To rely on per‑plant telemetry plus the configured twice‑daily `listPlants()` calls (PER_PLANT).

---

## 4. Intent for Future Work

- Use this document as the **design reference** when:
  - Finalizing how `syncAllPlants` branches per vendor.
  - Implementing the twice‑daily heavy metrics cron.
  - Bringing ShineMonitor and Foxesscloud up to Solarman/SolarDM parity.
  - Updating `docs/VENDOR_ONBOARDING.md` to match reality for PVBlink and future vendors.

The next concrete step is to introduce a small `VendorSyncMode`/`metricsInListPlants` flag into the `vendors` configuration and wire the branching logic into `plantSyncService.ts` and the cron scheduling layer.


