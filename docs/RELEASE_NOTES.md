## Release Notes

This document summarizes major functional changes. Earlier work is documented in the existing system docs (e.g. `WOMS_COMPLETE_SYSTEM_PROMPT.md`, `TELEMETRY_SYSTEM.md`, `VENDOR_ONBOARDING.md`); this file aggregates those themes and appends the latest changes.

---

### Previous Work (High‑Level Summary)

- **Alert Synchronization**
  - Implemented vendor‑level alert sync starting with **Solarman**:
    - Station‑level alerts via Solarman PRO API, filtered to **“No Mains Voltage”** on **INVERTER** devices.
    - Proper pagination (`size=100`), 1‑year (or vendor‑configured `alertsStartDate`) lookback.
    - Mapped to the unified `alerts` table, including:
      - `vendor_alert_id`, `vendor_plant_id`, `plant_id`, severity, status, `alert_time`, `end_time`.
      - `grid_down_seconds` and `grid_down_benefit_kwh` using the 9:00–16:00 window and installed capacity.
  - Added **SolarDM** alert sync with similar behavior:
    - Faults filtered to “There is no mains voltage”.
    - Date parsing for `"YYYY-MM-DD HH:mm:ss"` timestamps and severity from `faultLevel`.
    - Fully wired into `syncAllAlerts` and per‑vendor `syncAlertsForVendor`.

- **Alerts UI**
  - `/alerts` overview by organization and vendor, with:
    - Vendor cards, last alert sync time, and navigation to vendor plants and plant alerts.
  - `/alerts/vendor/[vendorId]` – vendor plants with alert counts.
  - `/alerts/vendor/[vendorId]/plant/[plantId]` – month‑by‑month plant alerts with grid‑down metrics.
  - Role‑based visibility:
    - GOVT/ORG users can drill into alerts where allowed.
    - Vendor type hidden on alerts pages for ORG/GOVT users; shown only to SUPERADMIN.

- **Telemetry and Plant Dashboard**
  - Solarman telemetry integrated for **day / month / year / total**:
    - Day view: 5‑minute power profile.
    - Month view: daily production.
    - Year view: monthly production.
    - Total view: year‑on‑year production using `stats/total`.
  - Telemetry API standardized at `/api/plants/[id]/telemetry`, always using `vendor_plant_id` to call vendor APIs.
  - Plant dashboard graphs updated to Solarman‑style area charts, with on‑demand loading and loaders/animations.
  - Robust null‑handling to avoid UI crashes when vendor data is sparse or missing.

- **Vendor Onboarding & Integrations**
  - **SolarDM**:
    - Auth via `email_login`, token caching, and plant listing (`/dms/plant/list_all`).
    - Telemetry and alert mapping documented in `VENDOR_ONBOARDING.md`.
  - **PVBlink**:
    - Auth with email/password, token persistence, and retry logic.
    - Plant listing with pagination and network status mapping.
    - Telemetry for day / month / year / total wired into plant dashboard and telemetry API.
  - **Foxesscloud (PV Hub)**:
    - Auth with `username` + `passwordMD5`, token caching, retry logic.
    - Adapter registered and documented for future plant/telemetry/alert work.
  - **ShineMonitor**:
    - Auth/signature flow implemented; adapter scaffolded for future plant/telemetry/alert support.

- **RBAC and GOVT/ORG Flows**
  - GOVT and ORG roles with:
    - Read‑only or scoped access to organizations, plants, and work orders.
    - Dashboard cards showing aggregated metrics at **work‑order** level for GOVT/ORG.
  - Vendors visible to GOVT as read‑only (no add/edit/delete/sync).
  - `/orgs` route shared by SUPERADMIN and GOVT, with:
    - “View Work Orders” per organization.
    - Hidden “Account” column for GOVT.

- **Branding & UX**
  - Display name and logo support for SUPERADMIN, GOVT, and ORG accounts.
  - Sidebar logo + “Powered by [Super Admin display name]”.
  - Dark‑mode friendly UI across dashboard, work orders, alerts, and vendor/organization screens.

The above items are fully wired and reflected in the existing documentation set.

---

### Current Release – Vendor Plant Sync Strategy & Configuration

