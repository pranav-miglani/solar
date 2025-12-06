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
 * Note: apiBaseUrl is not included - it's read from environment variables (e.g., INTELLO_API_BASE_URL)
 */
export interface WmsVendorConfig {
  id: number
  name: string
  vendorType: 'INTELLO' | string
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
   * Calculate daily insolation from hourly readings
   * Calculates the area under the IRR vs time curve (integral of power over time)
   * Returns energy in kWh/m²
   * 
   * Uses trapezoidal rule for numerical integration:
   * - Calculates actual time intervals from timestamps
   * - Integrates IRR (W/m²) over time to get energy (kWh/m²)
   */
  calculateDailyInsolation(readings: InsolationReading[]): number {
    if (!readings || readings.length === 0) {
      return 0
    }

    const validReadings = readings.filter(r => r.irr != null && r.irr >= 0)
    if (validReadings.length === 0) {
      return 0
    }

    // Sort readings by timestamp to ensure correct order
    const sortedReadings = [...validReadings].sort((a, b) => {
      const timeA = this.parseTimestamp(a.date, a.hour)
      const timeB = this.parseTimestamp(b.date, b.hour)
      return timeA.getTime() - timeB.getTime()
    })

    if (sortedReadings.length === 1) {
      // Single reading: assume 1 hour interval
      return (sortedReadings[0].irr * 1.0) / 1000 // kWh/m²
    }

    // Use trapezoidal rule for numerical integration
    let totalEnergyWh = 0

    for (let i = 0; i < sortedReadings.length - 1; i++) {
      const current = sortedReadings[i]
      const next = sortedReadings[i + 1]

      const timeCurrent = this.parseTimestamp(current.date, current.hour)
      const timeNext = this.parseTimestamp(next.date, next.hour)

      // Calculate time interval in hours
      const timeIntervalHours = (timeNext.getTime() - timeCurrent.getTime()) / (1000 * 60 * 60)

      if (timeIntervalHours <= 0) {
        // Skip if timestamps are invalid or same
        continue
      }

      // Trapezoidal rule: average of two values × time interval
      const avgIrr = (current.irr + next.irr) / 2
      const energyWh = avgIrr * timeIntervalHours
      totalEnergyWh += energyWh
    }

    // Convert Wh/m² to kWh/m²
    return totalEnergyWh / 1000
  }

  /**
   * Parse timestamp from date and hour strings
   * @param date - ISO date string (YYYY-MM-DD) or datetime string
   * @param hour - Time string (HH:mm:ss or HH:mm)
   * @returns Date object
   */
  private parseTimestamp(date: string, hour: string): Date {
    try {
      // If date already contains time, parse it directly
      if (date.includes('T') || date.includes(' ')) {
        return new Date(date)
      }

      // Combine date and hour
      const dateTimeStr = `${date} ${hour}`
      const parsed = new Date(dateTimeStr)
      
      if (isNaN(parsed.getTime())) {
        // Fallback: try ISO format
        return new Date(date)
      }
      
      return parsed
    } catch (error) {
      // Fallback to current date if parsing fails
      return new Date()
    }
  }

  /**
   * @deprecated Use calculateDailyInsolation() instead
   * Kept for backward compatibility
   */
  calculateAverageInsolation(readings: InsolationReading[]): number {
    return this.calculateDailyInsolation(readings)
  }

  protected getApiBaseUrl(): string {
    // Get vendor-specific base URL from environment variables
    // e.g., INTELLO_API_BASE_URL for INTELLO vendor type
    const vendorType = this.config.vendorType.toUpperCase()
    const envVarName = `${vendorType}_API_BASE_URL`
    const baseUrl = process.env[envVarName]
    
    if (!baseUrl) {
      throw new Error(
        `API base URL not configured. Please set ${envVarName} environment variable.`
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
    
    // Import logger dynamically to avoid circular dependencies
    const { logger } = await import("@/lib/context/logger")
    const method = (options.method || "GET").toUpperCase()
    
    logger.info(`[BaseWmsAdapter] Making authenticated API call: ${method} ${url}`)
    if (options.body) {
      logger.info(`[BaseWmsAdapter] Request body: ${typeof options.body === 'string' ? options.body : JSON.stringify(options.body)}`)
    }

    logger.info(`[BaseWmsAdapter] Using token: ${token.substring(0, 20)}... (truncated for security)`)
    const requestStartTime = Date.now()
    const response = await pooledFetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    const requestDuration = Date.now() - requestStartTime
    logger.info(`[BaseWmsAdapter] API call completed: ${response.status} ${response.statusText} (${requestDuration}ms)`)

    return response
  }
}

