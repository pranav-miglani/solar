import { BaseVendorAdapter } from "./baseVendorAdapter"
import type {
  Plant,
  TelemetryData,
  Alert,
  RealtimeData,
  VendorConfig,
} from "./types"

interface SolarmanAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface SolarmanStation {
  stationId: number
  stationName: string
  capacity: number
  location?: {
    latitude?: number
    longitude?: number
    address?: string
  }
}

interface SolarmanStationListResponse {
  data: SolarmanStation[]
  success: boolean
}

interface SolarmanRealtimeResponse {
  data: {
    stationId: number
    currentPower: number
    todayEnergy: number
    totalEnergy: number
    voltage?: number
    current?: number
    temperature?: number
    [key: string]: any
  }
  success: boolean
}

interface SolarmanAlert {
  alertId: string
  stationId: number
  alertType: string
  alertLevel: number
  message: string
  timestamp: string
  [key: string]: any
}

interface SolarmanAlertsResponse {
  data: SolarmanAlert[]
  success: boolean
}

interface SolarmanTelemetryResponse {
  data: Array<{
    timestamp: string
    power: number
    voltage?: number
    current?: number
    temperature?: number
    [key: string]: any
  }>
  success: boolean
}

export class SolarmanAdapter extends BaseVendorAdapter {
  private vendorId?: number
  private supabaseClient?: any // Supabase client for token storage

  /**
   * Set vendor ID and Supabase client for token storage
   * Note: Tokens are stored in DB only, not cached in memory
   */
  setTokenStorage(vendorId: number, supabaseClient: any) {
    this.vendorId = vendorId
    this.supabaseClient = supabaseClient
  }

  /**
   * Logged fetch adapter - logs all requests and responses to Solarman API
   * This wraps the native fetch to provide comprehensive logging
   */
  private async loggedFetch(
    url: string,
    options: RequestInit = {},
    context?: { operation?: string; description?: string }
  ): Promise<Response> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const operation = context?.operation || 'API_CALL'
    const description = context?.description || 'Solarman API request'

    // Log request details
    const requestLog: any = {
      requestId,
      operation,
      description,
      method: options.method || 'GET',
      url,
      timestamp: new Date().toISOString(),
    }

    // Log headers (sanitize sensitive data)
    const headers: Record<string, string> = {}
    if (options.headers) {
      const headerEntries = options.headers instanceof Headers
        ? Array.from(options.headers.entries())
        : Object.entries(options.headers as Record<string, string>)
      
      headerEntries.forEach(([key, value]) => {
        // Sanitize authorization header
        if (key.toLowerCase() === 'authorization') {
          headers[key] = value ? `${value.substring(0, 20)}...` : 'N/A'
        } else {
          headers[key] = value
        }
      })
    }
    requestLog.headers = headers

    // Log request body (if present)
    if (options.body) {
      try {
        if (typeof options.body === 'string') {
          requestLog.body = JSON.parse(options.body)
        } else {
          requestLog.body = options.body
        }
      } catch {
        requestLog.body = '[Unable to parse body]'
      }
    }

    console.log(`📤 [Solarman API Request] ${requestId}`, JSON.stringify(requestLog, null, 2))

    const startTime = Date.now()

