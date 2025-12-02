import { BaseVendorAdapter } from "./baseVendorAdapter"
import type {
  Plant,
  TelemetryData,
  Alert,
  RealtimeData,
  VendorConfig,
} from "./types"
import { pooledFetch } from "./httpClient"

interface FoxesscloudAuthResponse {
  errno: number
  result: {
    token: string
    access: number
    user: string
    weakFlag: boolean
  }
}

export class FoxesscloudAdapter extends BaseVendorAdapter {
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
   * Override getApiBaseUrl to use Foxesscloud-specific environment variable
   */
  protected getApiBaseUrl(): string {
    // First check if apiBaseUrl is provided in config
    if (this.config.apiBaseUrl) {
      return this.config.apiBaseUrl
    }
    
    // Fall back to environment variable or default
    const baseUrl = process.env.FOXESSCLOUD_API_BASE_URL || "https://www.foxesscloud.com"
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
      console.error("[Foxesscloud] Error getting token from DB:", error)
      return null
    }
  }

  /**
   * Store token in database
   * Default expiration: 23 hours 30 minutes (84600 seconds)
   */
  private async storeTokenInDB(
    token: string,
    expiresIn: number = 23.5 * 60 * 60 // Default: 23 hours 30 minutes
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
        console.error("[Foxesscloud] Error storing token:", error)
      } else {
        console.log(`[Foxesscloud] Token stored with expiration: ${expiresAt.toISOString()}`)
      }
    } catch (error) {
      console.error("[Foxesscloud] Error storing token:", error)
    }
  }

  /**
   * Authenticate with Foxesscloud API
   * Endpoint: POST /c/v0/user/login
   * Implements retry logic: max 3 attempts on error
   */
  async authenticate(): Promise<string> {
    // Check for cached token first
    const cachedToken = await this.getTokenFromDB()
    if (cachedToken) {
      console.log("[Foxesscloud] Returning cached token")
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
    const username = credentials.username as string
    const passwordMD5 = credentials.passwordMD5 as string

    if (!username || !passwordMD5) {
      throw new Error("Foxesscloud credentials missing: username and passwordMD5 are required")
    }

    const baseUrl = this.getApiBaseUrl()
    const url = `${baseUrl}/c/v0/user/login`

    const requestBody = {
      user: username,
      password: passwordMD5,
    }

    // Generate timestamp for headers
    const timestamp = Date.now().toString()

    console.log("[Foxesscloud] Authenticating with:", url)
    console.log("[Foxesscloud] Attempt:", this.retryCount + 1, "of", this.MAX_RETRIES)

    try {
      const response = await pooledFetch(url, {
        method: "POST",
        headers: {
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
          "Content-Type": "application/json;charset=UTF-8",
          "contenttype": "application/json",
          "lang": "en",
          "Origin": baseUrl,
          "Referer": `${baseUrl}/login`,
          "timezone": "Asia/Calcutta",
          "timestamp": timestamp,
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[Foxesscloud] Authentication failed:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          attempt: this.retryCount + 1,
        })

        // Retry if we haven't exceeded max retries
        if (this.retryCount < this.MAX_RETRIES - 1) {
          this.retryCount++
          console.log(`[Foxesscloud] Retrying authentication (attempt ${this.retryCount + 1}/${this.MAX_RETRIES})...`)
          // Wait a bit before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount))
          return this.authenticateWithRetry()
        }

        throw new Error(`Foxesscloud authentication failed after ${this.MAX_RETRIES} attempts: ${response.statusText} - ${errorText}`)
      }

      const data: FoxesscloudAuthResponse = await response.json()

      if (data.errno !== 0 || !data.result?.token) {
        // Retry if we haven't exceeded max retries
        if (this.retryCount < this.MAX_RETRIES - 1) {
          this.retryCount++
          console.log(`[Foxesscloud] API returned error (errno: ${data.errno}), retrying (attempt ${this.retryCount + 1}/${this.MAX_RETRIES})...`)
          await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount))
          return this.authenticateWithRetry()
        }

        throw new Error(`Foxesscloud authentication failed: API returned errno ${data.errno} after ${this.MAX_RETRIES} attempts`)
      }

      // Store token in database with default expiration (23 hours 30 minutes)
      const defaultExpiresIn = 23.5 * 60 * 60 // 23 hours 30 minutes in seconds
      await this.storeTokenInDB(data.result.token, defaultExpiresIn)

      console.log("[Foxesscloud] Authentication successful")
      this.retryCount = 0 // Reset retry count on success
      return data.result.token
    } catch (error: any) {
      // Retry on network errors if we haven't exceeded max retries
      if (this.retryCount < this.MAX_RETRIES - 1 && error.message?.includes("fetch")) {
        this.retryCount++
        console.log(`[Foxesscloud] Network error, retrying (attempt ${this.retryCount + 1}/${this.MAX_RETRIES})...`)
        await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount))
        return this.authenticateWithRetry()
      }

      // If it's already our custom error, throw it as-is
      if (error.message?.includes("Foxesscloud authentication failed")) {
        throw error
      }

      // Otherwise, wrap it
      throw new Error(`Foxesscloud authentication error: ${error.message || String(error)}`)
    }
  }

  /**
   * Get a single plant by vendor plant ID
   * TODO: Implement once API endpoint is available
   */
  async listPlant(vendorPlantId: string): Promise<Plant | null> {
    // TODO: Implement single plant fetching when API endpoint is available
    throw new Error("Foxesscloud plant listing not yet implemented")
  }

  /**
   * List all plants from Foxesscloud
   * TODO: Implement once API endpoint is available
   */
  async listPlants(): Promise<Plant[]> {
    // TODO: Implement plant listing when API endpoint is available
    throw new Error("Foxesscloud plant listing not yet implemented")
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
    throw new Error("Foxesscloud telemetry not yet implemented")
  }

  /**
   * Get realtime data for a specific plant
   * TODO: Implement once API endpoint is available
   */
  async getRealtime(plantId: string): Promise<RealtimeData> {
    // TODO: Implement realtime data when API endpoint is available
    throw new Error("Foxesscloud realtime data not yet implemented")
  }

  /**
   * Get active alerts for a specific plant
   * TODO: Implement once API endpoint is available
   */
  async getAlerts(plantId: string): Promise<Alert[]> {
    // TODO: Implement alerts when API endpoint is available
    throw new Error("Foxesscloud alerts not yet implemented")
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
   * Normalize alert data from Foxesscloud API response
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

