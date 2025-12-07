import { pooledFetch } from "@/lib/vendors/httpClient"
import { logger } from "@/lib/context/logger"

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
 * Insolation reading interface (time-series data from vendor)
 * Can be at any interval (e.g., 10-minute, hourly, etc.)
 * For vendors with pre-calculated daily values (INTELLO, SCADA), irr is not used
 */
export interface InsolationReading {
  deviceId: string
  date: string // ISO date string
  hour: string // HH:mm:ss format (or any time format)
  irr?: number // Optional: Insolation value in W/m² (not used for pre-calculated daily values)
  generation?: number // Optional: Pre-calculated daily insolation in kWh/m² (used for INTELLO, SCADA)
}

/**
 * WMS Vendor Config
 * Note: apiBaseUrl is not included - it's read from environment variables (e.g., INTELLO_API_BASE_URL)
 */
export interface WmsVendorConfig {
  id: number
  name: string
  vendorType: 'INTELLO' | 'SCADA' | 'TRACKSO' | string
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
   * Set vendor ID and Supabase client for token storage
   * Default implementation does nothing - adapters should override this to enable token caching
   */
  setTokenStorage(vendorId: number, supabaseClient: any): void {
    // Default implementation: no-op
    // Adapters should override this to enable token caching
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
   * @param deviceId - Vendor-specific device identifier (primary identifier for API calls)
   * @param fromDate - Start date (YYYY-MM-DD)
   * @param toDate - End date (YYYY-MM-DD)
   * @param deviceName - Optional device name/identifier (vendor-specific, e.g., USER_ID for SCADA)
   */
  abstract getInsolationData(
    deviceId: string,
    fromDate: string,
    toDate: string,
    deviceName?: string
  ): Promise<InsolationReading[]>

  /**
   * Extract devices from a site
   * Each vendor adapter must implement this to extract devices from their site structure
   */
  abstract extractDevicesFromSite(site: WmsSite): WmsDevice[]

  /**
   * Calculate daily insolation from all readings
   * Calculates the area under the IRR vs time curve (integral of power over time)
   * Returns energy in kWh/m²
   * 
   * Uses left endpoint method for numerical integration:
   * - Uses ALL readings provided (no filtering by interval)
   * - Calculates actual time intervals from timestamps between consecutive readings
   * - Uses the first IRR value (IRR_i) for each interval × time interval
   * - Formula: Σ [IRR_i × Δt_i] / 1000
   * - Integrates IRR (W/m²) over time to get energy (kWh/m²)
   * - Handles variable time intervals (e.g., 10-minute, hourly, or any interval)
   */
  calculateDailyInsolation(readings: InsolationReading[]): number {
    if (!readings || readings.length === 0) {
      return 0
    }

    // Check if readings have pre-calculated generation values (for INTELLO, SCADA)
    const hasPreCalculated = readings.some(r => (r as any).generation != null)
    if (hasPreCalculated) {
      // For pre-calculated values, use generation field directly
      const validReadings = readings.filter(r => (r as any).generation != null && (r as any).generation >= 0)
      if (validReadings.length === 0) {
        return 0
      }
      // Return the generation value (already in kWh/m²)
      return (validReadings[0] as any).generation
    }

    // For time-series readings with irr values, use integration method
    // Filter invalid readings: null, NaN, negative, or unreasonably large (>2000 W/m²)
    const validReadings = readings.filter(r => {
      if (r.irr == null) return false
      if (isNaN(r.irr) || !isFinite(r.irr)) return false
      if (r.irr < 0) return false
      if (r.irr > 2000) {
        // Log warning for unusually high values but don't filter (could be valid in extreme conditions)
        logger.warn(`[BaseWmsAdapter] Unusually high IRR value detected: ${r.irr} W/m² (device: ${r.deviceId}, date: ${r.date})`)
        return true // Keep it but log warning
      }
      return true
    })
    
    if (validReadings.length === 0) {
      logger.warn(`[BaseWmsAdapter] No valid readings after filtering (total: ${readings.length})`)
      return 0
    }

    // Sort readings by timestamp to ensure correct order for integration
    const sortedReadings = [...validReadings].sort((a, b) => {
      const timeA = this.parseTimestamp(a.date, a.hour)
      const timeB = this.parseTimestamp(b.date, b.hour)
      return timeA.getTime() - timeB.getTime()
    })

    if (sortedReadings.length === 1) {
      // Single reading: cannot calculate area under curve, return 0
      // (Need at least 2 points to define an area)
      return 0
    }

    // Use left endpoint method for numerical integration
    // This uses ALL consecutive readings to calculate the area under the curve
    // Uses the first IRR value (IRR_i) for each interval
    let totalEnergyWh = 0
    let skippedReadings = 0

    for (let i = 0; i < sortedReadings.length - 1; i++) {
      const current = sortedReadings[i]
      const next = sortedReadings[i + 1]

      try {
        const timeCurrent = this.parseTimestamp(current.date, current.hour)
        const timeNext = this.parseTimestamp(next.date, next.hour)

        // Calculate actual time interval in hours between consecutive readings
        const timeIntervalHours = (timeNext.getTime() - timeCurrent.getTime()) / (1000 * 60 * 60)

        if (timeIntervalHours <= 0) {
          // Skip if timestamps are invalid or same (duplicate readings)
          skippedReadings++
          continue
        }

        // Validate time interval is reasonable (not more than 24 hours for consecutive readings)
        if (timeIntervalHours > 24) {
          logger.warn(`[BaseWmsAdapter] Unusually large time interval: ${timeIntervalHours} hours between readings (device: ${current.deviceId})`)
          skippedReadings++
          continue
        }

        // Use the first IRR value (IRR_i) for each interval × time interval
        // Formula: Σ [IRR_i × Δt_i] / 1000
        if (current.irr == null) {
          skippedReadings++
          continue
        }
        const energyWh = current.irr * timeIntervalHours
        
        // Validate calculated energy is reasonable
        if (isNaN(energyWh) || !isFinite(energyWh)) {
          logger.warn(`[BaseWmsAdapter] Invalid energy calculation: ${energyWh} Wh/m² (IRR: ${current.irr}, interval: ${timeIntervalHours}h)`)
          skippedReadings++
          continue
        }

        totalEnergyWh += energyWh
      } catch (error) {
        // Skip reading if timestamp parsing fails
        skippedReadings++
        logger.warn(`[BaseWmsAdapter] Skipping reading due to timestamp parsing error: ${error}`)
        continue
      }
    }

    if (skippedReadings > 0) {
      logger.info(`[BaseWmsAdapter] Skipped ${skippedReadings} invalid readings out of ${sortedReadings.length} total`)
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

