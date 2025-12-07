import { BaseVendorAdapter } from "./baseVendorAdapter"
import type {
  Plant,
  TelemetryData,
  Alert,
  RealtimeData,
  VendorConfig,
} from "./types"
import { pooledFetch } from "./httpClient"

interface PvBlinkAuthResponse {
  data: {
    id: string
    createdOn: string
    updatedOn: string
    activeStatus: string
    firstName: string
    lastName: string
    email: string
    dealerId: string
    mobile: string
    profilePic: string
    isDealer: boolean
    accessToken: string
  }
}

interface PvBlinkPlant {
  id: string
  updatedOn: string
  name: string
  capacity: number
  totalProduction: number
  powerNormalization: number
  dailyProduction: number
  peakHoursToday: number
  alert: string
  isMapped: boolean
  dealerName: string
  noOfDevice: number
  collapse: boolean
  isOnline: boolean
  loggerVersionNo: string
  loggerId: string
  inverterId: string
}

interface PvBlinkPlantResponse {
  data: PvBlinkPlant[]
}

interface PvBlinkDailyTelemetryResponse {
  data: {
    peakHours: number
    production: number // Total daily production (kWh)
    productionData: Array<{
      production: number // Power in kW at this time point
      createdOn: number // Timestamp in milliseconds
    }>
  }
}

interface PvBlinkMonthlyTelemetryResponse {
  data: {
    peakHours: number
    production: number // Total monthly production (kWh)
    productionData: Array<{
      production: number // Daily production in kWh
      createdOn: number // Timestamp in milliseconds (start of day)
    }>
  }
}

interface PvBlinkYearlyTelemetryResponse {
  data: {
    peakHours: number
    production: number // Total yearly production (kWh)
    productionData: Array<{
      production: number // Monthly production in kWh
      createdOn: number // Timestamp in milliseconds (start of month)
    }>
  }
}

interface PvBlinkTotalTelemetryResponse {
  data: {
    peakHours: number
    production: number // Total production (kWh) for the year
    productionData: Array<{
      production: number // Yearly production in kWh
      createdOn: number // Timestamp in milliseconds (start of year)
    }>
  }
}

export class PvBlinkAdapter extends BaseVendorAdapter {
  private vendorId?: number
  private supabaseClient?: any
  private retryCount: number = 0
  private readonly MAX_RETRIES: number = 3

  /**
   * Set vendor ID and Supabase client for token storage
   */
  setTokenStorage(vendorId: number, supabaseClient: any) {
    this.vendorId = vendorId
    this.supabaseClient = supabaseClient
  }

  /**
   * Override getApiBaseUrl to use PVBlink-specific environment variable
   */
  protected getApiBaseUrl(): string {
    // First check if apiBaseUrl is provided in config
    if (this.config.apiBaseUrl) {
      return this.config.apiBaseUrl
    }
    
    // Fall back to environment variable or default
    const baseUrl = process.env.PVBLINK_API_BASE_URL || "https://cloud.pvblink.com"
    return baseUrl
  }

  /**
   * Get cached token from database
   */
  private async getTokenFromDB(): Promise<string | null> {
    if (!this.vendorId || !this.supabaseClient) {
      return null
    }

    try {
      const { data, error } = await this.supabaseClient
        .from("vendors")
        .select("access_token, token_expires_at")
        .eq("id", this.vendorId)
        .single()

      if (error || !data) {
        return null
      }

      // Check if token is expired
      if (data.token_expires_at) {
        const expiresAt = new Date(data.token_expires_at)
        if (expiresAt <= new Date()) {
          return null // Token expired
        }
      }

      return data.access_token || null
    } catch (error) {
      console.error("[PVBlink] Error getting token from DB:", error)
      return null
    }
  }

