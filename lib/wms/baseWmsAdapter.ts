import { pooledFetch } from "@/lib/vendors/httpClient"

/**
 * WMS Site interface
 */
export interface WmsSite {
  vendorSiteId: string
  siteName: string
  address?: string
  latitude?: number
  longitude?: number
  location?: string
  elevation?: number
  status?: string
  panelCount?: number
  panelWattage?: number
  createdDate?: string
  installerType?: string
  metadata?: Record<string, any>
}

/**
 * WMS Device interface
 */
export interface WmsDevice {
  vendorDeviceId: string
  deviceName?: string
  macAddress?: string
  serialNo?: string
  metadata?: Record<string, any>
}

/**
 * Insolation reading interface (hourly data from vendor)
 */
export interface InsolationReading {
  deviceId: string
  date: string // ISO date string
  hour: string // HH:mm:ss format
  irr: number // Insolation value in W/m²
  generation?: number // Optional generation value
}

/**
 * WMS Vendor Config
 */
export interface WmsVendorConfig {
  id: number
  name: string
  vendorType: 'INTELLO' | string
  apiBaseUrl?: string
  credentials: Record<string, any>
  isActive: boolean
  orgId: number
}

/**
 * Base abstract class for all WMS vendor adapters
 * Each WMS vendor implementation must extend this class and implement all abstract methods
 */
export abstract class BaseWmsAdapter {
  protected config: WmsVendorConfig

  constructor(config: WmsVendorConfig) {
    this.config = config
  }

  /**
   * Authenticate with WMS vendor API and return access token
   * Should implement token caching internally
   */
  abstract authenticate(): Promise<string>

  /**
   * List all sites available from this WMS vendor
   */
  abstract listSites(): Promise<WmsSite[]>

  /**
   * Get insolation data for a specific device
   * @param deviceId - Vendor-specific device identifier
   * @param fromDate - Start date (YYYY-MM-DD)
   * @param toDate - End date (YYYY-MM-DD)
   */
  abstract getInsolationData(
    deviceId: string,
    fromDate: string,
    toDate: string
  ): Promise<InsolationReading[]>

  /**
   * Calculate average insolation from hourly readings
   * Default implementation: average of all non-zero IRR values
   */
  calculateAverageInsolation(readings: InsolationReading[]): number {
    if (!readings || readings.length === 0) {
      return 0
    }

    const validReadings = readings.filter(r => r.irr != null && r.irr >= 0)
    if (validReadings.length === 0) {
      return 0
    }

    const sum = validReadings.reduce((acc, r) => acc + r.irr, 0)
    return sum / validReadings.length
  }

  protected getApiBaseUrl(): string {
    // Check config first, then fall back to vendor-specific env vars
    if (this.config.apiBaseUrl) {
      return this.config.apiBaseUrl
    }
    
    // Get vendor-specific base URL from environment variables
    const vendorType = this.config.vendorType.toUpperCase()
    const envVarName = `${vendorType}_API_BASE_URL`
    const baseUrl = process.env[envVarName]
    
    if (!baseUrl) {
      throw new Error(
        `API base URL not configured. Please set ${envVarName} environment variable or provide apiBaseUrl in config.`
      )
    }
    
    return baseUrl
  }

  protected getCredentials(): Record<string, any> {
    return this.config.credentials
  }

  protected async fetchWithAuth(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.authenticate()
    const url = `${this.getApiBaseUrl()}${endpoint}`

    return pooledFetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
  }
}

