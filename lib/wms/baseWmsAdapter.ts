import { pooledFetch } from "@/lib/vendors/httpClient"
import { logger } from "@/lib/context/logger"
import { TokenRepository } from "./modules/tokenRepository"
import { UnauthorizedHandler } from "./modules/unauthorizedHandler"

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
  protected vendorId?: number
  protected supabaseClient?: any
  protected tokenRepository?: TokenRepository
  protected unauthorizedHandler?: UnauthorizedHandler

  constructor(config: WmsVendorConfig) {
    this.config = config
  }

  /**
   * Set vendor ID and Supabase client for token storage
   * Initializes TokenRepository and UnauthorizedHandler
   */
  setTokenStorage(vendorId: number, supabaseClient: any): void {
    this.vendorId = vendorId
    this.supabaseClient = supabaseClient
    this.tokenRepository = new TokenRepository(vendorId, supabaseClient)
    this.unauthorizedHandler = new UnauthorizedHandler(this.tokenRepository)
  }

  /**
   * Authenticate with WMS vendor API and return access token
   * Should check database for cached token first, then fetch new token if needed
   * Token caching should be done in database only (no in-memory caching)
   */
  async authenticate(): Promise<string> {
    // Check DB for cached token
    if (this.tokenRepository) {
      const tokenData = await this.tokenRepository.getTokenFromDb()
      if (tokenData && this.tokenRepository.isTokenValid(tokenData)) {
        return tokenData.token
      }
    }

    // No valid cached token, fetch and validate token from API
    const { token, expiresAt, metadata } = await this.getValidToken()

    // Save to DB
    if (this.tokenRepository) {
      await this.tokenRepository.saveTokenToDb(token, expiresAt, metadata)
    }

    return token
  }

  /**
   * Get a valid token from API with retry and validation
   * Retries up to 3 times with exponential backoff if token validation fails
   * This ensures we only use tokens that actually work
   */
  protected async getValidToken(): Promise<{
    token: string
    expiresAt: Date
    metadata?: Record<string, any>
  }> {
    const maxAttempts = 3

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      logger.info(`[BaseWmsAdapter] Fetching token from API (attempt ${attempt}/${maxAttempts})...`)

      // Fetch token from API
      const { token, expiresAt, metadata } = await this.fetchTokenFromApi()

      if (!token || token.trim().length === 0) {
        logger.error(`[BaseWmsAdapter] Empty token returned from API on attempt ${attempt}`)
        if (attempt === maxAttempts) {
          throw new Error("Failed to get valid token: API returned empty token")
        }
        // Wait before retry
        const delay = 1200 * attempt
        logger.info(`[BaseWmsAdapter] Waiting ${delay}ms before retry...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      // Test token to ensure it actually works
      logger.info(`[BaseWmsAdapter] Testing token validity (attempt ${attempt}/${maxAttempts})...`)
      const isValid = await this.testToken(token)

      if (isValid) {
        logger.info(`[BaseWmsAdapter] Token validated successfully on attempt ${attempt}`)
        return { token, expiresAt, metadata }
      } else {
        logger.warn(`[BaseWmsAdapter] Token validation failed on attempt ${attempt}`)
        if (attempt === maxAttempts) {
          throw new Error(
            `Failed to get valid token after ${maxAttempts} attempts. API returned invalid token repeatedly.`
          )
        }
        // Wait with exponential backoff before retry (forces timestamp change)
        const delay = 1200 * attempt
        logger.info(`[BaseWmsAdapter] Token invalid, waiting ${delay}ms before retry (to force timestamp change)...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw new Error(`Failed to get valid token after ${maxAttempts} attempts`)
  }

  /**
   * Test if a token is valid by making a lightweight API call
   * Default implementation returns true (no validation)
   * Vendors can override this to implement specific token validation
   * @param token - Token to test
   * @returns true if token is valid, false if token is invalid (401/403)
   */
  protected async testToken(token: string): Promise<boolean> {
    // Default implementation: no validation
    // Vendors can override this to test token with a lightweight API call
    return true
  }

  /**
   * Fetch token directly from API (bypasses DB check)
   * This is used by authenticate() and UnauthorizedHandler
   * Each adapter must implement this to fetch token from their specific API
   */
  protected abstract fetchTokenFromApi(): Promise<{
    token: string
    expiresAt: Date
    metadata?: Record<string, any>
  }>

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

  /**
   * Extract Authorization header from RequestInit headers
   * Handles Headers object, plain object, string array, and undefined
   */
  private extractAuthHeader(headers: HeadersInit | undefined): string | null {
    if (!headers) return null
    
    // Handle Headers object
    if (headers instanceof Headers) {
      return headers.get('Authorization') || headers.get('authorization')
    }
    
    // Handle string array (string[][])
    if (Array.isArray(headers)) {
      const authEntry = headers.find(([key]) => 
        key.toLowerCase() === 'authorization'
      )
      return authEntry ? authEntry[1] : null
    }
    
    // Handle plain object (Record<string, string>)
    if (typeof headers === 'object') {
      return (headers as Record<string, string>)['Authorization'] || 
             (headers as Record<string, string>)['authorization'] || 
             null
    }
    
    return null
  }

  /**
   * Extract token from Authorization header value
   * Handles "Bearer <token>", "bearer <token>", and edge cases
   */
  private extractTokenFromHeader(authHeader: string): string | null {
    if (!authHeader || typeof authHeader !== 'string') return null
    
    // Normalize: trim and handle case-insensitive "Bearer"
    const normalized = authHeader.trim()
    const bearerPrefix = 'bearer '
    
    if (normalized.toLowerCase().startsWith(bearerPrefix)) {
      const token = normalized.substring(bearerPrefix.length).trim()
      // Validate token is not empty
      if (token.length > 0) {
        return token
      }
    }
    
    return null
  }

  /**
   * Normalize headers to a plain object for consistent handling
   */
  private normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
    const normalized: Record<string, string> = {}
    
    if (!headers) return normalized
    
    // Handle Headers object
    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        normalized[key] = value
      })
      return normalized
    }
    
    // Handle string array (string[][])
    if (Array.isArray(headers)) {
      headers.forEach(([key, value]) => {
        normalized[key] = value
      })
      return normalized
    }
    
    // Handle plain object
    if (typeof headers === 'object') {
      return { ...headers as Record<string, string> }
    }
    
    return normalized
  }

  protected async fetchWithAuth(
    endpoint: string,
    options: RequestInit = {},
    retryOn401: boolean = true
  ): Promise<Response> {
    // Check if Authorization header is already provided (e.g., from retry with explicit token)
    let token: string
    const existingAuthHeader = this.extractAuthHeader(options.headers)
    const extractedToken = existingAuthHeader ? this.extractTokenFromHeader(existingAuthHeader) : null
    
    if (extractedToken) {
      // Use token from provided Authorization header
      token = extractedToken
      logger.info(`[BaseWmsAdapter] Using token from provided Authorization header (full): ${token}`)
    } else {
      // No valid token provided, authenticate to get one
      token = await this.authenticate()
      logger.info(`[BaseWmsAdapter] Using token from authenticate() (full): ${token}`)
    }
    
    // Validate token is not empty
    if (!token || token.trim().length === 0) {
      throw new Error('[BaseWmsAdapter] Invalid token: token is empty')
    }
    
    const url = `${this.getApiBaseUrl()}${endpoint}`
    
    // Import logger dynamically to avoid circular dependencies
    const method = (options.method || "GET").toUpperCase()
    
    logger.info(`[BaseWmsAdapter] Making authenticated API call: ${method} ${url}`)
    if (options.body) {
      logger.info(`[BaseWmsAdapter] Request body: ${typeof options.body === 'string' ? options.body : JSON.stringify(options.body)}`)
    }
    
    // Normalize headers to plain object for consistent merging
    const normalizedHeaders = this.normalizeHeaders(options.headers)
    
    const requestStartTime = Date.now()
    const response = await pooledFetch(url, {
      ...options,
      headers: {
        ...normalizedHeaders,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    const requestDuration = Date.now() - requestStartTime
    logger.info(`[BaseWmsAdapter] API call completed: ${response.status} ${response.statusText} (${requestDuration}ms)`)
    
    // Log response headers for debugging
    logger.info(`[BaseWmsAdapter] Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`)
    
    // Clone response to read body for logging without consuming the original
    // This allows the caller to still read the response body
    try {
      const responseClone = response.clone()
      const responseBody = await responseClone.text()
      logger.info(`[BaseWmsAdapter] Response body (full): ${responseBody}`)
      
      // Try to parse as JSON for better readability (only if body is not empty)
      if (responseBody && responseBody.trim().length > 0) {
        try {
          const jsonBody = JSON.parse(responseBody)
          logger.info(`[BaseWmsAdapter] Response body (parsed JSON): ${JSON.stringify(jsonBody, null, 2)}`)
        } catch {
          // Not JSON, that's fine - already logged as text
          logger.debug(`[BaseWmsAdapter] Response body is not valid JSON`)
        }
      } else {
        logger.info(`[BaseWmsAdapter] Response body is empty`)
      }
    } catch (error) {
      logger.warn(`[BaseWmsAdapter] Could not read/clone response body for logging: ${error}`)
      // Continue - original response is still usable
    }

    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401 && retryOn401) {
      // Log response body for debugging
      let responseBody = ""
      try {
        responseBody = await response.clone().text()
        logger.warn(`[BaseWmsAdapter] Received 401 Unauthorized for ${method} ${url}`)
        logger.warn(`[BaseWmsAdapter] 401 Response body: ${responseBody}`)
        logger.warn(`[BaseWmsAdapter] 401 Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`)
      } catch (error) {
        logger.warn(`[BaseWmsAdapter] Could not read 401 response body:`, error)
      }

      // Use UnauthorizedHandler to handle 401
      // The old token is already in scope (from the failed request)
      if (!this.unauthorizedHandler) {
        logger.error(`[BaseWmsAdapter] UnauthorizedHandler not initialized. Cannot handle 401.`)
        throw new Error("UnauthorizedHandler not initialized")
      }

      logger.info(`[BaseWmsAdapter] Handling 401 with UnauthorizedHandler...`)
      const newToken = await this.unauthorizedHandler.handle401(token, () => this.getValidToken())

      // Retry the request once with new token
      logger.info(`[BaseWmsAdapter] Retrying API call with fresh token: ${method} ${url}`)
      
      // Normalize headers to ensure consistent handling
      const normalizedRetryHeaders = this.normalizeHeaders(options.headers)
      
      const retryResponse = await this.fetchWithAuth(endpoint, {
        ...options,
        headers: {
          ...normalizedRetryHeaders,
          Authorization: `Bearer ${newToken}`,
          "Content-Type": "application/json",
        },
      }, false) // Don't retry again to prevent infinite loops
      
      logger.info(`[BaseWmsAdapter] Retry response status: ${retryResponse.status} ${retryResponse.statusText}`)
      if (!retryResponse.ok) {
        let retryResponseBody = ""
        try {
          retryResponseBody = await retryResponse.clone().text()
          logger.error(`[BaseWmsAdapter] Retry failed with ${retryResponse.status}: ${retryResponseBody}`)
        } catch (error) {
          logger.error(`[BaseWmsAdapter] Could not read retry response body:`, error)
        }
      }
      
      return retryResponse
    }

    return response
  }
}