**Goal:** Allow per‑vendor control over whether the periodic sync uses **plant lists** or **individual plant telemetry**, and when **listPlants()** should run for per‑plant vendors.

#### Backend Changes

- **New vendor fields** (migration `021_add_vendor_plant_sync_config.sql`):
  - `plant_sync_mode TEXT NOT NULL DEFAULT 'LIST_PLANTS'`
    - `LIST_PLANTS` – sync via `listPlants()` at the existing org‑level interval.
    - `PER_PLANT` – metrics will be taken from per‑plant telemetry; `listPlants()` is only run at configured times.
  - `plant_list_sync_morning_ist TIME NOT NULL DEFAULT '06:00'`
    - Morning IST time when `listPlants()` should run for `PER_PLANT` vendors.
  - `plant_list_sync_evening_ist TIME NOT NULL DEFAULT '23:00'`
    - Evening IST time when `listPlants()` should run for `PER_PLANT` vendors.

- **VendorConfig updates** (`lib/vendors/types.ts`):
  - Added:
    - `plantSyncMode?: 'LIST_PLANTS' | 'PER_PLANT'`
    - `plantListSyncMorningIst?: string`
    - `plantListSyncEveningIst?: string`

- **Vendor API wiring**:
  - `/api/vendors` (POST) and `/api/vendors/[id]` (PUT) accept and persist the new fields.
  - `/api/vendors` (GET) already returns all columns, so the UI receives the sync mode and times.

- **Plant sync service behavior** (`lib/services/plantSyncService.ts`):
  - New helper `getPlantSyncMode(vendor)`:
    - Uses stored `vendor.plant_sync_mode` when set.
    - Defaults:
      - `SOLARMAN`, `SHINEMONITOR` → `LIST_PLANTS`.
      - `SOLARDM`, `PVBLINK` → `PER_PLANT`.
      - `FOXESSCLOUD`, `OTHER` → `LIST_PLANTS`.
  - In `syncVendorPlants`:
    - For `LIST_PLANTS` vendors:
      - Behavior is unchanged: 15‑minute (or configured) cron calls `listPlants()` and syncs plants + metrics.
    - For `PER_PLANT` vendors:
      - The existing `syncAllPlants` run **skips `listPlants()`** for that vendor and logs that the vendor is configured for individual‑plant sync.
      - Topology and metrics for those vendors are expected to be driven by per‑plant telemetry and twice‑daily `listPlants()` calls at the configured morning/evening times.

#### UI Changes – Vendor Configuration

- **Vendor type definition** (`components/VendorsTable.tsx`):
  - `Vendor` now includes:
    - `plant_sync_mode?: 'LIST_PLANTS' | 'PER_PLANT'`
    - `plant_list_sync_morning_ist?: string | null`
    - `plant_list_sync_evening_ist?: string | null`

- **Form data defaults**:
  - For new vendors:
    - `plant_sync_mode = "LIST_PLANTS"`
    - `plant_list_sync_morning_ist = "06:00"`
    - `plant_list_sync_evening_ist = "23:00"`
  - When editing existing vendors:
    - If fields are present, they are loaded.
    - If not, defaults are derived from `vendor_type`:
      - Solarman / ShineMonitor → `LIST_PLANTS`.
      - SolarDM / PVBlink → `PER_PLANT`.

- **“Plant Sync Strategy” section in vendor dialog**:
  - **Mode selection**:
    - Button: “Sync via plant list (listPlants)” → `plant_sync_mode = "LIST_PLANTS"`.
    - Button: “Sync via individual plants” → `plant_sync_mode = "PER_PLANT"`.
  - **Timing configuration** (with sensible defaults and inline helper text):
    - Morning `listPlants()` time (default 06:00 IST).
    - Evening `listPlants()` time (default 23:00 IST).
  - Copy explicitly explains:
    - Solarman / ShineMonitor are typically list‑based.
    - SolarDM / PVBlink are typically individual‑plant based.
    - **SUPERADMIN** can override these defaults per vendor.

These changes make the cron behavior **explicitly vendor‑driven**: the existing organization sync interval remains the cadence, while each vendor’s configuration controls whether the sync uses **plant list** or **individual plant telemetry**, and when **listPlants()** is invoked for vendors that rely on per‑plant metrics.