  /**
   * Store token in database
   * Default expiration: 11 hours 30 minutes (41400 seconds)
   */
  private async storeTokenInDB(
    token: string,
    expiresIn: number = 11.5 * 60 * 60 // Default: 11 hours 30 minutes
  ): Promise<void> {
    if (!this.vendorId || !this.supabaseClient) {
      return
    }

    try {
      const expiresAt = new Date(Date.now() + expiresIn * 1000)

      const updateData: any = {
        access_token: token,
        token_expires_at: expiresAt.toISOString(),
        token_metadata: {
          token_type: "Bearer",
          expires_in: expiresIn,
          stored_at: new Date().toISOString(),
        },
      }

      const { error } = await this.supabaseClient
        .from("vendors")
        .update(updateData)
        .eq("id", this.vendorId)

      if (error) {
        console.error("[PVBlink] Error storing token:", error)
      } else {
        console.log(`[PVBlink] Token stored with expiration: ${expiresAt.toISOString()}`)
      }
    } catch (error) {
      console.error("[PVBlink] Error storing token:", error)
    }
  }

  /**
   * Authenticate with PVBlink API
   * Endpoint: POST /api/pvblink/user/login
   * Implements retry logic: max 3 attempts on error
   */
  async authenticate(): Promise<string> {
    // Check for cached token first
    const cachedToken = await this.getTokenFromDB()
    if (cachedToken) {
      console.log("[PVBlink] Returning cached token")
      return cachedToken
    }

    // Reset retry count for new authentication attempt
    this.retryCount = 0

    return this.authenticateWithRetry()
  }

  /**
   * Authenticate with retry logic (max 3 attempts)
   */
  private async authenticateWithRetry(): Promise<string> {
    const credentials = this.getCredentials()
    const email = credentials.email as string
    const password = credentials.password as string

    if (!email || !password) {
      throw new Error("PVBlink credentials missing: email and password are required")
    }

    const baseUrl = this.getApiBaseUrl()
    const url = `${baseUrl}/api/pvblink/user/login`

    const requestBody = {
      email,
      password,
      confirmPassword: null,
      resetPasswordToken: null,
      rememberMe: false,
    }

    console.log("[PVBlink] Authenticating with:", url)
    console.log("[PVBlink] Attempt:", this.retryCount + 1, "of", this.MAX_RETRIES)

    try {
      const response = await pooledFetch(url, {
        method: "POST",
        headers: {
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
          "Content-Type": "application/json",
          "Origin": baseUrl,
          "Referer": `${baseUrl}/login`,
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[PVBlink] Authentication failed:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          attempt: this.retryCount + 1,
        })

        // Retry if we haven't exceeded max retries
        if (this.retryCount < this.MAX_RETRIES - 1) {
          this.retryCount++
          console.log(`[PVBlink] Retrying authentication (attempt ${this.retryCount + 1}/${this.MAX_RETRIES})...`)
          // Wait a bit before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount))
          return this.authenticateWithRetry()
        }

        throw new Error(`PVBlink authentication failed after ${this.MAX_RETRIES} attempts: ${response.statusText} - ${errorText}`)
      }

      const data: PvBlinkAuthResponse = await response.json()

      if (!data.data?.accessToken) {
        // Retry if we haven't exceeded max retries
        if (this.retryCount < this.MAX_RETRIES - 1) {
          this.retryCount++
          console.log(`[PVBlink] No accessToken in response, retrying (attempt ${this.retryCount + 1}/${this.MAX_RETRIES})...`)
          await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount))
          return this.authenticateWithRetry()
        }

        throw new Error(`PVBlink authentication failed: No accessToken in response after ${this.MAX_RETRIES} attempts`)
      }

      // Store token in database with default expiration (11 hours 30 minutes = 41400 seconds)
      const defaultExpiresIn = 11.5 * 60 * 60 // 11 hours 30 minutes in seconds
      await this.storeTokenInDB(data.data.accessToken, defaultExpiresIn)

