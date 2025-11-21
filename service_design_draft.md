# WOMS - Service Design & Low-Level Design (LLD) Draft

## 1. Service Overview

**WOMS (Work Order Management System)** is a comprehensive platform designed for solar energy monitoring, work order management, and multi-vendor integration. It serves as a unified dashboard for different stakeholders (Super Admins, Government Agencies, and Organizations) to monitor solar plant performance, manage maintenance work orders, and track alerts.

### Key Capabilities
*   **Unified Monitoring**: Role-based dashboards for real-time monitoring.
*   **Multi-Vendor Integration**: Agnostic adapter system to connect with various solar inverter vendors (e.g., Solarman, Sungrow).
*   **Real-Time Telemetry**: Tracking of power generation, voltage, current, etc., with 24-hour retention for high-frequency data.
*   **Work Order Management**: Static work order system linking plants to maintenance tasks.
*   **Alert Management**: Synchronization of alerts from vendor APIs.
*   **Efficiency Analytics**: Calculation of Performance Ratio (PR) and efficiency metrics.

---

## 2. Low-Level Design (LLD)

### 2.1 System Architecture

The system follows a modern web application architecture:

*   **Frontend**: Next.js 14 (App Router) with TypeScript, TailwindCSS, and shadcn/ui.
*   **Backend API**: Next.js API Routes for handling client requests.
*   **Database**: Supabase (PostgreSQL) for relational data and a separate instance/schema for high-volume telemetry.
*   **Edge Functions**: Deno-based functions for background tasks (syncing telemetry, alerts, computing efficiency).

### 2.2 Data Flow

1.  **Telemetry Synchronization**:
    *   **Trigger**: Scheduled cron job (Edge Function).
    *   **Process**: `sync-telemetry` function calls the appropriate Vendor Adapter -> Fetches data from Vendor API -> Normalizes data -> Inserts into `telemetry_readings` table.
    *   **Retention**: Old data (>24h) is automatically purged.

2.  **Alert Synchronization**:
    *   **Trigger**: Scheduled cron job.
    *   **Process**: `sync-alerts` function fetches active alerts from Vendor API -> Updates `alerts` table in the Main DB.

3.  **User Interaction**:
    *   **Request**: User accesses Dashboard -> Next.js Frontend calls `/api/dashboard`.
    *   **Processing**: API validates session -> Queries `accounts` table for role -> Fetches aggregated data from `plants`, `alerts`, and `work_orders` tables -> Returns JSON.

4.  **Authentication Flow (Custom)**:
    *   **Login**: POST `/api/login` with email/password.
    *   **Verification**: Backend hashes password (bcrypt) and compares with `accounts` table.
    *   **Session**: On success, a JWT-like session token is generated and set as an HTTP-only cookie.
    *   **Middleware**: `middleware.ts` validates the cookie on protected routes.

### 2.3 Vendor Adapter Pattern

To support multiple vendors without changing core logic, the system uses the **Strategy Pattern**:

*   **`BaseVendorAdapter` (Abstract Class)**: Defines the contract (`authenticate`, `listPlants`, `getTelemetry`, `getAlerts`).
*   **`SolarmanAdapter` (Concrete Class)**: Implements the contract for Solarman API.
*   **`VendorManager` (Factory)**: Returns the correct adapter instance based on the vendor type configuration.

---

## 3. Component Architecture

### 3.1 Frontend Components (`/components`)

*   **Layout & Navigation**:
    *   `DashboardSidebar`: Role-aware sidebar navigation.
    *   `ThemeToggle`: Dark/light mode switcher.
*   **Visualization**:
    *   `TelemetryChart`: Recharts-based component for visualizing power/energy data.
    *   `ProductionOverview`: Dashboard for plant production metrics.
    *   `DashboardMetrics`: Summary cards for key statistics.
*   **Management**:
    *   `VendorsTable`: Interface for managing vendor integrations and triggering syncs.
    *   `AlertsFeed`: Real-time list of system alerts.
    *   `PlantSelector`: Dropdown for filtering data by plant.

### 3.2 Backend Modules (`/lib`, `/app/api`)

*   **Vendor System** (`/lib/vendors`):
    *   `baseVendorAdapter.ts`: Interface definition.
    *   `solarmanAdapter.ts`: Implementation for Solarman.
    *   `vendorManager.ts`: Factory for adapter instantiation.
*   **API Routes** (`/app/api`):
    *   `/auth`: Login and session management.
    *   `/dashboard`: Aggregated data for the dashboard view.
    *   `/telemetry`: Endpoints for fetching time-series data.
    *   `/vendors`: CRUD operations for vendor configurations.

---

## 4. Database Schema

The database is designed with separation of concerns: metadata/business logic in the Main DB and high-volume time-series data in the Telemetry DB.

### 4.1 Main Database Tables

| Table Name | Description | Key Columns |
| :--- | :--- | :--- |
| **`accounts`** | User accounts & auth | `id`, `email`, `password_hash`, `account_type` (SUPERADMIN, ORG, GOVT), `org_id` |
| **`organizations`** | Tenant organizations | `id`, `name`, `auto_sync_enabled` |
| **`vendors`** | Vendor API configs | `id`, `name`, `vendor_type`, `credentials` (JSON), `org_id` |
| **`plants`** | Solar plants & metrics | `id`, `name`, `capacity_kw`, `current_power_kw`, `daily_energy_mwh`, `vendor_id`, `org_id` |
| **`work_orders`** | Maintenance tasks | `id`, `title`, `description`, `priority`, `created_by` |
| **`work_order_plants`** | Plant-WO mapping | `id`, `work_order_id`, `plant_id`, `is_active` |
| **`alerts`** | System alerts | `id`, `plant_id`, `title`, `severity`, `status` (ACTIVE, RESOLVED) |
| **`work_order_plant_eff`** | Efficiency snapshots | `id`, `work_order_id`, `plant_id`, `efficiency_pct`, `pr` |

### 4.2 Telemetry Database Tables

| Table Name | Description | Key Columns |
| :--- | :--- | :--- |
| **`telemetry_readings`** | High-frequency data | `id`, `plant_id`, `ts` (timestamp), `generation_power_kw`, `voltage`, `current`, `temperature` |

### 4.3 Key Relationships & Constraints

*   **Org-Vendor-Plant**: An Organization has multiple Vendors; a Vendor has multiple Plants.
*   **Work Orders**: A Plant can only be assigned to **one active** Work Order at a time (enforced by unique constraint).
*   **Security**: Row-Level Security (RLS) policies ensure Organizations can only see their own data.
