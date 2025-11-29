import { BaseVendorAdapter } from "./baseVendorAdapter"
import type {
  Plant,
  TelemetryData,
  Alert,
  RealtimeData,
  VendorConfig,
} from "./types"
import { pooledFetch } from "./httpClient"

interface SolarDmAuthResponse {
  code: number
  message: string
  data: {
    token: string
    refreshToken: string
    tokenHead: string
    expiresIn: number
  }
}

interface SolarDmStation {
  id: string
  name: string
  capacity?: number
  location?: {
    lat?: number
    lng?: number
    address?: string
  }
  [key: string]: any
}

export class SolarDmAdapter extends BaseVendorAdapter {
  private vendorId?: number
  private supabaseClient?: any

  /**
   * Set vendor ID and Supabase client for token storage
   */
  setTokenStorage(vendorId: number, supabaseClient: any) {
    this.vendorId = vendorId
    this.supabaseClient = supabaseClient
  }

  /**
   * Override getApiBaseUrl to use SolarDM-specific environment variable
   */
  protected getApiBaseUrl(): string {
    // First check if apiBaseUrl is provided in config
    if (this.config.apiBaseUrl) {
      return this.config.apiBaseUrl
    }
    
    // Fall back to environment variable or default
    const baseUrl = process.env.SOLARDM_API_BASE_URL || "http://global.solar-dm.com:8010"
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
      console.error("[SolarDM] Error getting token from DB:", error)
      return null
    }
  }

  /**
   * Store token in database
   */
  private async storeTokenInDB(
    token: string,
    expiresIn: number,
    refreshToken?: string
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

      if (refreshToken) {
        updateData.refresh_token = refreshToken
      }

      const { error } = await this.supabaseClient
        .from("vendors")
        .update(updateData)
        .eq("id", this.vendorId)

      if (error) {
        console.error("[SolarDM] Error storing token:", error)
      }
    } catch (error) {
      console.error("[SolarDM] Error storing token:", error)
    }
  }

  /**
   * Authenticate with SolarDM API
   * Endpoint: POST /ums/business/email_login
   */
  async authenticate(): Promise<string> {
    // Check for cached token first
    const cachedToken = await this.getTokenFromDB()
    if (cachedToken) {
      return cachedToken
    }

    const credentials = this.getCredentials()
    const email = credentials.email as string
    const passwordRSA = credentials.passwordRSA as string

    if (!email || !passwordRSA) {
      throw new Error("SolarDM credentials missing: email and passwordRSA are required")
    }

    const baseUrl = this.getApiBaseUrl()
    const url = `${baseUrl}/ums/business/email_login`

    const requestBody = {
      email,
      password: passwordRSA,
      loginType: "email",
      regionSign: "3",
    }

    console.log("[SolarDM] Authenticating with:", url)

    const response = await pooledFetch(url, {
      method: "POST",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json;charset=UTF-8",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[SolarDM] Authentication failed:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      throw new Error(`SolarDM authentication failed: ${response.statusText} - ${errorText}`)
    }

    const data: SolarDmAuthResponse = await response.json()

    if (data.code !== 0 || !data.data?.token) {
      throw new Error(`SolarDM authentication failed: ${data.message || "Unknown error"}`)
    }

    // Store token in database
    await this.storeTokenInDB(
      data.data.token,
      data.data.expiresIn,
      data.data.refreshToken
    )

    console.log("[SolarDM] Authentication successful")
    return data.data.token
  }

  /**
   * List all plants from SolarDM
   * TODO: Implement once plant listing endpoint is available
   */
  async listPlants(): Promise<Plant[]> {
    const token = await this.authenticate()
    
    // TODO: Implement plant listing endpoint
    // For now, return empty array until endpoint is available
    console.log("[SolarDM] listPlants() called - endpoint not yet implemented")
    
    return []
  }

  /**
   * Get telemetry data for a plant
   * TODO: Implement once telemetry endpoint is available
   */
  async getTelemetry(
    plantId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TelemetryData[]> {
    // TODO: Implement telemetry endpoint
    // For now, return empty array
    return []
  }

  /**
   * Get realtime data for a plant
   * TODO: Implement once realtime endpoint is available
   */
  async getRealtime(plantId: string): Promise<RealtimeData> {
    // TODO: Implement realtime endpoint
    // Return minimal structure for now
    return {
      plantId,
      timestamp: new Date(),
      data: {},
    }
  }

  /**
   * Get alerts for a plant
   * TODO: Implement once alerts endpoint is available
   */
  async getAlerts(plantId: string): Promise<Alert[]> {
    // TODO: Implement alerts endpoint
    // Return empty array for now
    return []
  }

  /**
   * Normalize telemetry data
   */
  protected normalizeTelemetry(rawData: any): TelemetryData {
    // TODO: Implement normalization once endpoint is available
    // Return minimal structure for now
    return {
      plantId: rawData.plantId || "",
      timestamp: new Date(rawData.timestamp || Date.now()),
      generationPowerKw: rawData.generationPowerKw || 0,
      metadata: rawData,
    }
  }

  /**
   * Normalize alert data
   */
  protected normalizeAlert(rawData: any): Alert {
    // TODO: Implement normalization once endpoint is available
    // Return minimal structure for now
    return {
      vendorAlertId: rawData.id || rawData.alertId || "",
      title: rawData.title || rawData.message || "Alert",
      description: rawData.description || "",
      severity: (rawData.severity || "MEDIUM") as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      metadata: rawData,
    }
  }
}