      console.log("[PVBlink] Authentication successful")
      this.retryCount = 0 // Reset retry count on success
      return data.data.accessToken
    } catch (error: any) {
      // Retry on network errors if we haven't exceeded max retries
      if (this.retryCount < this.MAX_RETRIES - 1 && error.message?.includes("fetch")) {
        this.retryCount++
        console.log(`[PVBlink] Network error, retrying (attempt ${this.retryCount + 1}/${this.MAX_RETRIES})...`)
        await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount))
        return this.authenticateWithRetry()
      }

      // If it's already our custom error, throw it as-is
      if (error.message?.includes("PVBlink authentication failed")) {
        throw error
      }

      // Otherwise, wrap it
      throw new Error(`PVBlink authentication error: ${error.message || String(error)}`)
    }
  }

  /**
   * Get a single plant by vendor plant ID
   * Since PVBlink doesn't have a single plant endpoint, we fetch all and filter
   */
  async listPlant(vendorPlantId: string): Promise<Plant | null> {
    const allPlants = await this.listPlants()
    const plant = allPlants.find((p) => p.id === vendorPlantId)
    
    if (!plant) {
      return null
    }

    // For PVBlink, we need to fetch live telemetry separately
    // The listPlants() endpoint doesn't provide current power or energy metrics
    // So we return what we have, and live telemetry sync will need to use other endpoints
    return plant
  }

  /**
   * List all plants from PVBlink
   * Endpoint: GET /api/pvblink/plant/s/all?pageNo={pageNo}
   * Pagination: Iterates until empty data array is received
   */
  async listPlants(): Promise<Plant[]> {
    const token = await this.authenticate()
    const baseUrl = this.getApiBaseUrl()
    const url = `${baseUrl}/api/pvblink/plant/s/all`
    
    const allPlants: Plant[] = []
    let pageNo = 0
    let hasMore = true

    console.log("[PVBlink] Fetching plants from:", url)

    while (hasMore) {
      const pageUrl = `${url}?pageNo=${pageNo}`
      console.log(`[PVBlink] Fetching page ${pageNo}...`)

      const response = await pooledFetch(pageUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
          "Authorization": token,
          "Content-Type": "application/json",
          "Origin": baseUrl,
          "Referer": `${baseUrl}/app/plant`,
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[PVBlink] Failed to fetch plants (page ${pageNo}):`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        })
        throw new Error(`Failed to fetch plants from PVBlink (page ${pageNo}): ${response.statusText} - ${errorText}`)
      }

      const data: PvBlinkPlantResponse = await response.json()

      // Check if we have plants in this page
      if (!data.data || data.data.length === 0) {
        console.log(`[PVBlink] No more plants found on page ${pageNo}, stopping pagination`)
        hasMore = false
        break
      }

      console.log(`[PVBlink] Page ${pageNo}: Received ${data.data.length} plants`)

      // Map PVBlink plants to Plant format
      const mappedPlants = data.data.map((plant) => {
        // Map network status: isOnline (true = ONLINE, false = ALL_OFFLINE)
        const networkStatus = plant.isOnline ? "ONLINE" : "ALL_OFFLINE"

        return {
          id: plant.id, // vendor_plant_id
          name: plant.name,
          capacityKw: plant.capacity || 0,
          location: undefined, // Not provided in API response
          metadata: {
            updatedOn: plant.updatedOn,
            totalProduction: plant.totalProduction,
            powerNormalization: plant.powerNormalization,
            dailyProduction: plant.dailyProduction,
            peakHoursToday: plant.peakHoursToday,
            alert: plant.alert,
            isMapped: plant.isMapped,
            dealerName: plant.dealerName,
            noOfDevice: plant.noOfDevice,
            collapse: plant.collapse,
            isOnline: plant.isOnline,
            loggerVersionNo: plant.loggerVersionNo,
            loggerId: plant.loggerId,
            inverterId: plant.inverterId,
            networkStatus, // Normalized network status
          },
        }
      })

      allPlants.push(...mappedPlants)
      pageNo++
    }

    console.log(`[PVBlink] Successfully fetched ${allPlants.length} total plants across ${pageNo} pages`)
    return allPlants
  }

  /**
   * Get daily telemetry records for a specific plant
   * Endpoint: GET /api/pvblink/plant/s/production/detail/{vendorPlantId}/day?year={year}&month={month}&day={day}
   * Returns power data at 5-minute intervals for the specified day
   */
  async getDailyTelemetryRecords(
    vendorPlantId: string,
    year: number,
    month: number,
    day: number
  ): Promise<{
    statistics: {
      vendorPlantId: string
      year: number
      month: number
      day: number
      generationValue: number // Daily generation in kWh
      peakHours: number
    }
    records: Array<{
      vendorPlantId: string
      generationPower: number // Power in kW
      dateTime: number // Unix timestamp in milliseconds
      timeZoneOffset?: number
    }>
  }> {
    const token = await this.authenticate()
    const baseUrl = this.getApiBaseUrl()
    const url = `${baseUrl}/api/pvblink/plant/s/production/detail/${vendorPlantId}/day?year=${year}&month=${month}&day=${day}`

    console.log("[PVBlink] Fetching daily telemetry records:", {
      vendorPlantId,
      year,
      month,
      day,
      url,
    })

    const response = await pooledFetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
        "Authorization": token,
        "Content-Type": "application/json",
        "Origin": baseUrl,
        "Referer": `${baseUrl}/app/plant/station/dashboard?plant=${vendorPlantId}`,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[PVBlink] Failed to fetch daily telemetry:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      throw new Error(`Failed to fetch daily telemetry: ${response.statusText} - ${errorText}`)
    }

    const data: PvBlinkDailyTelemetryResponse = await response.json()

    // Map PVBlink response to standard format
    const records = (data.data.productionData || []).map((point) => ({
      vendorPlantId,
      generationPower: point.production || 0, // Power in kW
      dateTime: point.createdOn, // Timestamp in milliseconds
    }))

    return {
      statistics: {
        vendorPlantId,
        year,
        month,
        day,
        generationValue: data.data.production || 0, // Daily generation in kWh
        peakHours: data.data.peakHours || 0,
      },
      records,
    }
  }

  /**
   * Get monthly telemetry records for a specific plant
   * Endpoint: GET /api/pvblink/plant/s/production/detail/{vendorPlantId}/daily?year={year}&month={month}
   * Returns daily production data for the specified month
   */
  async getMonthlyTelemetryRecords(
    vendorPlantId: string,
    year: number,
    month: number
  ): Promise<{
    statistics: {
      vendorPlantId: string
      year: number
      month: number
      generationValue: number // Monthly generation in kWh
      peakHours: number
    }
    records: Array<{
      vendorPlantId: string
      day: number // Day of month (1-31)
      generationValue: number // Daily generation in kWh
      dateTime: number // Unix timestamp in milliseconds (start of day)
    }>
  }> {
    const token = await this.authenticate()
    const baseUrl = this.getApiBaseUrl()
    const url = `${baseUrl}/api/pvblink/plant/s/production/detail/${vendorPlantId}/daily?year=${year}&month=${month}`

    console.log("[PVBlink] Fetching monthly telemetry records:", {
      vendorPlantId,
      year,
      month,
      url,
    })

    const response = await pooledFetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
        "Authorization": token,
        "Content-Type": "application/json",
        "Origin": baseUrl,
        "Referer": `${baseUrl}/app/plant/station/dashboard?plant=${vendorPlantId}`,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[PVBlink] Failed to fetch monthly telemetry:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      throw new Error(`Failed to fetch monthly telemetry: ${response.statusText} - ${errorText}`)
    }

    const data: PvBlinkMonthlyTelemetryResponse = await response.json()

    // Map PVBlink response to standard format
    // Extract day from timestamp for each record
    const records = (data.data.productionData || []).map((point) => {
      const date = new Date(point.createdOn)
      return {
        vendorPlantId,
        day: date.getDate(), // Day of month (1-31)
        generationValue: point.production || 0, // Daily generation in kWh
        dateTime: point.createdOn, // Timestamp in milliseconds
      }
    })

    return {
      statistics: {
        vendorPlantId,
        year,
        month,
        generationValue: data.data.production || 0, // Monthly generation in kWh
        peakHours: data.data.peakHours || 0,
      },
      records,
    }
  }

  /**
   * Get yearly telemetry records for a specific plant
   * Endpoint: GET /api/pvblink/plant/s/production/detail/{vendorPlantId}/monthly?year={year}
   * Returns monthly production data for the specified year
   */
  async getYearlyTelemetryRecords(
    vendorPlantId: string,
    year: number
  ): Promise<{
    statistics: {
      vendorPlantId: string
      year: number
      generationValue: number // Yearly generation in kWh
      peakHours: number
    }
    records: Array<{
      vendorPlantId: string
      month: number // Month (1-12)
      generationValue: number // Monthly generation in kWh
      dateTime: number // Unix timestamp in milliseconds (start of month)
    }>
  }> {
    const token = await this.authenticate()
    const baseUrl = this.getApiBaseUrl()
    const url = `${baseUrl}/api/pvblink/plant/s/production/detail/${vendorPlantId}/monthly?year=${year}`

    console.log("[PVBlink] Fetching yearly telemetry records:", {
      vendorPlantId,
      year,
      url,
    })

    const response = await pooledFetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
        "Authorization": token,
        "Content-Type": "application/json",
        "Origin": baseUrl,
        "Referer": `${baseUrl}/app/plant/station/dashboard?plant=${vendorPlantId}`,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[PVBlink] Failed to fetch yearly telemetry:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      throw new Error(`Failed to fetch yearly telemetry: ${response.statusText} - ${errorText}`)
    }

    const data: PvBlinkYearlyTelemetryResponse = await response.json()

    // Map PVBlink response to standard format
    // Extract month from timestamp for each record
    const records = (data.data.productionData || []).map((point) => {
      const date = new Date(point.createdOn)
      return {
        vendorPlantId,
        month: date.getMonth() + 1, // Month (1-12)
        generationValue: point.production || 0, // Monthly generation in kWh
        dateTime: point.createdOn, // Timestamp in milliseconds
      }
    })

    return {
      statistics: {
        vendorPlantId,
        year,
        generationValue: data.data.production || 0, // Yearly generation in kWh
        peakHours: data.data.peakHours || 0,
      },
      records,
    }
  }

  /**
   * Get total telemetry records (yearly aggregation across all years)
   * Endpoint: GET /api/pvblink/plant/s/production/detail/{vendorPlantId}/yearly?year={year}
   * Since PVBlink API only supports single year queries, we fetch each year individually and aggregate
   * Returns statistics for the total period and yearly records
   */
  async getTotalTelemetryRecords(
    vendorPlantId: string,
    startYear: number,
    endYear: number
  ): Promise<{
    statistics: {
      vendorPlantId: string
      generationValue: number // Total generation in kWh across all years
      peakHours: number
    }
    records: Array<{
      vendorPlantId: string
      year: number
      generationValue: number // Yearly generation in kWh
      dateTime: number // Unix timestamp in milliseconds (start of year)
    }>
    operatingTotalDays?: number
  }> {
    const token = await this.authenticate()
    const baseUrl = this.getApiBaseUrl()
    
    console.log("[PVBlink] Fetching total telemetry records:", {
      vendorPlantId,
      startYear,
      endYear,
    })

    const allRecords: Array<{
      vendorPlantId: string
      year: number
      generationValue: number
      dateTime: number
    }> = []
    
    let totalProduction = 0
    let totalPeakHours = 0

    // Fetch data for each year from startYear to endYear
    // Note: PVBlink API /yearly endpoint may return all years up to the specified year,
    // but we'll fetch each year individually to ensure we get complete data
    for (let year = startYear; year <= endYear; year++) {
      try {
        const url = `${baseUrl}/api/pvblink/plant/s/production/detail/${vendorPlantId}/yearly?year=${year}`
        
        console.log(`[PVBlink] Fetching year ${year}...`)

        const response = await pooledFetch(url, {
          method: "GET",
          headers: {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
            "Authorization": token,
            "Content-Type": "application/json",
            "Origin": baseUrl,
            "Referer": `${baseUrl}/app/plant/station/dashboard?plant=${vendorPlantId}`,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
          },
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.warn(`[PVBlink] Failed to fetch year ${year}:`, {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          })
          // Continue with other years even if one fails
          continue
        }

        const data: PvBlinkTotalTelemetryResponse = await response.json()

        // The API may return multiple years in productionData, or just the requested year
        // Process all entries in productionData
        const yearlyRecords = (data.data.productionData || []).map((point) => {
          const date = new Date(point.createdOn)
          const recordYear = date.getFullYear() || year
          
          // Only include records within our requested range
          if (recordYear >= startYear && recordYear <= endYear) {
            return {
              vendorPlantId,
              year: recordYear,
              generationValue: point.production || 0, // Yearly generation in kWh
              dateTime: point.createdOn, // Timestamp in milliseconds
            }
          }
          return null
        }).filter((record): record is NonNullable<typeof record> => record !== null)

        // Aggregate statistics from this year's data
        // If productionData has entries, sum them; otherwise use data.production
        if (yearlyRecords.length > 0) {
          const yearTotal = yearlyRecords.reduce((sum, r) => sum + r.generationValue, 0)
          totalProduction += yearTotal
        } else {
          // Fallback: use data.production if no records
          totalProduction += data.data.production || 0
        }
        totalPeakHours += data.data.peakHours || 0

        allRecords.push(...yearlyRecords)
      } catch (error: any) {
        console.warn(`[PVBlink] Error fetching year ${year}:`, error.message)
        // Continue with other years even if one fails
        continue
      }
    }

    // Remove duplicate years (in case API returns overlapping data)
    const uniqueRecords = new Map<number, typeof allRecords[0]>()
    for (const record of allRecords) {
      const existing = uniqueRecords.get(record.year)
      if (!existing || record.generationValue > existing.generationValue) {
        uniqueRecords.set(record.year, record)
      }
    }
    const finalRecords = Array.from(uniqueRecords.values()).sort((a, b) => a.year - b.year)

    // If no records found, create a placeholder for the year range
    if (finalRecords.length === 0 && totalProduction > 0) {
      // Create a single record representing the total
      finalRecords.push({
        vendorPlantId,
        year: startYear,
        generationValue: totalProduction,
        dateTime: new Date(startYear, 0, 1).getTime(),
      })
    }

    return {
      statistics: {
        vendorPlantId,
        generationValue: totalProduction, // Total generation across all years
        peakHours: totalPeakHours,
      },
      records: finalRecords, // Sorted and deduplicated records
    }
  }

  /**
   * Get telemetry data for a specific plant
   * This is a fallback method - prefer using getDailyTelemetryRecords for day view
   */
  async getTelemetry(
    plantId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TelemetryData[]> {
    // This is a fallback method - prefer using getDailyTelemetryRecords for day view
    console.warn("[PVBlink] getTelemetry() called - not yet implemented. Use getDailyTelemetryRecords for day view.")
    return []
  }

  /**
   * Get realtime data for a specific plant
   * TODO: Implement once API endpoint is available
   */
  async getRealtime(plantId: string): Promise<RealtimeData> {
    // TODO: Implement realtime data when API endpoint is available
    throw new Error("PVBlink realtime data not yet implemented")
  }

  /**
   * Get active alerts for a specific plant
   * TODO: Implement once API endpoint is available
   */
  async getAlerts(plantId: string): Promise<Alert[]> {
    // TODO: Implement alerts when API endpoint is available
    throw new Error("PVBlink alerts not yet implemented")
  }

  /**
   * Normalize telemetry data
   * TODO: Implement once endpoint is available
   */
  protected normalizeTelemetry(rawData: any): TelemetryData {
    // TODO: Implement normalization once endpoint is available
    return {
      plantId: rawData.plantId || "",
      timestamp: new Date(rawData.timestamp || Date.now()),
      generationPowerKw: rawData.generationPowerKw || 0,
    }
  }

  /**
   * Normalize alert data from PVBlink API response
   * TODO: Implement once endpoint is available
   */
  protected normalizeAlert(rawData: any): Alert {
    // TODO: Implement normalization once endpoint is available
    return {
      vendorAlertId: rawData.id?.toString() || "",
      title: rawData.title || "Alert",
      description: rawData.description || null,
      severity: "MEDIUM",
    }
  }
}

