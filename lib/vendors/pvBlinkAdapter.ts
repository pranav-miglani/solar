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
   * Get telemetry data for a specific plant
   * TODO: Implement once API endpoint is available
   */
  async getTelemetry(
    plantId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TelemetryData[]> {
    // TODO: Implement telemetry when API endpoint is available
    throw new Error("PVBlink telemetry not yet implemented")
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
      metadata: rawData,
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
      metadata: rawData,
    }
  }
}

