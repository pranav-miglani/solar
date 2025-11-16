# WOMS - Unified Solar Monitoring & Work Order System

A complete, production-ready Work Order Management System (WOMS) designed for solar energy monitoring, work order management, and multi-vendor integration. The system provides a unified dashboard that adapts to different user roles, real-time telemetry tracking, alert management, and comprehensive efficiency analytics.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Account Types & Permissions](#account-types--permissions)
- [Vendor Adapter System](#vendor-adapter-system)
- [API Documentation](#api-documentation)
- [Edge Functions](#edge-functions)
- [Setup & Installation](#setup--installation)
- [Configuration](#configuration)
- [Development Guide](#development-guide)
- [Deployment](#deployment)
- [Security Considerations](#security-considerations)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Overview

WOMS is a comprehensive platform that enables:

- **Unified Monitoring**: Single dashboard interface for all user roles with role-specific data views
- **Multi-Vendor Integration**: Pluggable adapter system supporting multiple solar inverter vendors
- **Real-Time Telemetry**: 24-hour telemetry tracking with automatic data retention management
- **Work Order Management**: Static work order system for plant maintenance and operations
- **Alert Management**: Real-time alert synchronization from vendor APIs
- **Efficiency Analytics**: Performance ratio and efficiency calculations for work orders

### Key Design Principles

1. **Role-Based Access Control**: Three distinct account types (SUPERADMIN, GOVT, ORG) with granular permissions
2. **Separation of Concerns**: Main database for metadata, separate telemetry database for time-series data
3. **Extensibility**: Vendor adapter pattern allows adding new vendors without core code changes
4. **Performance**: 24-hour telemetry retention keeps database size manageable
5. **Security**: Row-Level Security (RLS) policies enforce data access at the database level

## Features

### Core Features

#### 1. Unified Dashboard
- **Role-Adaptive Interface**: Dashboard content automatically adjusts based on user role
  - **Super Admin**: Full system controls, management panels, global metrics
  - **Government**: Read-only global view with export capabilities
  - **Organization**: Read-only view limited to own organization's data
- **Real-Time Metrics**: Live system statistics (plants, alerts, work orders, generation)
- **Interactive Charts**: Animated telemetry charts using Recharts
- **Alerts Feed**: Real-time alert notifications with severity indicators
- **Work Order Summary**: Quick access to work orders with filtering

#### 2. Multi-Vendor Integration
- **Pluggable Architecture**: Add new vendors by implementing adapter interface
- **Vendor-Organization Mapping**: Multiple vendors per organization (same or different types)
- **Plant Synchronization**: One-click sync to fetch all plants from vendor APIs
- **Progress Tracking**: Real-time progress indicators during plant sync operations
- **Token Caching**: Automatic token management and refresh
- **Data Normalization**: Vendor-specific data converted to standard format
- **Error Handling**: Robust error handling and retry logic

#### 3. Telemetry Management
- **24-Hour Window**: Automatic data retention (24 hours)
- **Multiple Aggregation Levels**: Plant, Work Order, Organization, and Global views
- **Real-Time Updates**: Edge Functions sync data from vendor APIs
- **Efficient Storage**: Separate database instance for time-series data

#### 4. Work Order System
- **Static Work Orders**: No status lifecycle - work orders are static records
- **Plant Mapping**: Work orders map directly to plants (one active WO per plant)
- **Efficiency Tracking**: Automatic efficiency calculations for work order plants
- **Super Admin Control**: Only Super Admins can create work orders

#### 5. Alert System
- **Vendor Sync**: Automatic alert synchronization from vendor APIs
- **Severity Levels**: LOW, MEDIUM, HIGH, CRITICAL
- **Status Tracking**: ACTIVE, RESOLVED, ACKNOWLEDGED
- **Role-Scoped Views**: Alerts filtered by user role

#### 6. Production Metrics & Overview
- **Production Dashboard**: Comprehensive production overview with key metrics
- **Real-Time Metrics**: Current power, installed capacity, energy generation (daily/monthly/yearly/total)
- **Performance Ratio (PR)**: Visual circular indicator showing plant efficiency
- **Multi-Level Aggregation**: Metrics aggregated at plant, vendor, and work order levels
- **Automatic Sync**: Production metrics updated during plant synchronization
- **Last Update Tracking**: Timestamp showing when data was last synced from vendor

#### 7. Modern UI/UX
- **Modern Design System**: shadcn/ui components (Radix UI primitives) with TailwindCSS
- **Material-Like Design**: Clean, modern interface with Material Design principles
- **Glassmorphism Effects**: Modern glass-effect styling with backdrop blur
- **Dark/Light Mode**: System-aware theme switching with next-themes
- **Responsive Layout**: Mobile-first responsive design
- **Smooth Animations**: Framer Motion animations for enhanced UX
- **Accessible Components**: WCAG-compliant components with full keyboard navigation

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Dashboard  │  │  Work Orders │  │   Alerts     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Routes (Next.js)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Auth    │  │Telemetry │  │  Alerts  │  │ WorkOrders│  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Main DB     │   │ Telemetry DB │   │ Edge Functions│
│ (Supabase)   │   │ (Supabase)   │   │   (Deno)     │
│              │   │              │   │              │
│ - accounts   │   │ - telemetry  │   │ - sync-      │
│ - orgs       │   │   _readings  │   │   telemetry  │
│ - vendors    │   │              │   │ - sync-alerts│
│ - plants     │   │              │   │ - compute-   │
│ - work_orders│   │              │   │   efficiency │
│ - alerts     │   │              │   │              │
└──────────────┘   └──────────────┘   └──────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                    ┌──────────────┐
                    │ Vendor APIs  │
                    │ (Solarman,   │
                    │  etc.)       │
                    └──────────────┘
```

### Data Flow

1. **Telemetry Sync**: Edge Function → Vendor API → Telemetry DB (24h retention)
2. **Alert Sync**: Edge Function → Vendor API → Main DB (alerts table)
3. **User Request**: Frontend → API Route → Main DB (with RLS enforcement)
4. **Efficiency Calculation**: API Trigger → Edge Function → Telemetry DB → Main DB

### Authentication Flow

```
User Login
    │
    ▼
POST /api/login
    │
    ▼
Query accounts table (custom, not Supabase Auth)
    │
    ▼
Verify credentials (bcrypt hash comparison)
    │
    ▼
Create session token (JWT-like)
    │
    ▼
Set HTTP-only cookie
    │
    ▼
Redirect to /dashboard
```

**Important**: This application uses a **custom authentication system** with the `accounts` table. It does NOT use Supabase Auth (`auth.users`). User accounts must be created directly in the `accounts` table via the Supabase SQL console. See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for instructions.

## Tech Stack

### Frontend
- **Next.js 14**: App Router for server-side rendering and API routes
- **TypeScript**: Type-safe development
- **TailwindCSS**: Utility-first CSS framework
- **shadcn/ui**: Modern component library (Radix UI primitives) with Material-like design
- **Recharts**: Chart library for data visualization
- **Framer Motion**: Animation library
- **next-themes**: Theme management (dark/light mode)
- **react-hook-form + zod**: Form validation
- **Lucide React**: Modern icon library

### Backend
- **Supabase**: PostgreSQL database with Row-Level Security
- **Deno**: Runtime for Edge Functions
- **Password Storage**: Bcrypt hashed (passwords are hashed before storage, users input plain text)
- **Custom JWT**: Session management

### Development Tools
- **ESLint**: Code linting
- **TypeScript**: Type checking
- **PostCSS**: CSS processing

## Project Structure

```
woms/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── login/                # Authentication
│   │   ├── me/                   # Current user
│   │   ├── dashboard/            # Dashboard data
│   │   ├── telemetry/            # Telemetry endpoints
│   │   │   ├── plant/[id]/       # Plant telemetry
│   │   │   ├── workorder/[id]/   # Work order telemetry
│   │   │   ├── org/[id]/         # Organization telemetry
│   │   │   └── global/           # Global telemetry (Govt)
│   │   ├── vendors/              # Vendor management
│   │   │   ├── [id]/
│   │   │   │   ├── sync-plants/  # Plant synchronization
│   │   │   │   └── production/   # Vendor production metrics
│   │   │   └── route.ts
│   │   ├── plants/
│   │   │   └── [id]/
│   │   │       └── production/   # Plant production metrics
│   │   ├── alerts/               # Alerts endpoint
│   │   ├── workorders/           # Work order CRUD
│   │   │   └── [id]/
│   │   │       └── production/   # Work order production metrics
│   │   ├── orgs/                 # Organization management
│   ├── auth/
│   │   └── login/                # Login page
│   ├── dashboard/                 # Unified dashboard
│   ├── workorders/                # Work order pages
│   ├── superadmin/                # Super admin pages
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Home page (redirects)
│   └── globals.css                # Global styles
│
├── components/                    # React components
│   ├── ui/                        # shadcn/ui components (Radix UI)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── progress.tsx
│   │   └── ...
│   ├── DashboardSidebar.tsx      # Navigation sidebar
│   ├── DashboardMetrics.tsx      # Metrics cards
│   ├── TelemetryChart.tsx        # Telemetry visualization
│   ├── AlertsFeed.tsx            # Alerts display
│   ├── ProductionOverview.tsx    # Production metrics dashboard
│   ├── VendorsTable.tsx          # Vendor management with sync
│   ├── PlantSelector.tsx         # Plant selection component
│   ├── ThemeToggle.tsx            # Dark/light mode toggle
│   └── ...
│
├── lib/                           # Utility libraries
│   ├── vendors/                   # Vendor adapter system
│   │   ├── baseVendorAdapter.ts   # Abstract base class
│   │   ├── solarmanAdapter.ts    # Solarman implementation
│   │   ├── vendorManager.ts      # Factory pattern
│   │   └── types.ts              # Type definitions
│   ├── rbac.ts                    # Role-based access control
│   ├── supabase/
│   │   ├── client.ts            # Browser Supabase client
│   │   └── server.ts             # Server Supabase client
│   └── utils.ts                   # Utility functions
│
├── supabase/
│   ├── functions/                 # Edge Functions (Deno)
│   │   ├── vendor-auth/          # Vendor authentication
│   │   ├── sync-telemetry/       # Telemetry synchronization
│   │   ├── sync-alerts/          # Alert synchronization
│   │   └── compute-efficiency/   # Efficiency calculation
│   └── migrations/               # Database migrations
│       ├── 001_initial_schema.sql  # Complete schema (includes org_id in vendors, production metrics)
│       ├── 002_rls_policies.sql
│       ├── 003_telemetry_db_schema.sql
│       ├── 004_manual_user_setup.sql
│       ├── 006_add_org_id_to_vendors.sql  # Obsolete (merged into 001)
│       └── 007_add_plant_production_metrics.sql  # Obsolete (merged into 001)
│
├── scripts/
│   └── seed.ts                    # Database seeding script (⚠️ Not recommended for user creation - use Supabase console instead)
│
├── types/
│   └── database.ts                # Database type definitions
│
├── middleware.ts                  # Route protection
├── tailwind.config.ts             # Tailwind configuration
├── tsconfig.json                  # TypeScript configuration
└── package.json                   # Dependencies
```

## Database Schema

### Main Database Tables

#### `accounts`
User accounts with role-based access.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `account_type` | ENUM | SUPERADMIN, ORG, or GOVT |
| `email` | TEXT | Unique email address |
| `password_hash` | TEXT | Password (bcrypt hash - passwords are hashed before storage) |
| `org_id` | INTEGER | Foreign key to organizations (NULL for SUPERADMIN/GOVT) |
| `created_at` | TIMESTAMPTZ | Account creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Constraints**:
- ORG accounts must have `org_id` set
- SUPERADMIN and GOVT must have `org_id` as NULL

#### `organizations`
Organizations that own solar plants.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `name` | TEXT | Organization name |
| `meta` | JSONB | Additional metadata |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

#### `vendors`
Vendor configurations for API integrations. Vendors are mapped to organizations (one org can have multiple vendors).

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `name` | TEXT | Vendor name |
| `vendor_type` | ENUM | SOLARMAN, SUNGROW, OTHER |
| `api_base_url` | TEXT | Vendor API base URL |
| `credentials` | JSONB | Encrypted API credentials |
| `org_id` | INTEGER | Foreign key to organizations (nullable, for vendor-org mapping) |
| `is_active` | BOOLEAN | Active status |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

#### `plants`
Solar power plants with production metrics from vendor APIs.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `org_id` | INTEGER | Foreign key to organizations |
| `vendor_id` | INTEGER | Foreign key to vendors |
| `vendor_plant_id` | TEXT | Vendor-specific plant identifier |
| `name` | TEXT | Plant name |
| `capacity_kw` | NUMERIC(10,2) | Installed capacity in kilowatts (kWp) |
| `location` | JSONB | Location data (lat, lng, address) |
| `current_power_kw` | NUMERIC(10,3) | Current generation power (kW) |
| `daily_energy_mwh` | NUMERIC(10,3) | Daily energy generation (MWh) |
| `monthly_energy_mwh` | NUMERIC(10,3) | Monthly energy generation (MWh) |
| `yearly_energy_mwh` | NUMERIC(10,3) | Yearly energy generation (MWh) |
| `total_energy_mwh` | NUMERIC(10,3) | Total cumulative energy (MWh) |
| `performance_ratio` | NUMERIC(5,4) | Performance Ratio (PR) - 0-1 range |
| `last_update_time` | TIMESTAMPTZ | Last time production data was synced |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

**Constraints**:
- Unique constraint on `(vendor_id, vendor_plant_id)`

**Production Metrics**:
- Metrics are fetched from vendor APIs during plant sync
- Displayed in Production Overview dashboard at plant, vendor, and work order levels
- Aggregated (sum/average) for vendor and work order views

#### `work_orders`
Work orders (static, no status).

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `title` | TEXT | Work order title |
| `description` | TEXT | Work order description |
| `priority` | ENUM | LOW, MEDIUM, HIGH |
| `created_by` | UUID | Foreign key to accounts |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

#### `work_order_plants`
Mapping between work orders and plants.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `work_order_id` | INTEGER | Foreign key to work_orders |
| `plant_id` | INTEGER | Foreign key to plants |
| `is_active` | BOOLEAN | Active status |
| `added_at` | TIMESTAMPTZ | Addition timestamp |

**Constraints**:
- Unique constraint on `plant_id` where `is_active = true` (one active WO per plant)

#### `alerts`
System alerts from vendor APIs.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `plant_id` | INTEGER | Foreign key to plants |
| `vendor_alert_id` | TEXT | Vendor-specific alert ID |
| `title` | TEXT | Alert title |
| `description` | TEXT | Alert description |
| `severity` | ENUM | LOW, MEDIUM, HIGH, CRITICAL |
| `status` | ENUM | ACTIVE, RESOLVED, ACKNOWLEDGED |
| `metadata` | JSONB | Additional alert data |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |
| `resolved_at` | TIMESTAMPTZ | Resolution timestamp (nullable) |

#### `work_order_plant_eff`
Efficiency metrics for work order plants.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `work_order_id` | INTEGER | Foreign key to work_orders |
| `plant_id` | INTEGER | Foreign key to plants |
| `recorded_at` | TIMESTAMPTZ | Recording timestamp |
| `actual_gen` | NUMERIC(10,2) | Actual generation (MWh) |
| `expected_gen` | NUMERIC(10,2) | Expected generation (MWh) |
| `pr` | NUMERIC(5,4) | Performance ratio |
| `efficiency_pct` | NUMERIC(5,2) | Efficiency percentage |
| `category` | TEXT | Category (Healthy, Suboptimal, Critical) |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### Telemetry Database (Separate Instance)

#### `telemetry_readings`
24-hour telemetry window.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `plant_id` | INTEGER | Plant ID (reference, not FK) |
| `org_id` | INTEGER | Organization ID (denormalized) |
| `work_order_id` | INTEGER | Work order ID (optional) |
| `ts` | TIMESTAMPTZ | Timestamp |
| `generation_power_kw` | NUMERIC(10,2) | Generation power |
| `voltage` | NUMERIC(10,2) | Voltage (optional) |
| `current` | NUMERIC(10,2) | Current (optional) |
| `temperature` | NUMERIC(5,2) | Temperature (optional) |
| `irradiance` | NUMERIC(8,2) | Irradiance (optional) |
| `efficiency_pct` | NUMERIC(5,2) | Efficiency (optional) |
| `metadata` | JSONB | Additional data |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

**Retention**: Data older than 24 hours is automatically deleted.

## Account Types & Permissions

### SUPERADMIN

**Capabilities**:
- Full system access
- Create/manage organizations, vendors, plants, work orders
- View all data globally
- Access to all management panels

**Permissions**:
```typescript
{
  accounts: ["read"],
  organizations: ["create", "read", "update", "delete"],
  vendors: ["create", "read", "update", "delete"],
  plants: ["create", "read", "update", "delete"],
  work_orders: ["create", "read", "update", "delete"],
  alerts: ["read", "update"],
  telemetry: ["read"],
  efficiency: ["read"]
}
```

**Dashboard Widgets**:
- System overview metrics
- Manage Organizations card
- Manage Vendors card
- Manage Plants card
- Create Work Order card
- Global telemetry chart
- All alerts feed
- Work orders summary

### GOVT (Government)

**Capabilities**:
- Read-only global access
- View all organizations, plants, work orders, alerts
- Export data to CSV
- Monitor system-wide telemetry

**Permissions**:
```typescript
{
  organizations: ["read"],
  vendors: ["read"],
  plants: ["read"],
  work_orders: ["read"],
  alerts: ["read"],
  telemetry: ["read"],
  efficiency: ["read"]
}
```

**Dashboard Widgets**:
- Global electricity generation (24h)
- All alerts across organizations
- Organization-wise breakdown cards
- Read-only work order list
- Export CSV button
- Global telemetry chart

### ORG (Organization)

**Capabilities**:
- Read-only access to own organization's data
- View own plants, work orders, alerts
- See efficiency summaries
- Monitor own telemetry

**Permissions**:
```typescript
{
  organizations: ["read"], // Own org only
  vendors: ["read"],
  plants: ["read"], // Own org plants only
  work_orders: ["read"], // Work orders with own org plants
  alerts: ["read"], // Own org alerts only
  telemetry: ["read"], // Own org telemetry only
  efficiency: ["read"] // Own org efficiency only
}
```

**Dashboard Widgets**:
- Own organization's plants
- Own organization's alerts
- Own work orders
- Organization telemetry (24h)
- Efficiency summary

## Vendor Adapter System

### Architecture

The vendor adapter system uses the **Strategy Pattern** with a **Factory Pattern** for dynamic adapter selection.

```
VendorManager (Factory)
    │
    ├── BaseVendorAdapter (Abstract)
    │       │
    │       ├── authenticate()
    │       ├── listPlants()
    │       ├── getTelemetry()
    │       ├── getRealtime()
    │       ├── getAlerts()
    │       ├── normalizeTelemetry()
    │       └── normalizeAlert()
    │
    └── SolarmanAdapter (Concrete)
            └── Implements all abstract methods
```

### BaseVendorAdapter Interface

All vendor adapters must implement:

```typescript
abstract class BaseVendorAdapter {
  // Authentication
  abstract authenticate(): Promise<string>
  
  // Plant Management
  abstract listPlants(): Promise<Plant[]>
  
  // Telemetry
  abstract getTelemetry(
    plantId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TelemetryData[]>
  
  abstract getRealtime(plantId: string): Promise<RealtimeData>
  
  // Alerts
  abstract getAlerts(plantId: string): Promise<Alert[]>
  
  // Data Normalization
  protected abstract normalizeTelemetry(rawData: any): TelemetryData
  protected abstract normalizeAlert(rawData: any): Alert
}
```

### Adding a New Vendor

**Step 1**: Create adapter class

```typescript
// lib/vendors/sungrowAdapter.ts
import { BaseVendorAdapter } from "./baseVendorAdapter"
import type { VendorConfig, Plant, TelemetryData, Alert, RealtimeData } from "./types"

export class SungrowAdapter extends BaseVendorAdapter {
  async authenticate(): Promise<string> {
    // Implement Sungrow authentication
    const credentials = this.getCredentials()
    // ... authentication logic
    return token
  }
  
  async listPlants(): Promise<Plant[]> {
    // Implement plant listing
  }
  
  async getTelemetry(
    plantId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TelemetryData[]> {
    // Implement telemetry fetching
  }
  
  async getRealtime(plantId: string): Promise<RealtimeData> {
    // Implement realtime data fetching
  }
  
  async getAlerts(plantId: string): Promise<Alert[]> {
    // Implement alert fetching
  }
  
  protected normalizeTelemetry(rawData: any): TelemetryData {
    // Convert Sungrow format to standard format
    return {
      plantId: rawData.station_id,
      timestamp: new Date(rawData.time),
      generationPowerKw: rawData.power,
      // ... other fields
    }
  }
  
  protected normalizeAlert(rawData: any): Alert {
    // Convert Sungrow alert format to standard format
    return {
      vendorAlertId: rawData.id,
      title: rawData.type,
      description: rawData.message,
      severity: this.mapSeverity(rawData.level),
      metadata: rawData
    }
  }
}
```

**Step 2**: Register adapter

```typescript
// lib/vendors/vendorManager.ts
import { SungrowAdapter } from "./sungrowAdapter"

// Register the adapter
VendorManager.registerAdapter("SUNGROW", SungrowAdapter)
```

**Step 3**: Use in Edge Functions

```typescript
// supabase/functions/sync-telemetry/index.ts
import { VendorManager } from "../../lib/vendors/vendorManager"

const adapter = VendorManager.getAdapter(vendorConfig)
const telemetry = await adapter.getTelemetry(plantId, startTime, endTime)
```

### Solarman Adapter

The Solarman adapter implements the full interface:

- **Authentication**: OAuth2-style token with caching
- **Plant Listing**: Fetches all stations from Solarman API
- **Telemetry**: Historical data with time range support
- **Realtime**: Current power and status
- **Alerts**: Alert fetching with severity mapping

## API Documentation

### Authentication

#### POST /api/login

Authenticate user and create session.

**Request Body**:
```json
{
  "email": "admin@woms.com",
  "password": "admin123"
}
```

**Response** (200 OK):
```json
{
  "account": {
    "id": "uuid",
    "email": "admin@woms.com",
    "accountType": "SUPERADMIN",
    "orgId": null
  }
}
```

**Response** (401 Unauthorized):
```json
{
  "error": "Invalid credentials"
}
```

**Cookies Set**:
- `session`: HTTP-only cookie with JWT-like token (7 days expiry)

#### GET /api/me

Get current authenticated user.

**Headers**:
- Cookie: `session=<token>`

**Response** (200 OK):
```json
{
  "account": {
    "id": "uuid",
    "email": "admin@woms.com",
    "accountType": "SUPERADMIN",
    "orgId": null
  }
}
```

### Dashboard

#### GET /api/dashboard

Get role-scoped dashboard data.

**Response** (200 OK):
```json
{
  "role": "SUPERADMIN",
  "metrics": {
    "totalPlants": 150,
    "totalAlerts": 23,
    "activeAlerts": 5,
    "totalWorkOrders": 12,
    "totalGeneration24h": 125000.5
  },
  "widgets": {
    "showOrganizations": true,
    "showVendors": true,
    "showPlants": true,
    "showCreateWorkOrder": true,
    "showTelemetryChart": true,
    "showAlertsFeed": true,
    "showWorkOrdersSummary": true
  }
}
```

### Telemetry

#### GET /api/telemetry/plant/:id?hours=24

Get telemetry for a specific plant.

**Parameters**:
- `id` (path): Plant ID
- `hours` (query, optional): Hours of data (default: 24)

**Response** (200 OK):
```json
{
  "plantId": 1,
  "data": [
    {
      "id": "uuid",
      "plant_id": 1,
      "ts": "2024-01-15T10:00:00Z",
      "generation_power_kw": 125.5,
      "voltage": 240.0,
      "current": 52.3,
      "temperature": 25.5
    }
  ],
  "period": "24h"
}
```

#### GET /api/telemetry/workorder/:id?hours=24

Get aggregated telemetry for all plants in a work order.

**Response** (200 OK):
```json
{
  "workOrderId": 1,
  "plants": [
    {
      "plantId": 1,
      "dataPoints": 24,
      "totalGenerationKw": 3000.5,
      "telemetry": [...]
    }
  ],
  "totalGenerationKw": 3000.5,
  "period": "24h"
}
```

#### GET /api/telemetry/org/:id?hours=24

Get telemetry for all plants in an organization.

**Response** (200 OK):
```json
{
  "orgId": 1,
  "data": [...],
  "totalGenerationKw": 50000.0,
  "plantCount": 10,
  "period": "24h"
}
```

#### GET /api/telemetry/global?hours=24

Get global telemetry (Government only).

**Response** (200 OK):
```json
{
  "data": [...],
  "totalGenerationKw": 500000.0,
  "orgBreakdown": [
    {
      "orgId": 1,
      "totalGenerationKw": 50000.0,
      "dataPoints": 240
    }
  ],
  "period": "24h"
}
```

### Alerts

#### GET /api/alerts

Get alerts (role-scoped).

**Response** (200 OK):
```json
{
  "alerts": [
    {
      "id": 1,
      "plant_id": 1,
      "title": "Inverter Fault",
      "description": "Inverter communication lost",
      "severity": "HIGH",
      "status": "ACTIVE",
      "created_at": "2024-01-15T10:00:00Z",
      "plants": {
        "id": 1,
        "name": "Solar Farm Alpha"
      }
    }
  ]
}
```

### Work Orders

#### GET /api/workorders

List work orders (role-scoped).

**Query Parameters**:
- `priority` (optional): Filter by priority (LOW, MEDIUM, HIGH)

**Response** (200 OK):
```json
{
  "workOrders": [
    {
      "id": 1,
      "title": "Maintenance Check",
      "description": "Quarterly maintenance",
      "priority": "MEDIUM",
      "created_by": "uuid",
      "created_at": "2024-01-15T10:00:00Z",
      "work_order_plants": [
        {
          "id": 1,
          "plant_id": 1,
          "is_active": true,
          "plants": {
            "id": 1,
            "name": "Solar Farm Alpha",
            "capacity_kw": 1000
          }
        }
      ]
    }
  ]
}
```

#### POST /api/workorders

Create work order (Super Admin only).

**Request Body**:
```json
{
  "title": "Maintenance Check",
  "description": "Quarterly maintenance",
  "priority": "MEDIUM",
  "plantIds": [1, 2, 3]
}
```

**Response** (201 Created):
```json
{
  "workOrder": {
    "id": 1,
    "title": "Maintenance Check",
    "description": "Quarterly maintenance",
    "priority": "MEDIUM",
    "created_by": "uuid",
    "created_at": "2024-01-15T10:00:00Z"
  }
}
```

**Note**: Existing active work orders for the specified plants are automatically deactivated.

#### GET /api/workorders/:id/efficiency

Get efficiency data for a work order.

**Response** (200 OK):
```json
{
  "efficiency": [
    {
      "id": 1,
      "work_order_id": 1,
      "plant_id": 1,
      "recorded_at": "2024-01-15T10:00:00Z",
      "actual_gen": 20.5,
      "expected_gen": 24.0,
      "pr": 0.8542,
      "efficiency_pct": 85.42,
      "category": "Healthy",
      "plants": {
        "id": 1,
        "name": "Solar Farm Alpha"
      }
    }
  ]
}
```

### Organizations & Vendors

#### GET /api/orgs

List organizations (role-scoped).

**Response** (200 OK):
```json
{
  "orgs": [
    {
      "id": 1,
      "name": "Solar Energy Corp",
      "meta": {},
      "created_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

#### POST /api/orgs

Create organization (Super Admin only).

**Request Body**:
```json
{
  "name": "New Organization",
  "meta": {
    "region": "North",
    "established": "2020"
  }
}
```

#### GET /api/vendors

List vendors (role-scoped). Returns vendors with organization information.

**Response** (200 OK):
```json
{
  "vendors": [
    {
      "id": 1,
      "name": "Solarman",
      "vendor_type": "SOLARMAN",
      "api_base_url": "https://globalpro.solarmanpv.com",
      "org_id": 1,
      "organizations": {
        "id": 1,
        "name": "Solar Energy Corp"
      },
      "is_active": true
    }
  ]
}
```

#### POST /api/vendors

Create vendor (Super Admin only). Requires `org_id` for vendor-organization mapping.

**Request Body**:
```json
{
  "name": "Solarman",
  "vendor_type": "SOLARMAN",
  "api_base_url": "https://globalpro.solarmanpv.com",
  "org_id": 1,
  "credentials": {
    "appId": "your_app_id",
    "appSecret": "your_app_secret",
    "username": "your_username",
    "password": "your_password",
    "solarmanOrgId": 12345
  },
  "is_active": true
}
```

#### POST /api/vendors/:id/sync-plants

Synchronize plants from vendor API (Super Admin only). Fetches all plants from the vendor and updates/creates them in the database with production metrics.

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Plants synced successfully",
  "synced": 25,
  "created": 5,
  "updated": 20,
  "total": 25
}
```

#### GET /api/vendors/:id/production

Get aggregated production metrics for all plants in a vendor.

**Response** (200 OK):
```json
{
  "totalPlants": 25,
  "aggregated": {
    "installedCapacityKw": 5000.0,
    "currentPowerKw": 150.5,
    "dailyEnergyMwh": 120.5,
    "monthlyEnergyMwh": 3500.0,
    "yearlyEnergyMwh": 45000.0,
    "totalEnergyMwh": 50000.0,
    "averagePerformanceRatio": 0.85
  },
  "plants": [...]
}
```

#### GET /api/plants/:id/production

Get production metrics for a specific plant.

**Response** (200 OK):
```json
{
  "plant": {
    "id": 1,
    "name": "Solar Farm Alpha",
    "capacityKw": 1000.0,
    "currentPowerKw": 50.5,
    "dailyEnergyMwh": 25.5,
    "monthlyEnergyMwh": 750.0,
    "yearlyEnergyMwh": 9000.0,
    "totalEnergyMwh": 10000.0,
    "performanceRatio": 0.85,
    "prPercentage": "85.000",
    "lastUpdateTime": "2024-01-15T10:00:00Z"
  }
}
```

#### GET /api/workorders/:id/production

Get aggregated production metrics for all plants in a work order (Government admin view).

**Response** (200 OK):
```json
{
  "totalPlants": 10,
  "aggregated": {
    "installedCapacityKw": 2000.0,
    "currentPowerKw": 100.5,
    "dailyEnergyMwh": 50.5,
    "monthlyEnergyMwh": 1500.0,
    "yearlyEnergyMwh": 18000.0,
    "totalEnergyMwh": 20000.0,
    "averagePerformanceRatio": 0.82
  },
  "plants": [...]
}
```

## Edge Functions

### Overview

Edge Functions are Deno-based serverless functions that run on Supabase infrastructure. They handle background processing and vendor API integration.

**Important**: Edge Functions that interact with the telemetry database use `TELEMETRY_SUPABASE_SERVICE_ROLE_KEY` (not the anon key) to bypass Row-Level Security policies when performing write and read operations. This is necessary because:
- The telemetry database is a separate Supabase instance
- Edge Functions need elevated permissions to insert telemetry data
- Service role key bypasses RLS, allowing background jobs to function properly

### vendor-auth

Generic vendor authentication with token caching.

**Purpose**: Authenticate with vendor APIs and return access tokens.

**Input**:
```json
{
  "vendorId": 1
}
```

**Output**:
```json
{
  "token": "access_token_string",
  "vendorType": "SOLARMAN"
}
```

**Usage**: Called by other Edge Functions before making vendor API calls.

### sync-telemetry

Poll vendor APIs and store telemetry in telemetry DB.

**Purpose**: Periodically fetch telemetry data from vendor APIs and store in telemetry database.

**Process**:
1. Fetch all active plants from main DB
2. For each plant, get vendor adapter
3. Fetch realtime data from vendor API
4. Store in telemetry DB with 24h retention

**Scheduling**: Should run every 15 minutes

**Environment Variables Required**:
- `TELEMETRY_SUPABASE_URL`
- `TELEMETRY_SUPABASE_SERVICE_ROLE_KEY` (uses service role to bypass RLS for writes)

**Output**:
```json
{
  "success": true,
  "synced": 150,
  "total": 150,
  "errors": []
}
```

### sync-alerts

Poll vendor APIs and sync alerts to main DB.

**Purpose**: Periodically fetch alerts from vendor APIs and update main database.

**Process**:
1. Fetch all active plants from main DB
2. For each plant, get vendor adapter
3. Fetch alerts from vendor API
4. Update or insert alerts in main DB

**Scheduling**: Should run every 30 minutes

**Output**:
```json
{
  "success": true,
  "synced": 23,
  "errors": []
}
```

### compute-efficiency

Calculate efficiency metrics for work orders.

**Purpose**: Calculate performance ratio and efficiency for plants in a work order.

**Input**:
```json
{
  "workOrderId": 1
}
```

**Process**:
1. Get all plants in work order
2. Fetch last 24 hours of telemetry for each plant from telemetry DB
3. Calculate actual vs expected generation
4. Compute performance ratio and efficiency percentage
5. Store efficiency records in main DB

**Environment Variables Required**:
- `TELEMETRY_SUPABASE_URL`
- `TELEMETRY_SUPABASE_SERVICE_ROLE_KEY` (uses service role to bypass RLS for reads)

**Output**:
```json
{
  "success": true,
  "results": [
    {
      "plantId": 1,
      "plantName": "Solar Farm Alpha",
      "actualGen": 20.5,
      "expectedGen": 24.0,
      "pr": 0.8542,
      "efficiencyPct": 85.42,
      "category": "Healthy"
    }
  ]
}
```

**Efficiency Calculation**:
- Expected Generation = Capacity (kW) × Baseline Factor (0.8) × 24 hours
- Performance Ratio = Actual Generation / Expected Generation
- Efficiency Percentage = Performance Ratio × 100
- Category:
  - Healthy: ≥ 85%
  - Suboptimal: 65-84%
  - Critical: < 65%

## Setup & Installation

> **📖 For detailed step-by-step setup, see [SETUP_GUIDE.md](./SETUP_GUIDE.md)**

### Prerequisites

1. **Node.js 18+** installed
2. **Two Supabase Projects**:
   - Main database for application data
   - Telemetry database (separate instance) for 24h telemetry retention
3. **npm** or **yarn** package manager
4. **Supabase CLI** (for Edge Functions deployment)

### Installation Steps

1. **Clone repository**
   ```bash
   git clone <repository-url>
   cd woms
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local`:
   ```env
   # Main Supabase Database
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   
   # Telemetry Database (Separate Instance)
   TELEMETRY_SUPABASE_URL=https://your-telemetry-project.supabase.co
   TELEMETRY_SUPABASE_ANON_KEY=your_telemetry_anon_key
   TELEMETRY_SUPABASE_SERVICE_ROLE_KEY=your_telemetry_service_role_key
   
   # Node Environment
   NODE_ENV=development
   
   # Plant Sync Cron (optional)
   ENABLE_PLANT_SYNC_CRON=true
   CRON_SECRET=your-secret-token-here
   ```

4. **Run database migrations**
   
   **Main Database** (Fresh Install):
   - Apply `supabase/migrations/001_initial_schema.sql` (complete schema with all features)
   - Apply `supabase/migrations/002_rls_policies.sql`
   
   **Main Database** (Upgrade from existing):
   - If upgrading, you can use `006_add_org_id_to_vendors.sql` and `007_add_plant_production_metrics.sql`
   - However, it's recommended to use the consolidated `001_initial_schema.sql` for fresh installs
   
   **Telemetry Database** (separate instance):
   - Apply `supabase/migrations/003_telemetry_db_schema.sql`

5. **Create user accounts via Supabase Console**
   
   > **⚠️ Important**: User accounts must be created directly in the Supabase SQL console, not via the seed script.
   
   **Recommended Method** (Quick Setup):
   1. Open your Supabase project dashboard
   2. Navigate to **SQL Editor**
   3. Open the file `supabase/migrations/004_manual_user_setup.sql`
   4. Copy and paste the entire SQL script into the SQL Editor
   5. Click **Run** to execute
   6. This will create three default accounts (see [Default Accounts](#default-accounts))
   
   **Alternative Method** (Manual Setup):
   - See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed step-by-step instructions
   - Use this method if you need to create custom accounts or troubleshoot issues
   
   **Note**: This application uses a custom `accounts` table for authentication (not Supabase Auth). Passwords are hashed using bcrypt before storage. Users input plain text passwords, which are hashed and compared with stored hashes during login.

6. **Start development server**
   ```bash
   npm run dev
   ```

7. **Access application**
   - Open `http://localhost:3000`
   - Login with default accounts (see [Default Accounts](#default-accounts))

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Main Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Main Supabase anon key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Main Supabase service role key | Yes |
| `TELEMETRY_SUPABASE_URL` | Telemetry DB Supabase URL | Yes |
| `TELEMETRY_SUPABASE_ANON_KEY` | Telemetry DB anon key | Yes |
| `TELEMETRY_SUPABASE_SERVICE_ROLE_KEY` | Telemetry DB service role key | Yes |
| `NODE_ENV` | Environment (development/production) | Yes |
| `CRON_SECRET` | Secret token for securing cron endpoint | No (recommended) |
| `SYNC_WINDOW_START` | Start time for restricted sync window (HH:MM format, Asia/Kolkata timezone, default: "19:00") | No |
| `SYNC_WINDOW_END` | End time for restricted sync window (HH:MM format, Asia/Kolkata timezone, default: "06:00") | No |

### Database Configuration

#### Main Database
- Enable Row-Level Security (RLS) on all tables
- Set up proper indexes for performance
- Configure connection pooling

#### Telemetry Database
- Set up automatic cleanup (24h retention)
- Configure indexes for time-series queries
- Consider partitioning for large datasets

### Auto-Sync Configuration

Plant synchronization is automatically enabled for all organizations by default with a 15-minute interval. Super admins can configure sync settings per organization from the Vendors management page:

- **Enable/Disable Auto-Sync**: Toggle automatic synchronization for each organization
- **Sync Interval**: Set the interval in minutes (1-1440 minutes, default: 15)
- **Clock-Based Scheduling**: Sync runs at fixed clock times based on the interval (e.g., 15 min = :00, :15, :30, :45)
- **Time Window Restriction**: Sync is automatically skipped during the configured time window (default: 7 PM to 6 AM Asia/Kolkata timezone)

**Environment Variables for Sync Window**:
- `SYNC_WINDOW_START`: Start time in HH:MM format (Asia/Kolkata timezone, default: "19:00")
- `SYNC_WINDOW_END`: End time in HH:MM format (Asia/Kolkata timezone, default: "06:00")

**Note**: Time calculations use the `Asia/Kolkata` timezone (IST) via JavaScript's Intl API for accurate timezone handling.

**Note**: All vendors are processed in parallel during sync operations. Tokens are stored in the database only (no in-memory caching) to ensure each vendor uses its own token.

### Edge Function Scheduling

Configure scheduled execution in Supabase:

1. **sync-telemetry**: Every 15 minutes
2. **sync-alerts**: Every 30 minutes
3. **compute-efficiency**: On-demand (via API)

### Plant Sync Cron Job

The plant sync cron job automatically synchronizes plant data from all active vendors. See [CRON_SYNC.md](./docs/CRON_SYNC.md) for detailed documentation.

**Configuration:**
- **Server-Side Cron**: Automatically initialized when the Node.js server starts via `instrumentation.ts` (runs every 15 minutes)
- **Manual Trigger**: POST to `/api/cron/sync-plants` (SUPERADMIN only) or use the "Trigger Sync Now" button in the Vendor Sync Dashboard

**Features:**
- **Auto-Implemented**: No configuration needed - sync is automatically enabled for all organizations
- **Per-Organization Settings**: Super admins configure sync intervals from the Vendors page
- **Clock-Based Scheduling**: Sync runs at fixed clock times (e.g., 15 min = :00, :15, :30, :45)
- **Time Window Restriction**: Automatically skips sync during configured hours (default: 7 PM - 6 AM Asia/Kolkata timezone)
- **Parallel Processing**: All vendors are processed simultaneously (no concurrency limit)
- **Database Token Storage**: Tokens stored in DB only (no in-memory cache) - each vendor uses its own token
- **Generic Vendor Support**: Works with any vendor adapter
- **Automatic Token Validation**: Tokens are validated and refreshed automatically
- **Batch Database Operations**: Efficient batch upserts for plant data

## Development Guide

### Available Scripts

```bash
# Development server (http://localhost:3000)
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Production build
npm run build

# Start production server
npm start
```

### Development Workflow

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make changes**
   - Follow TypeScript strict mode
   - Use ESLint for code quality
   - Write descriptive commit messages

3. **Test locally**
   ```bash
   npm run type-check
   npm run lint
   npm run build
   ```

4. **Submit pull request**

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Next.js recommended rules
- **Components**: Use functional components with TypeScript
- **API Routes**: Use Next.js App Router API routes
- **Error Handling**: Always handle errors gracefully

### Adding New Features

1. **API Routes**: Add to `app/api/`
2. **Components**: Add to `components/`
3. **Utilities**: Add to `lib/`
4. **Database**: Create migration in `supabase/migrations/`
5. **Edge Functions**: Add to `supabase/functions/`

## Deployment

### Application Deployment

#### Vercel (Recommended)

1. **Connect repository** to Vercel
2. **Configure environment variables**:
   - Add all variables from `.env.local`
3. **Deploy**: Vercel automatically deploys on push

#### Other Platforms

1. **Build application**:
   ```bash
   npm run build
   ```

2. **Set environment variables** in hosting platform

3. **Deploy** using platform-specific instructions

### Edge Functions Deployment

1. **Install Supabase CLI**:
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link project**:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. **Deploy functions**:
   ```bash
   supabase functions deploy vendor-auth
   supabase functions deploy sync-telemetry
   supabase functions deploy sync-alerts
   supabase functions deploy compute-efficiency
   ```

5. **Set environment variables** for Edge Functions:
   - `TELEMETRY_SUPABASE_URL`
   - `TELEMETRY_SUPABASE_SERVICE_ROLE_KEY` (required for write operations)
   
   **Note**: Edge Functions use the service role key for telemetry DB to bypass RLS policies when inserting/reading telemetry data.

6. **Schedule functions** (in Supabase dashboard):
   - `sync-telemetry`: Cron `*/15 * * * *` (every 15 minutes)
   - `sync-alerts`: Cron `*/30 * * * *` (every 30 minutes)

### Post-Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] RLS policies enabled
- [ ] Edge Functions deployed
- [ ] Edge Functions scheduled
- [ ] Monitoring set up
- [ ] Error logging configured
- [ ] Default passwords changed
- [ ] SSL certificates valid
- [ ] Backup strategy in place

## Security Considerations

### Authentication

- **Custom Authentication**: Uses custom `accounts` table (not Supabase Auth)
- **Password Storage**: Bcrypt hashed (passwords are hashed before storage)
- **Session Management**: HTTP-only cookies prevent XSS
- **Token Expiry**: 7-day session expiry
- **Secure Cookies**: `secure` flag in production
- **User Creation**: Users must be created via Supabase SQL console (see [SETUP_GUIDE.md](./SETUP_GUIDE.md))

### Database Security

- **Row-Level Security**: All tables have RLS enabled
- **Service Role Key**: Only used server-side, never exposed
- **Anon Key**: Limited permissions via RLS policies
- **SQL Injection**: Parameterized queries via Supabase client

### API Security

- **Authentication Required**: All API routes check authentication
- **Role-Based Authorization**: Permissions checked per request
- **Input Validation**: Zod schemas for request validation
- **Rate Limiting**: Consider adding rate limiting in production

### Best Practices

1. **Never commit** `.env.local` or secrets
2. **Use HTTPS** in production
3. **Regular security updates** for dependencies
4. **Monitor** for suspicious activity
5. **Backup** databases regularly
6. **Audit logs** for sensitive operations

## Performance Optimization

### Database Optimization

1. **Indexes**: All foreign keys and frequently queried columns indexed
2. **Connection Pooling**: Use Supabase connection pooling
3. **Query Optimization**: Use `select()` to limit returned columns
4. **Pagination**: Implement pagination for large datasets

### Frontend Optimization

1. **Server Components**: Use Next.js Server Components where possible
2. **Code Splitting**: Automatic with Next.js
3. **Image Optimization**: Use Next.js Image component
4. **Caching**: Implement appropriate caching strategies

### Telemetry Database

1. **24-Hour Retention**: Automatic cleanup keeps database size manageable
2. **Indexes**: Optimized for time-series queries
3. **Partitioning**: Consider partitioning for very large datasets

### Edge Functions

1. **Token Caching**: Implemented in adapters
2. **Batch Processing**: Process multiple plants in parallel
3. **Error Handling**: Graceful degradation on failures

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

**Symptoms**: "Failed to connect to database" errors

**Solutions**:
- Verify Supabase URLs and keys in `.env.local`
- Check network connectivity
- Ensure migrations have been applied
- Verify RLS policies are enabled

#### 2. Telemetry Not Showing

**Symptoms**: Dashboard shows no telemetry data

**Solutions**:
- Verify telemetry DB is configured correctly
- Check Edge Functions are deployed and running
- Ensure `sync-telemetry` function has access to telemetry DB
- Check function logs in Supabase dashboard
- Verify plants are active and have vendor configurations

#### 3. Authentication Issues

**Symptoms**: Cannot login or session expires immediately

**Solutions**:
- Clear browser cookies
- Verify session cookie is being set (check browser DevTools)
- Check middleware configuration
- Verify password comparison is working
- Check account exists in database

#### 4. TypeScript Errors in Edge Functions

**Symptoms**: TypeScript compilation errors for Edge Functions

**Solutions**:
- Edge Functions use Deno, not Node.js TypeScript
- These errors are expected and won't affect runtime
- Functions are excluded from TypeScript compilation (see `tsconfig.json`)
- Use Deno types for Edge Function development

#### 5. RLS Policy Errors

**Symptoms**: "Permission denied" errors despite correct role

**Solutions**:
- Verify RLS policies are correctly defined
- Check account type matches policy conditions
- Verify `org_id` is set correctly for ORG accounts
- Test policies in Supabase SQL editor

#### 6. Edge Function Failures

**Symptoms**: Edge Functions not executing or failing

**Solutions**:
- Check function logs in Supabase dashboard
- Verify environment variables are set
- Check function deployment status
- Verify vendor API credentials
- Test function locally with Supabase CLI

### Debugging Tips

1. **Check Browser Console**: For frontend errors
2. **Check Server Logs**: For API route errors
3. **Check Supabase Logs**: For database and Edge Function errors
4. **Use Supabase SQL Editor**: To test queries directly
5. **Enable Debug Mode**: Add console.log statements (remove in production)

## Default Accounts

After creating users via the Supabase console (see [Setup & Installation](#setup--installation)), you can login with:

| Role | Email | Password | Description |
|------|-------|----------|-------------|
| Super Admin | `admin@woms.com` | `admin123` | Full system access |
| Government | `govt@woms.com` | `govt123` | Read-only global access |
| Organization | `org1@woms.com` | `org1123` | Read-only org access |

> **⚠️ Security Note**: **Always change default passwords in production!**
> 
> **📝 User Management**: To create, update, or delete user accounts, use the Supabase SQL console. See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed instructions.

## Additional Resources

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - **📖 Complete setup guide** - Step-by-step instructions for setting up WOMS from scratch
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - **🔧 Troubleshooting guide** - Common issues and solutions
- **[TROUBLESHOOTING_MIGRATIONS.md](./TROUBLESHOOTING_MIGRATIONS.md)** - **🗄️ Database migration troubleshooting** - Specific help for migration issues

> **💡 User Setup**: Create user accounts via the Supabase SQL console using `supabase/migrations/004_manual_user_setup.sql`. Alternatively, you can use the seed script (`scripts/seed.ts`), but SQL script is recommended.

> **⚠️ Production Note**: Before deploying to production, review the Security Considerations section in this README and ensure all environment variables are properly configured.

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Open an issue** to discuss major changes before implementing
2. **Fork the repository**
3. **Create a feature branch**: `git checkout -b feature/your-feature`
4. **Make your changes** following code style guidelines
5. **Test your changes**: Run `npm run type-check` and `npm run lint`
6. **Commit with descriptive messages**
7. **Submit a pull request** with a clear description

### Contribution Guidelines

- Follow TypeScript strict mode
- Write tests for new features
- Update documentation
- Follow existing code style
- Keep commits atomic and descriptive

## Support

For issues, questions, or feature requests:

1. **Check existing issues** in the repository
2. **Search documentation** for answers
3. **Open a new issue** with:
   - Clear description
   - Steps to reproduce (if bug)
   - Expected vs actual behavior
   - Environment details

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and changes.

---

**Built with ❤️ for solar energy monitoring and management**
