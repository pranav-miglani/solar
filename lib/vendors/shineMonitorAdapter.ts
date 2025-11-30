import { BaseVendorAdapter } from "./baseVendorAdapter"
import type {
  Plant,
  TelemetryData,
  Alert,
  RealtimeData,
  VendorConfig,
} from "./types"
import { pooledFetch } from "./httpClient"
import { createHash } from "crypto"

interface ShineMonitorAuthResponse {
  err: number
  desc: string
  dat: {
    secret: string
    expire: number // Expiration time in seconds
    token: string
    role: number
    usr: string
    uid: number
  }
}

/**
 * ShineMonitor Vendor Adapter
 * 
 * Authentication uses a special sign/salt mechanism:
 * - salt = current timestamp (milliseconds)
 * - sign = SHA1(salt + pass_hash + action_string)
 * - action_string = "&action=auth&usr={user_name}&company-key={company_key}"
 */
export class ShineMonitorAdapter extends BaseVendorAdapter {
  private vendorId?: number
  private supabaseClient?: any
  private secret?: string // Store secret for future API calls

  /**
   * Set vendor ID and Supabase client for token storage
   */
  setTokenStorage(vendorId: number, supabaseClient: any) {
    this.vendorId = vendorId
    this.supabaseClient = supabaseClient
  }

  /**
   * Override getApiBaseUrl to use ShineMonitor-specific environment variable
   */
  protected getApiBaseUrl(): string {
    // First check if apiBaseUrl is provided in config
    if (this.config.apiBaseUrl) {
      return this.config.apiBaseUrl
    }
    
    // Fall back to environment variable or default
    const baseUrl = process.env.SHINEMONITOR_API_BASE_URL || "https://web.shinemonitor.com/public"
    return baseUrl
  }

  /**
   * Generate SHA1 hash
   */
  private sha1(input: string): string {
    return createHash("sha1").update(input).digest("hex")
  }

  /**
   * Generate salt (current timestamp in milliseconds)
   */
  private generateSalt(): string {
    return new Date().getTime().toString()
  }

  /**
   * Generate sign for authentication
   * sign = SHA1(salt + pass_hash + action_string)
   * action_string = "&action=auth&usr={user_name}&company-key={company_key}"
   */
  private generateSign(
    salt: string,
    passHash: string,
    userName: string,
    companyKey: string
  ): string {
    const actionString = `&action=auth&usr=${userName}&company-key=${companyKey}`
    const signInput = salt + passHash + actionString
    return this.sha1(signInput)
  }

  /**
   * Get cached token from database
   */
  private async getTokenFromDB(): Promise<{ token: string; secret: string } | null> {
    if (!this.vendorId || !this.supabaseClient) {
      return null
    }

    try {
      const { data, error } = await this.supabaseClient
        .from("vendors")
        .select("access_token, token_expires_at, token_metadata")
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

      // Extract secret from token_metadata
      const secret = data.token_metadata?.secret || null
      const token = data.access_token || null

      if (token && secret) {
        this.secret = secret
        return { token, secret }
      }

      return null
    } catch (error) {
      console.error("[ShineMonitor] Error getting token from DB:", error)
      return null
    }
  }

  /**
   * Store token in database
   */
  private async storeTokenInDB(
    token: string,
    secret: string,
    expiresIn: number
  ): Promise<void> {
    if (!this.vendorId || !this.supabaseClient) {
      return
    }

    try {
      // expire is in seconds, convert to milliseconds for Date
      const expiresAt = new Date(Date.now() + expiresIn * 1000)

      const updateData: any = {
        access_token: token,
        token_expires_at: expiresAt.toISOString(),
        token_metadata: {
          token_type: "Bearer",
          secret: secret,
          expires_in: expiresIn,
          stored_at: new Date().toISOString(),
        },
      }

      const { error } = await this.supabaseClient
        .from("vendors")
        .update(updateData)
        .eq("id", this.vendorId)

      if (error) {
        console.error("[ShineMonitor] Error storing token:", error)
      } else {
        this.secret = secret
      }
    } catch (error) {
      console.error("[ShineMonitor] Error storing token:", error)
    }
  }

  /**
   * Authenticate with ShineMonitor API
   * Endpoint: GET /?sign={sign}&salt={salt}&action=auth&usr={user_name}&company-key={company_key}
   */
  async authenticate(): Promise<string> {
    // Check for cached token first
    const cached = await this.getTokenFromDB()
    if (cached) {
      console.log("[ShineMonitor] Returning cached token")
      return cached.token
    }

    const credentials = this.getCredentials()
    const userName = credentials.user_name as string
    const passHash = credentials.pass_hash as string
    const companyKey = credentials.company_key as string

    if (!userName || !passHash || !companyKey) {
      throw new Error(
        "ShineMonitor credentials missing: user_name, pass_hash, and company_key are required"
      )
    }

    // Generate salt and sign
    const salt = this.generateSalt()
    const sign = this.generateSign(salt, passHash, userName, companyKey)

    const baseUrl = this.getApiBaseUrl()
    const url = `${baseUrl}/?sign=${sign}&salt=${salt}&action=auth&usr=${userName}&company-key=${companyKey}`

    console.log("[ShineMonitor] Authenticating with:", url.replace(/sign=[^&]+/, "sign=***"))

    const response = await pooledFetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Origin: "https://kstar.shinemonitor.com",
        Referer: "https://kstar.shinemonitor.com/",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[ShineMonitor] Authentication failed:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      throw new Error(
        `ShineMonitor authentication failed: ${response.statusText} - ${errorText}`
      )
    }

    const data: ShineMonitorAuthResponse = await response.json()

    if (data.err !== 0 || !data.dat?.token) {
      throw new Error(
        `ShineMonitor authentication failed: ${data.desc || "Unknown error"}`
      )
    }

    // Store token and secret in database
    await this.storeTokenInDB(data.dat.token, data.dat.secret, data.dat.expire)

    console.log("[ShineMonitor] Authentication successful")
    return data.dat.token
  }

  /**
   * List all plants from ShineMonitor
   * TODO: Implement once API endpoint is known
   */
  async listPlants(): Promise<Plant[]> {
    // TODO: Implement plant listing
    // This will need to be implemented once the plant listing endpoint is documented
    throw new Error("ShineMonitor plant listing not yet implemented")
  }

  /**
   * Get telemetry data for a specific plant
   * TODO: Implement once API endpoint is known
   */
  async getTelemetry(
    plantId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TelemetryData[]> {
    // TODO: Implement telemetry
    throw new Error("ShineMonitor telemetry not yet implemented")
  }

  /**
   * Get realtime data for a specific plant
   * TODO: Implement once API endpoint is known
   */
  async getRealtime(plantId: string): Promise<RealtimeData> {
    // TODO: Implement realtime data
    throw new Error("ShineMonitor realtime data not yet implemented")
  }

  /**
   * Get active alerts for a specific plant
   * TODO: Implement once API endpoint is known
   */
  async getAlerts(plantId: string): Promise<Alert[]> {
    // TODO: Implement alerts
    throw new Error("ShineMonitor alerts not yet implemented")
  }

  /**
   * Normalize telemetry data
   * TODO: Implement once API endpoint is known
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
   * Normalize alert data
   * TODO: Implement once API endpoint is known
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

