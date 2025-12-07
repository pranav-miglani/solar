export interface VendorCredentials {
  [key: string]: string | number | boolean
}

export type PlantSyncMode = 'LIST_PLANTS' | 'PER_PLANT'

export interface VendorConfig {
  id: number
  name: string
  vendorType: 'SOLARMAN' | 'SOLARDM' | 'SHINEMONITOR' | 'PVBLINK' | 'FOXESSCLOUD' | 'OTHER'
  apiBaseUrl?: string // Optional - can be read from environment variables instead
  credentials: VendorCredentials
  isActive: boolean
  // Optional plant sync configuration. Not all adapters need this directly,
  // but services (e.g. plantSyncService) can branch behavior based on it.
  plantSyncMode?: PlantSyncMode
  perPlantSyncIntervalMinutes?: number
  plantSyncTimeIst?: string // Daily plant sync time in IST (default: "02:00")
}

export interface Plant {
  id: string
  name: string
  capacityKw: number
  location?: {
    lat?: number
    lng?: number
    address?: string
  }
  metadata?: Record<string, any>
}

export interface TelemetryData {
  plantId: string
  timestamp: Date
  generationPowerKw: number
  voltage?: number
  current?: number
  temperature?: number
  irradiance?: number
  efficiencyPct?: number
  metadata?: Record<string, any>
}

export interface Alert {
  vendorAlertId?: string
  title: string
  description?: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  metadata?: Record<string, any>
}

export interface RealtimeData {
  plantId: string
  timestamp: Date
  data: Record<string, any>
}