    try {
      // Make the actual fetch call
      const response = await fetch(url, options)
      const duration = Date.now() - startTime

      // Clone response to read body without consuming it
      const responseClone = response.clone()
      let responseBody: any = null
      let responseBodyText: string | null = null

      try {
        responseBodyText = await responseClone.text()
        if (responseBodyText) {
          try {
            responseBody = JSON.parse(responseBodyText)
          } catch {
            responseBody = responseBodyText
          }
        }
      } catch (error) {
        responseBody = '[Unable to read response body]'
      }

      // Log response details
      const responseLog: any = {
        requestId,
        operation,
        description,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      }

      // Log response headers
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })
      responseLog.headers = responseHeaders

      // Log response body (truncate if too large)
      if (responseBody) {
        const bodyStr = typeof responseBody === 'string' 
          ? responseBody 
          : JSON.stringify(responseBody, null, 2)
        
        if (bodyStr.length > 10000) {
          responseLog.body = bodyStr.substring(0, 10000) + '...[truncated]'
          responseLog.bodySize = bodyStr.length
        } else {
          responseLog.body = responseBody
        }
      }

      if (response.ok) {
        console.log(`✅ [Solarman API Response] ${requestId}`, JSON.stringify(responseLog, null, 2))
      } else {
        console.error(`❌ [Solarman API Error Response] ${requestId}`, JSON.stringify(responseLog, null, 2))
      }

      return response
    } catch (error: any) {
      const duration = Date.now() - startTime
      const errorLog = {
        requestId,
        operation,
        description,
        error: error.message || String(error),
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      }
      console.error(`💥 [Solarman API Exception] ${requestId}`, JSON.stringify(errorLog, null, 2))
      throw error
    }
  }

  /**
   * Get PRO API base URL from environment variables
   * Uses SOLARMAN_PRO_API_BASE_URL if set, otherwise converts SOLARMAN_API_BASE_URL to PRO URL
   * Returns the URL and a flag indicating if it was explicitly set or auto-converted
   */
  private getProApiBaseUrl(): { url: string; isExplicit: boolean } {
    // First try PRO API base URL
    const proApiUrl = process.env.SOLARMAN_PRO_API_BASE_URL
    if (proApiUrl) {
      console.log('🔵 [Solarman] Using PRO API base URL from SOLARMAN_PRO_API_BASE_URL:', proApiUrl)
      return { url: proApiUrl, isExplicit: true }
    }
    
    // If not set, convert regular API base URL to PRO URL
    const regularApiUrl = this.getApiBaseUrl()
    if (regularApiUrl.includes('globalapi')) {
      const convertedUrl = regularApiUrl.replace('globalapi', 'globalpro')
      console.log('🟡 [Solarman] PRO API base URL not set, auto-converting from regular API:', regularApiUrl, '→', convertedUrl)
      return { url: convertedUrl, isExplicit: false }
    }
    
    // If already globalpro, return as is
    if (regularApiUrl.includes('globalpro')) {
      console.log('🟡 [Solarman] Using regular API URL (already globalpro):', regularApiUrl)
      return { url: regularApiUrl, isExplicit: false }
    }
    
    // Default fallback
    console.log('🟠 [Solarman] Using default PRO API base URL:', 'https://globalpro.solarmanpv.com')
    return { url: 'https://globalpro.solarmanpv.com', isExplicit: false }
  }

  /**
   * Decode JWT token to check expiry (if token is JWT format)
   * Returns expiry timestamp in milliseconds, or null if not a JWT
   */
  private decodeJWTExpiry(token: string): number | null {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        // Not a JWT, return null
        return null
      }
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
      if (payload.exp) {
        // JWT expiry is in seconds, convert to milliseconds
        return payload.exp * 1000
      }
      return null
    } catch {
      // Not a valid JWT or can't decode
      return null
    }
  }

  /**
   * Check if token from DB is still valid
   */
  private async getTokenFromDB(): Promise<string | null> {
    if (!this.vendorId || !this.supabaseClient) {
      return null
    }

    try {
      const { data: vendor, error } = await this.supabaseClient
        .from('vendors')
        .select('access_token, token_expires_at')
        .eq('id', this.vendorId)
        .single()

      if (error || !vendor || !vendor.access_token) {
        return null
      }

      // Check if token is expired
      if (vendor.token_expires_at) {
        const expiresAt = new Date(vendor.token_expires_at).getTime()
        // Add 5 minute buffer for safety
        if (expiresAt > Date.now() + 5 * 60 * 1000) {
          return vendor.access_token
        }
      } else {
        // If no expiry stored, try to decode JWT
        const jwtExpiry = this.decodeJWTExpiry(vendor.access_token)
        if (jwtExpiry && jwtExpiry > Date.now() + 5 * 60 * 1000) {
          return vendor.access_token
        }
      }

      return null
    } catch (error) {
      console.error('Error fetching token from DB:', error)
      return null
    }
  }

  /**
   * Store token in database
   */
  private async storeTokenInDB(token: string, expiresIn: number, refreshToken?: string): Promise<void> {
    if (!this.vendorId || !this.supabaseClient) {
      return
    }

    try {
      // Calculate expiry timestamp (expiresIn is in seconds)
      const expiresAt = new Date(Date.now() + expiresIn * 1000)
      
      // Also try to decode JWT expiry if it's a JWT
      const jwtExpiry = this.decodeJWTExpiry(token)
      const finalExpiresAt = jwtExpiry ? new Date(jwtExpiry) : expiresAt

      const updateData: any = {
        access_token: token,
        token_expires_at: finalExpiresAt.toISOString(),
        token_metadata: {
          expires_in: expiresIn,
          stored_at: new Date().toISOString(),
        },
      }

      if (refreshToken) {
        updateData.refresh_token = refreshToken
      }

      await this.supabaseClient
        .from('vendors')
        .update(updateData)
        .eq('id', this.vendorId)
    } catch (error) {
      console.error('Error storing token in DB:', error)
      // Don't throw - token caching is optional
    }
  }

  async authenticate(): Promise<string> {
    // Check database for stored token (no in-memory cache - always fetch from DB)
    const dbToken = await this.getTokenFromDB()
    if (dbToken) {
      // Verify token is still valid by checking expiry
      const jwtExpiry = this.decodeJWTExpiry(dbToken)
      if (jwtExpiry && jwtExpiry > Date.now()) {
        return dbToken
      }
      // Token expired, will need to re-authenticate
    }

    // Need to authenticate
    const credentials = this.getCredentials() as {
      appId: string
      appSecret: string
      username: string
      password?: string
      passwordSha256?: string
      solarmanOrgId?: number // Optional Solarman orgId (not our organization ID)
      orgId?: number // Alternative name
    }

    // Build request body according to SOLARMAN_DOC.md
    const requestBody: any = {
      appSecret: credentials.appSecret,
      username: credentials.username,
      password: credentials.password || credentials.passwordSha256,
    }
    console.log("[SOLARMAN] Request body:", requestBody);
    if (!requestBody.password) {
      throw new Error('Solarman authentication failed: Password or passwordSha256 is required')
    }

    // Add orgId if provided (for org-scoped login)
    // Check both solarmanOrgId and orgId for compatibility
    const orgId = credentials.solarmanOrgId || credentials.orgId
    if (orgId) {
      requestBody.orgId = orgId
    }

    // Ensure we use the correct base URL (globalapi, not globalpro for auth)
    // Authentication endpoint is always on globalapi.solarmanpv.com
    let authBaseUrl = this.getApiBaseUrl()
    
    // Replace globalpro with globalapi for authentication
    if (authBaseUrl.includes('globalpro')) {
      authBaseUrl = authBaseUrl.replace('globalpro', 'globalapi')
    }
    
    // Extract just the domain (remove any paths)
    const urlObj = new URL(authBaseUrl)
    const baseDomain = `${urlObj.protocol}//${urlObj.host}`
    
    // appId goes in query parameter, not body
    const url = `${baseDomain}/account/v1.0/token?appId=${credentials.appId}`

    console.log('🔐 [Solarman] Authenticating with URL:', url)
    console.log('🔐 [Solarman] Request body (without password):', { ...requestBody, password: '***' })

    const response = await this.loggedFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }, {
      operation: 'AUTHENTICATE',
      description: 'Solarman authentication request',
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [Solarman] Auth failed:', response.status, errorText)
      throw new Error(`Solarman authentication failed: ${response.statusText} - ${errorText}`)
    }

    const data: SolarmanAuthResponse = await response.json()

    if (!data.access_token) {
      throw new Error('Solarman authentication failed: No access token in response')
    }

    // Store token in database only (no in-memory cache)
    await this.storeTokenInDB(data.access_token, data.expires_in || 3600)

    return data.access_token
  }

  async listPlants(): Promise<Plant[]> {
    const token = await this.authenticate()
    
    // Always use PRO API (converts regular API URL to PRO if needed)
    const { url: proApiUrl, isExplicit } = this.getProApiBaseUrl()
    
    if (isExplicit) {
      console.log('✅ [Solarman] PRO API explicitly configured - using PRO API endpoint')
    } else {
      console.log('⚠️ [Solarman] PRO API not explicitly configured - auto-converted to PRO API endpoint')
    }
    
    console.log('📊 [Solarman] Fetching plants from PRO API:', proApiUrl)
    return await this.listPlantsFromProApi(token, proApiUrl)
  }

  /**
   * Fetch plants from Solarman PRO API (v2/search endpoint)
   * Returns richer data including generationValue, generationTotal, etc.
   */
  private async listPlantsFromProApi(token: string, proApiBaseUrl: string): Promise<Plant[]> {
    const url = `${proApiBaseUrl}/maintain-s/operating/station/v2/search`
    
    // PRO API request body
    const requestBody = {
      station: {
        powerTypeList: ["PV"] // Filter for PV (solar) stations
      }
    }

    console.log('🚀 [Solarman PRO API] Triggered - Endpoint:', url)
    console.log('🚀 [Solarman PRO API] Request body:', JSON.stringify(requestBody, null, 2))

    const response = await this.loggedFetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    }, {
      operation: 'LIST_PLANTS_PRO_API',
      description: 'Fetch plants from Solarman PRO API',
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ [Solarman PRO API] Request failed:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: url,
      })
      throw new Error(`Failed to fetch stations from PRO API: ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()

    // PRO API response format: { total: number, data: Array<{ station: {...}, tags: [], ... }> }
    if (!data.data || !Array.isArray(data.data)) {
      console.error('❌ [Solarman PRO API] Invalid response format:', JSON.stringify(data, null, 2))
      throw new Error("Invalid response format from Solarman PRO API - expected data array")
    }

    const total = data.total || 0
    console.log(`✅ [Solarman PRO API] Successfully fetched data - Total stations: ${total}`)

    // Extract stations from nested structure
    const allStations = data.data.map((item: any) => item.station).filter((s: any) => s !== undefined)
    console.log(`✅ [Solarman PRO API] Processed ${allStations.length} stations from response`)

    // Map stations to Plant format
    return allStations.map((station: any) => {
      // Extract station ID and name
      const stationId = station.id
      const stationName = station.name || `Station ${stationId}`
      
      // Capacity is already in kW (installedCapacity field)
      const capacityKw = station.installedCapacity || 0
      
      // Handle location - fields are separate (locationLat, locationLng, locationAddress)
      let location: any = undefined
      const locationAddress = station.locationAddress || null
      if (station.locationLat || station.locationLng || locationAddress) {
        location = {
          lat: station.locationLat,
          lng: station.locationLng,
          address: locationAddress,
        }
      }

      // Extract production metrics from PRO API response
      // generationPower is in W, convert to kW
      const currentPowerKw = station.generationPower ? station.generationPower / 1000 : null
      
      // PRO API provides richer energy data
      // generationValue: daily energy (kWh), convert to MWh
      const dailyEnergyMwh = station.generationValue ? station.generationValue / 1000 : null
      
      // generationMonth: monthly energy (kWh), convert to MWh
      const monthlyEnergyMwh = station.generationMonth ? station.generationMonth / 1000 : null
      
      // generationYear: yearly energy (kWh), convert to MWh
      const yearlyEnergyMwh = station.generationYear ? station.generationYear / 1000 : null
      
      // generationTotal: total energy (kWh), convert to MWh
      const totalEnergyMwh = station.generationTotal ? station.generationTotal / 1000 : null
      
      // Performance Ratio: PRO API may have prYesterday, or we can calculate from generationCapacity
      // PR = (Actual Generation / Expected Generation) where Expected = Capacity * Hours * Efficiency
      // For now, use prYesterday if available, otherwise null (will be calculated elsewhere if needed)
      const performanceRatio = station.prYesterday !== null && station.prYesterday !== undefined 
        ? station.prYesterday 
        : (station.generationCapacity !== null && station.generationCapacity !== undefined && station.installedCapacity > 0
          ? station.generationCapacity / station.installedCapacity
          : null)
      
      // lastUpdateTime is Unix timestamp (seconds), convert to ISO string
      // PRO API returns as float (e.g., 1763468017.000000000)
      const lastUpdateTime = station.lastUpdateTime 
        ? new Date(Math.floor(station.lastUpdateTime) * 1000).toISOString() 
        : null

      // createdDate is Unix timestamp (seconds), convert to ISO string
      // PRO API returns as float
      const createdDate = station.createdDate
        ? new Date(Math.floor(station.createdDate) * 1000).toISOString()
        : null

      // startOperatingTime is Unix timestamp (seconds), convert to ISO string
      // PRO API returns as float
      const startOperatingTime = station.startOperatingTime
        ? new Date(Math.floor(station.startOperatingTime) * 1000).toISOString()
        : null

      return {
        id: stationId.toString(),
        name: stationName,
        capacityKw: capacityKw,
        location: location,
        metadata: {
          stationId: stationId,
          // Production metrics from PRO API (richer data)
          currentPowerKw: currentPowerKw, // Converted from W to kW
          dailyEnergyMwh: dailyEnergyMwh, // From generationValue (kWh -> MWh)
          monthlyEnergyMwh: monthlyEnergyMwh, // From generationMonth (kWh -> MWh)
          yearlyEnergyMwh: yearlyEnergyMwh, // From generationYear (kWh -> MWh)
          totalEnergyMwh: totalEnergyMwh, // From generationTotal (kWh -> MWh)
          performanceRatio: performanceRatio, // From prYesterday or calculated from generationCapacity
          // Additional PRO API fields
          fullPowerHoursDay: station.fullPowerHoursDay || null,
          generationCapacity: station.generationCapacity || null,
          usePower: station.usePower || null,
          useMonth: station.useMonth || null,
          useYear: station.useYear || null,
          useTotal: station.useTotal || null,
          powerType: station.powerType || null,
          system: station.system || null,
          lastUpdateTime: lastUpdateTime,
          // Additional station metadata - these are refreshed on every sync
          // Normalize networkStatus by trimming whitespace (Solarman may return ' ALL_OFFLINE' with leading space)
          networkStatus: station.networkStatus ? String(station.networkStatus).trim() : null,
          type: station.type,
          contactPhone: station.contactPhone || null,
          locationAddress: locationAddress, // For sync route compatibility (must always be refreshed)
          gridInterconnectionType: station.gridInterconnectionType,
          regionTimezone: station.regionTimezone,
          startOperatingTime: startOperatingTime, // Already converted to ISO string
          createdDate: createdDate, // Already converted to ISO string
          // Include other fields but exclude raw timestamps to avoid confusion
          regionLevel1: station.regionLevel1,
          regionLevel2: station.regionLevel2,
          regionLevel3: station.regionLevel3,
          regionLevel4: station.regionLevel4,
          regionLevel5: station.regionLevel5,
          regionNationId: station.regionNationId,
          installationAzimuthAngle: station.installationAzimuthAngle,
          installationTiltAngle: station.installationTiltAngle,
          businessWarningStatus: station.businessWarningStatus,
          consumerWarningStatus: station.consumerWarningStatus,
          operating: station.operating,
        },
      }
    })
  }

  /**
   * Fetch plants from Solarman regular API (v1.0/list endpoint)
   * Fallback when PRO API is not available
   */
  private async listPlantsFromRegularApi(token: string): Promise<Plant[]> {
    // Get base URL and ensure we use globalapi for /station/v1.0/list endpoint
    let baseUrl = this.getApiBaseUrl()
    
    // /station/v1.0/list endpoint is always on globalapi, not globalpro
    if (baseUrl.includes('globalpro')) {
      baseUrl = baseUrl.replace('globalpro', 'globalapi')
    }
    
    // Extract just the domain (remove any paths)
    const urlObj = new URL(baseUrl)
    const apiBaseUrl = `${urlObj.protocol}//${urlObj.host}`
    
    const url = `${apiBaseUrl}/station/v1.0/list`
    const pageSize = 100 // Maximum page size
    let allStations: any[] = []
    let currentPage = 1
    let total = 0
    let hasMore = true

    console.log('📊 [Solarman] Starting paginated fetch from:', url)

    // Fetch all pages
    while (hasMore) {
      const requestBody = {
        page: currentPage,
        size: pageSize,
      }
      
      console.log(`📊 [Solarman] Fetching page ${currentPage} with size ${pageSize}`)
      
      const response = await this.loggedFetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }, {
        operation: 'LIST_PLANTS_REGULAR_API',
        description: `Fetch plants from Solarman regular API (page ${currentPage})`,
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ [Solarman] Failed to fetch page ${currentPage}:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        })
        throw new Error(`Failed to fetch stations: ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      
      // Handle different response formats
      if (data.success === false) {
        throw new Error(`Failed to fetch stations from Solarman: ${data.msg || data.message || 'Unknown error'}`)
      }

      // Check if stationList exists and is an array
      if (!data.stationList || !Array.isArray(data.stationList)) {
        console.error('❌ [Solarman] Invalid response format:', data)
        throw new Error("Invalid response format from Solarman API - expected stationList array")
      }

      // Get total from first page
      if (currentPage === 1) {
        total = data.total || 0
        console.log(`📊 [Solarman] Total stations available: ${total}`)
      }

      // Add stations from this page
      allStations = allStations.concat(data.stationList)
      console.log(`📊 [Solarman] Page ${currentPage}: Fetched ${data.stationList.length} stations (Total so far: ${allStations.length}/${total})`)

      // Check if we need to fetch more pages
      // If we got fewer stations than requested, or we've fetched all stations, we're done
      if (data.stationList.length < pageSize || allStations.length >= total) {
        hasMore = false
      } else {
        currentPage++
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`✅ [Solarman] Completed fetching all stations: ${allStations.length} total`)

    // Map stations to Plant format
    return allStations.map((station: any) => {
      // Extract station ID and name
      const stationId = station.id
      const stationName = station.name || `Station ${stationId}`
      
      // Capacity is already in kW (installedCapacity field)
      const capacityKw = station.installedCapacity || 0
      
      // Handle location - fields are separate (locationLat, locationLng, locationAddress)
      let location: any = undefined
      if (station.locationLat || station.locationLng || station.locationAddress) {
        location = {
          lat: station.locationLat,
          lng: station.locationLng,
          address: station.locationAddress,
        }
      }

      // Extract production metrics from response
      // generationPower is in W, convert to kW
      const currentPowerKw = station.generationPower ? station.generationPower / 1000 : null
      
      // lastUpdateTime is Unix timestamp (seconds), convert to ISO string
      const lastUpdateTime = station.lastUpdateTime 
        ? new Date(station.lastUpdateTime * 1000).toISOString() 
        : null

      // createdDate is Unix timestamp (seconds), convert to ISO string
      const createdDate = station.createdDate
        ? new Date(station.createdDate * 1000).toISOString()
        : null

      // startOperatingTime is Unix timestamp (seconds), convert to ISO string
      const startOperatingTime = station.startOperatingTime
        ? new Date(station.startOperatingTime * 1000).toISOString()
        : null

      return {
        id: stationId.toString(),
        name: stationName,
        capacityKw: capacityKw,
        location: location,
        metadata: {
          stationId: stationId,
          // Production metrics (only those shown in Production Overview dashboard)
          currentPowerKw: currentPowerKw, // Converted from W to kW
          // Note: Daily/Monthly/Yearly/Total energy and PR not available in /station/v1.0/list
          // These would need to be fetched from other endpoints if needed
          lastUpdateTime: lastUpdateTime,
          // Additional station metadata - these are refreshed on every sync
          // Normalize networkStatus by trimming whitespace (Solarman may return ' ALL_OFFLINE' with leading space)
          networkStatus: station.networkStatus ? String(station.networkStatus).trim() : null,
          type: station.type,
          contactPhone: station.contactPhone || null,
          gridInterconnectionType: station.gridInterconnectionType,
          regionTimezone: station.regionTimezone,
          startOperatingTime: startOperatingTime, // Already converted to ISO string
          createdDate: createdDate, // Already converted to ISO string
          // Include other fields but exclude raw timestamps to avoid confusion
          regionLevel1: station.regionLevel1,
          regionLevel2: station.regionLevel2,
          regionLevel3: station.regionLevel3,
          regionLevel4: station.regionLevel4,
          regionLevel5: station.regionLevel5,
          regionNationId: station.regionNationId,
          batterySoc: station.batterySoc,
          ownerName: station.ownerName,
          stationImage: station.stationImage,
        },
      }
    })
  }

  async getTelemetry(
    plantId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TelemetryData[]> {
    const token = await this.authenticate()
    
    // According to SOLARMAN_DOC.md, historical data uses /device/v1.0/historical
    // But we need deviceId, not stationId. This method signature might need adjustment.
    // For now, we'll use the station-based approach if available, or device-based if we have deviceId
    
    // Format dates as YYYY-MM-DD for Solarman API
    const startDate = startTime.toISOString().split('T')[0]
    const endDate = endTime.toISOString().split('T')[0]

    // Note: This endpoint requires deviceId, not stationId
    // We may need to get devices first, then fetch historical data per device
    // For now, this is a placeholder that would need deviceId
    throw new Error("getTelemetry requires deviceId. Use getDeviceTelemetry(deviceId, ...) instead.")
  }

  async getDeviceTelemetry(
    deviceId: number,
    startTime: Date,
    endTime: Date,
    timeType: 1 | 2 | 3 | 4 = 1 // 1=frame, 2=daily, 3=monthly, 4=yearly
  ): Promise<TelemetryData[]> {
    const token = await this.authenticate()
    
    const startDate = startTime.toISOString().split('T')[0]
    const endDate = endTime.toISOString().split('T')[0]

    const response = await this.loggedFetch(
      `${this.getApiBaseUrl()}/device/v1.0/historical`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deviceId,
          startTime: startDate,
          endTime: endDate,
          timeType,
        }),
      },
      {
        operation: 'GET_TELEMETRY',
        description: `Get historical telemetry for device ${deviceId}`,
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch telemetry: ${response.statusText}`)
    }

    const data = await response.json()

    // Transform Solarman historical response to our format
    const telemetryData: TelemetryData[] = []
    
    if (data.paramDataList) {
      for (const paramData of data.paramDataList) {
        const timestamp = new Date(paramData.collectTime)
        const metrics: any = {}
        
        if (paramData.dataList) {
          for (const item of paramData.dataList) {
            // Map Solarman keys to normalized keys
            const normalizedKey = this.normalizeDataKey(item.key)
            metrics[normalizedKey] = parseFloat(item.value) || 0
          }
        }

        telemetryData.push({
          plantId: deviceId.toString(), // Using deviceId as plantId for now
          timestamp,
          generationPowerKw: metrics.power_ac_w ? metrics.power_ac_w / 1000 : 0,
          voltage: metrics.voltage_v_phase_1,
          current: metrics.current_a_phase_1,
          temperature: metrics.temperature_c,
          metadata: {
            ...metrics,
            raw: paramData,
          },
        })
      }
    }

    return telemetryData
  }

  private normalizeDataKey(solarmanKey: string): string {
    // Map Solarman keys to normalized keys per SOLARMAN_DOC.md section 6
    const keyMap: Record<string, string> = {
      APo_t1: "power_ac_w",
      P_PV: "power_dc_w",
      Et_ge0: "energy_total_kwh",
      Etdy_ge1: "energy_today_kwh",
      INV_T0: "temperature_c",
      INV_ST1: "device_status_raw",
      "t_w_hou1": "running_hours_h",
      AV1: "voltage_v_phase_1",
      AV2: "voltage_v_phase_2",
      AV3: "voltage_v_phase_3",
      AC1: "current_a_phase_1",
      AC2: "current_a_phase_2",
      AC3: "current_a_phase_3",
      PF0: "power_factor",
    }
    return keyMap[solarmanKey] || solarmanKey
  }

  async getRealtime(plantId: string): Promise<RealtimeData> {
    // Note: According to SOLARMAN_DOC.md, realtime data uses /device/v1.0/currentData
    // which requires deviceId or deviceSn, not stationId
    // This method signature might need to be updated to use deviceId
    throw new Error("getRealtime requires deviceId. Use getDeviceRealtime(deviceId) instead.")
  }

  async getDeviceRealtime(deviceId: number | string): Promise<RealtimeData> {
    const token = await this.authenticate()
    
    const requestBody: any = {}
    if (typeof deviceId === "number") {
      requestBody.deviceId = deviceId
    } else {
      requestBody.deviceSn = deviceId
    }

    const response = await this.loggedFetch(
      `${this.getApiBaseUrl()}/device/v1.0/currentData`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
      {
        operation: 'GET_REALTIME',
        description: `Get realtime data for device ${deviceId}`,
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch realtime: ${response.statusText}`)
    }

    const data = await response.json()

    // Normalize the dataList keys
    const normalizedData: any = {}
    if (data.dataList) {
      for (const item of data.dataList) {
        const normalizedKey = this.normalizeDataKey(item.key)
        normalizedData[normalizedKey] = {
          value: parseFloat(item.value) || 0,
          unit: item.unit,
          name: item.name,
          raw: item,
        }
      }
    }

    return {
      plantId: data.deviceId?.toString() || data.deviceSn || "",
      timestamp: new Date(data.collectionTime * 1000),
      data: {
        ...normalizedData,
        deviceId: data.deviceId,
        deviceSn: data.deviceSn,
        connectStatus: data.connectStatus,
        raw: data,
      },
    }
  }

  async getAlerts(plantId: string): Promise<Alert[]> {
    // Note: According to SOLARMAN_DOC.md, alerts use /device/v1.0/alertList
    // which requires deviceId, not stationId
    throw new Error("getAlerts requires deviceId. Use getDeviceAlerts(deviceId, ...) instead.")
  }

  async getDeviceAlerts(
    deviceId: number,
    startTimestamp?: number,
    endTimestamp?: number,
    page: number = 1,
    size: number = 10
  ): Promise<Alert[]> {
    const token = await this.authenticate()
    
    const requestBody: any = {
      deviceId,
      page,
      size,
    }

    if (startTimestamp) {
      requestBody.startTimestamp = startTimestamp
    }
    if (endTimestamp) {
      requestBody.endTimestamp = endTimestamp
    }

    const response = await this.loggedFetch(
      `${this.getApiBaseUrl()}/device/v1.0/alertList`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
      {
        operation: 'GET_ALERTS',
        description: `Get alerts for device ${deviceId}`,
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch alerts: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.alertList || data.alertList.length === 0) {
      return []
    }

    return data.alertList.map((alert: any) => this.normalizeAlert(alert))
  }

  protected normalizeTelemetry(rawData: any): TelemetryData {
    return {
      plantId: rawData.plantId,
      timestamp: new Date(rawData.timestamp * 1000),
      generationPowerKw: rawData.power || 0,
      voltage: rawData.voltage,
      current: rawData.current,
      temperature: rawData.temperature,
      metadata: {
        ...rawData,
      },
    }
  }

  protected normalizeAlert(rawData: any): Alert {
    // Map Solarman alert levels to our severity per SOLARMAN_DOC.md section 8
    // level: 0=Info, 1=Warning, 2=Error
    const severityMap: Record<number, Alert["severity"]> = {
      0: "LOW",      // Info
      1: "MEDIUM",   // Warning
      2: "HIGH",     // Error
    }

    // Map influence to severity if level doesn't provide enough detail
    // influence: 0=No impact, 1=Production, 2=Safety, 3=Production+Safety
    let severity = severityMap[rawData.level] || "MEDIUM"
    if (rawData.influence === 2 || rawData.influence === 3) {
      severity = "CRITICAL" // Safety impact is critical
    } else if (rawData.influence === 1 && severity === "LOW") {
      severity = "MEDIUM" // Production impact at least medium
    }

    return {
      vendorAlertId: rawData.alertId?.toString(),
      title: rawData.alertName || "Alert",
      description: rawData.description || rawData.addr || "",
      severity,
      metadata: {
        ...rawData,
        code: rawData.code,
        level: rawData.level,
        influence: rawData.influence,
        alertTime: rawData.alertTime,
      },
    }
  }

  // Helper method to get plant base information per SOLARMAN_DOC.md section 3.1
  async getPlantBaseInfo(stationId: number): Promise<Plant> {
    const token = await this.authenticate()
    
    const response = await this.loggedFetch(
      `${this.getApiBaseUrl()}/station/v1.0/base?language=en`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stationId }),
      },
      {
        operation: 'GET_PLANT_BASE_INFO',
        description: `Get base info for station ${stationId}`,
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch plant info: ${response.statusText}`)
    }

    const data = await response.json()

    return {
      id: data.stationId.toString(),
      name: data.name,
      capacityKw: data.installedCapacity ? data.installedCapacity / 1000 : 0, // Convert W to kW
      location: data.location
        ? {
            lat: parseFloat(data.location.lat),
            lng: parseFloat(data.location.lng),
            address: data.location.address,
          }
        : undefined,
      metadata: {
        stationId: data.stationId,
        startOperatingTime: data.startOperatingTime,
        ownerName: data.ownerName,
        ownerCompany: data.ownerCompany,
        picSmall: data.picSmall,
        picBig: data.picBig,
      },
    }
  }

  // Helper method to get device list per SOLARMAN_DOC.md section 3.2
  async getPlantDevices(stationId: number): Promise<any[]> {
    const token = await this.authenticate()
    
    const response = await this.loggedFetch(
      `${this.getApiBaseUrl()}/station/v1.0/device`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stationId }),
      },
      {
        operation: 'GET_PLANT_DEVICES',
        description: `Get devices for station ${stationId}`,
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch devices: ${response.statusText}`)
    }

    const devices = await response.json()

    return devices.map((device: any) => ({
      deviceId: device.deviceId,
      deviceSn: device.deviceSn,
      deviceType: device.deviceType,
      deviceState: device.deviceState,
      deviceStateText: device.deviceState === 1 ? "ONLINE" : device.deviceState === 2 ? "ALARM" : "OFFLINE",
      updateTime: device.updateTime,
    }))
  }
}

