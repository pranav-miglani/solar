🌞 Unified Vendor Onboarding & Adapter Specification

Vendors Supported:

Solarman

Shinemonitor

This document is meant to be placed in:
/docs/vendor-onboarding.md or context.mdc inside Cursor.

1. Overview

Your platform uses a Unified Normalized Adapter Layer.
Each vendor (Solarman, Shinemonitor, etc.) has its own driver that transforms vendor-specific APIs into a common internal format.

When onboarding a vendor:

Ask: Vendor Type

Based on vendor type → ask for required credentials

Register the vendor using the unified adapter interface

Store vendor secrets securely (vault)

Generate adapter files using this doc

2. Vendor Onboarding Flow (AI-Friendly)
Step 1 — Select Vendor Type
Which vendor are you onboarding?
1. Solarman
2. Shinemonitor

3. Fields Required Per Vendor
🚀 A. Solarman Vendor Configuration
Required Fields
Field	Description
appId	Solarman App ID
appSecret	Solarman Secret Key
username	Solarman account username / email
passwordSha256	SHA-256 hashed password
orgId (optional)	Org-level token generation
baseUrl	e.g., https://globalapi.solarmanpv.com
Authentication Flow

Token generated via:
POST /account/v1.0/token?appId=...

Password must be SHA256 hashed

Response includes: access_token, expires_in, refresh_token

Data Required to Call APIs
Authorization: Bearer <access_token>
Content-Type: application/json

Core Solarman Endpoints
Purpose	Endpoint	Method
Get token	/account/v1.0/token	POST
Plant details	/station/v1.0/base	POST
Plant devices	/station/v1.0/device	POST
Realtime data	/device/v1.0/currentData	POST
Historical data	/device/v1.0/historical	POST
Alerts	/device/v1.0/alertList	POST
Control	/device/v1.0/remoteControl	POST
⚡ B. Shinemonitor Vendor Configuration
Required Fields
Field	Description
companyKey	Shinemonitor company key
usr	Username
pwd	User password (used only to generate SHA1/PWD hash during auth)
token	Returned from auth; used for all business APIs
secret	Returned from auth; used for signing
baseUrl	Default: http://api.shinemonitor.com/public/
Authentication Flow

Compute sha1Pwd = SHA1(pwd)

Compute sign = SHA1(salt + sha1Pwd + "&action=auth&usr=...&company-key=...")

Call:

?sign=<sign>&salt=<salt>&action=auth&usr=<usr>&company-key=<company-key>


API returns:

token

secret

token expiry seconds

Data Required for API Calls

All API calls require:

sign=<sign>&salt=<salt>&token=<token>&action=<action>&params...

Core Shinemonitor Endpoints
Purpose	Action (Query param)
Plant info	action=queryPlantInfo
Plant list	queryPlants
Realtime	queryPlantActiveOuputPowerCurrent
Day power curve	queryPlantActiveOuputPowerOneDay
Plant energy	queryPlantEnergyDay, Month, Year
Alerts	queryPlantWarning
Token refresh	updateToken
4. Unified Vendor Adapter Contract (For Both Vendors)

Every vendor must implement:

interface VendorDriver {
  vendorName: string
  init(config: VendorConfig): Promise<void>
  refreshAuth?(): Promise<void>

  // plant
  getPlants(): Promise<Plant[]>
  getDevices(plantVendorId: string): Promise<Device[]>

  // telemetry
  getRealtimeDeviceData(deviceVendorId: string): Promise<TelemetryPoint[]>
  getHistoricalDeviceData(deviceVendorId: string, from: string, to: string, granularity: 'frame' | 'day' | 'month' | 'year'): Promise<TelemetryPoint[]>

  // alerts
  getDeviceAlerts(deviceVendorId: string, from?: string, to?: string): Promise<Alert[]>

  // commands (if available)
  sendCommand?(deviceVendorId: string, command: string, params?: any): Promise<CommandTask>

  // callbacks / webhooks
  handleCallback?(payload: any): Promise<void>
}

5. Normalized Internal Data Schema

(All vendors must map into this.)

Plant
interface Plant {
  id: string
  vendorPlantId?: string
  vendor: string
  name?: string
  location?: { lat?: number; lng?: number; address?: string }
  timezone?: string
  installedCapacityKw?: number
  commissioningDate?: string
  meta?: Record<string, any>
}

Device
interface Device {
  id: string
  vendorDeviceId?: string
  vendor: string
  plantId?: string
  type?: 'INVERTER' | 'METER' | 'BATTERY' | 'LOGGER' | 'SENSOR' | 'UNKNOWN'
  serial?: string
  model?: string
  status?: 'ONLINE' | 'OFFLINE' | 'ALARM' | 'UNKNOWN'
  lastSeen?: string
  meta?: Record<string, any>
}

TelemetryPoint
interface TelemetryPoint {
  timestamp: string
  deviceId: string
  metrics: Record<string, number | string | boolean>
  raw?: Record<string, any>
}

Alert
interface Alert {
  id: string
  vendorAlertId?: string
  vendor: string
  deviceId?: string
  plantId?: string
  severity: 'INFO' | 'WARN' | 'ERROR'
  code?: string
  message: string
  timestamp: string
  raw?: Record<string, any>
}

6. How Cursor Should Use This Document

When writing code or onboarding a new vendor:

Step 1 — Ask
What vendor are you onboarding?
[Solarman/Shinemonitor]

Step 2 — Based on choice, ask for these details:
For Solarman
Provide:
- appId
- appSecret
- username
- passwordSha256
- orgId (optional)
- baseUrl (optional)

For Shinemonitor
Provide:
- companyKey
- usr
- pwd
- baseUrl (optional)

Step 3 — Cursor auto-generates:

/adapters/<vendor>/<vendor>.client.ts

/adapters/<vendor>/<vendor>.mapper.ts

/adapters/<vendor>/index.ts

Vendor registration in vendor-registry.ts

Step 4 — Cursor generates mapping functions:

plant mapping

device mapping

realtime telemetry

historical telemetry

alerts

commands (if supported)

7. Example: Vendor Creation JSON

(Your app can require this format)

{
  "vendorType": "Solarman",
  "config": {
    "appId": "xxxxx",
    "appSecret": "xxxxx",
    "username": "email@example.com",
    "passwordSha256": "xxxx",
    "orgId": "optional"
  }
}

{
  "vendorType": "Shinemonitor",
  "config": {
    "companyKey": "xxxxx",
    "usr": "myuser",
    "pwd": "myPassword"
  }
}

8. Summary

This MD gives Cursor everything it needs to:

Detect vendor type

Ask correct credentials

Generate adapter code for Solarman & Shinemonitor

Map them into the unified schema

Ensure both vendors behave identically inside the platform
