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

interface ShineMonitorPlantResponse {
  err: number
  desc: string
  dat: {
    total: number
    page: number
    pagesize: number
    plant: Array<{
      pid: number
      uid: number
      usr: string
      name: string
      type: number
      status: number // 0=ONLINE/NORMAL, 1=ALL_OFFLINE, others=PARTIAL_OFFLINE
      address: {
        lon: string
        lat: string
        address?: string
        timezone: number
      }
      nominalPower: string // e.g., "3.0000"
      install: string // Format: "2025-08-27 11:39:45"
      gts: string // Format: "2025-08-27 11:39:45"
      outputPower: string // e.g., "0.7574"
      energy: string // e.g., "2.5000" (daily energy in kWh)
      energyMonth: string // e.g., "131.6000" (monthly energy - check if kWh or MWh)
      energyYear: string // e.g., "2034.7000" (yearly energy - check if kWh or MWh)
      energyTotal: string // e.g., "2034.7000" (total energy - check if kWh or MWh)
      energyDatDate: string // Format: "2025-11-30 15:09:10"
    }>
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
   * Generate sign for API calls (non-auth)
   * Process:
   * 1. Remove sign, salt, token from query string
   * 2. Get remaining query string from &action onwards
   * 3. sign = SHA1(salt + secret + token + finalQueryString)
   * 
   * Example:
   * - Query: sign=X&salt=Y&token=Z&action=webQueryPlants&orderBy=ascPlantId&page=0&pagesize=100
   * - After removing sign, salt, token: action=webQueryPlants&orderBy=ascPlantId&page=0&pagesize=100
   * - finalQueryString: &action=webQueryPlants&orderBy=ascPlantId&page=0&pagesize=100
   */
  private generateSignForApi(
    salt: string,
    secret: string,
    token: string,
    queryParams: URLSearchParams
  ): string {
    // Build query string excluding sign, salt, token
    const parts: string[] = []
    queryParams.forEach((value, key) => {
      if (key !== "sign" && key !== "salt" && key !== "token") {
        parts.push(`${key}=${value}`)
      }
    })

    // Join with & and ensure it starts with &
    let finalQueryString = parts.join("&")
    if (finalQueryString && !finalQueryString.startsWith("&")) {
      finalQueryString = "&" + finalQueryString
    }

    // Generate sign: SHA1(salt + secret + token + finalQueryString)
    const signInput = salt + secret + token + finalQueryString
    console.log(`[ShineMonitor] Sign generation input:`, {
      salt,
      secret: secret, // Complete secret for debugging
      token: token, // Complete token for debugging
      finalQueryString,
      signInputLength: signInput.length,
    })
    console.log(`[ShineMonitor] Sign input (full, for debugging):`, {
      salt,
      secret,
      token,
      finalQueryString,
      concatenated: signInput,
    })
    const generatedSign = this.sha1(signInput)
    console.log(`[ShineMonitor] Generated sign (complete): ${generatedSign}`)
    return generatedSign
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

    console.log("[ShineMonitor] ========== AUTHENTICATION REQUEST ==========")
    console.log("[ShineMonitor] Request URL:", url)
    console.log("[ShineMonitor] Request Method: GET")
    console.log("[ShineMonitor] Request Headers:", JSON.stringify({
      Accept: "application/json",
      Origin: "https://kstar.shinemonitor.com",
      Referer: "https://kstar.shinemonitor.com/",
    }, null, 2))
    console.log("[ShineMonitor] Sign Generation Details:", {
      salt,
      passHash: passHash, // Complete passHash for debugging
      userName,
      companyKey,
      sign,
      actionString: `&action=auth&usr=${userName}&company-key=${companyKey}`,
    })

    const response = await pooledFetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Origin: "https://kstar.shinemonitor.com",
        Referer: "https://kstar.shinemonitor.com/",
      },
    })

    console.log("[ShineMonitor] Response Status:", response.status, response.statusText)
    console.log("[ShineMonitor] Response Headers:", JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2))

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

    const responseText = await response.text()
    console.log("[ShineMonitor] Response Body (raw):", responseText)
    
    let data: ShineMonitorAuthResponse
    try {
      data = JSON.parse(responseText)
      console.log("[ShineMonitor] Response Body (parsed):", JSON.stringify(data, null, 2))
    } catch (parseError) {
      console.error("[ShineMonitor] Failed to parse response JSON:", parseError)
      console.error("[ShineMonitor] Raw response:", responseText)
      throw new Error(`ShineMonitor authentication failed: Invalid JSON response`)
    }

    if (data.err !== 0 || !data.dat?.token) {
      console.error("[ShineMonitor] Authentication error response:", {
        err: data.err,
        desc: data.desc,
        hasToken: !!data.dat?.token,
        hasSecret: !!data.dat?.secret,
      })
      throw new Error(
        `ShineMonitor authentication failed: ${data.desc || "Unknown error"}`
      )
    }

    // Store token and secret in database
    await this.storeTokenInDB(data.dat.token, data.dat.secret, data.dat.expire)

    console.log("[ShineMonitor] Authentication successful")
    console.log("[ShineMonitor] Token (complete):", data.dat.token)
    console.log("[ShineMonitor] Secret (complete):", data.dat.secret)
    console.log("[ShineMonitor] Expires in:", data.dat.expire, "seconds")
    console.log("[ShineMonitor] ========== AUTHENTICATION COMPLETE ==========")
    return data.dat.token
  }

  /**
   * List all plants from ShineMonitor
   * Endpoint: GET /?sign={sign}&salt={salt}&token={token}&action=webQueryPlants&orderBy=ascPlantId&page=0&pagesize=100
   */
  async listPlants(): Promise<Plant[]> {
    // Get token and secret from DB
    const cached = await this.getTokenFromDB()
    if (!cached) {
      // Authenticate if no cached token
      await this.authenticate()
      const refreshed = await this.getTokenFromDB()
      if (!refreshed) {
        throw new Error("Failed to get ShineMonitor token")
      }
      this.secret = refreshed.secret
    } else {
      this.secret = cached.secret
    }

    const token = cached?.token || (await this.authenticate())
    const secret = this.secret

    if (!secret) {
      throw new Error("ShineMonitor secret not available")
    }

    const baseUrl = this.getApiBaseUrl()
    const pageSize = 100
    let currentPage = 0
    let totalPages = 1
    const allPlants: Plant[] = []

    console.log("[ShineMonitor] Fetching plants from:", baseUrl)

    while (currentPage <= totalPages) {
      // Generate salt for this request
      const salt = this.generateSalt()

      // Build query parameters WITHOUT sign, salt, token (for sign generation)
      // Order: action, orderBy, page, pagesize (as per API specification)
      const queryParamsForSign = new URLSearchParams()
      queryParamsForSign.append("action", "webQueryPlants")
      queryParamsForSign.append("orderBy", "ascPlantId")
      queryParamsForSign.append("page", currentPage.toString())
      queryParamsForSign.append("pagesize", pageSize.toString())

      // Generate sign using query params without sign, salt, token
      console.log("[ShineMonitor] Generating sign for API call (page " + currentPage + ")")
      console.log("[ShineMonitor] Query params for sign generation:", {
        action: queryParamsForSign.get("action"),
        orderBy: queryParamsForSign.get("orderBy"),
        page: queryParamsForSign.get("page"),
        pagesize: queryParamsForSign.get("pagesize"),
      })
      const sign = this.generateSignForApi(salt, secret, token, queryParamsForSign)

      // Build final query params with sign, salt, token added
      const finalQueryParams = new URLSearchParams(queryParamsForSign)
      finalQueryParams.set("sign", sign)
      finalQueryParams.set("salt", salt)
      finalQueryParams.set("token", token)

      const url = `${baseUrl}/?${finalQueryParams.toString()}`

      console.log("[ShineMonitor] ========== PLANT LIST REQUEST (Page " + currentPage + ") ==========")
      console.log("[ShineMonitor] Request URL:", url)
      console.log("[ShineMonitor] Request Method: GET")
      console.log("[ShineMonitor] Request Headers:", JSON.stringify({
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
        Connection: "keep-alive",
        Origin: "https://kstar.shinemonitor.com",
        Referer: "https://kstar.shinemonitor.com/",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
      }, null, 2))
      console.log("[ShineMonitor] Query Parameters:", {
        action: "webQueryPlants",
        orderBy: "ascPlantId",
        page: currentPage.toString(),
        pagesize: pageSize.toString(),
        salt,
        token: token, // Complete token for debugging
        sign: sign, // Complete sign for debugging
      })
      console.log("[ShineMonitor] Sign Generation Details:", {
        salt,
        secret: secret, // Complete secret for debugging
        token: token, // Complete token for debugging
        finalQueryString: `&action=webQueryPlants&orderBy=ascPlantId&page=${currentPage}&pagesize=${pageSize}`,
        generatedSign: sign, // Complete sign for debugging
      })

      const response = await pooledFetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
          Connection: "keep-alive",
          Origin: "https://kstar.shinemonitor.com",
          Referer: "https://kstar.shinemonitor.com/",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        },
      })

      console.log("[ShineMonitor] Response Status:", response.status, response.statusText)
      console.log("[ShineMonitor] Response Headers:", JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2))

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[ShineMonitor] HTTP Error (page ${currentPage}):`, {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        })
        throw new Error(
          `Failed to fetch plants from ShineMonitor: ${response.statusText} - ${errorText}`
        )
      }

      const responseText = await response.text()
      console.log("[ShineMonitor] Response Body (raw, first 500 chars):", responseText.substring(0, 500))
      
      let data: ShineMonitorPlantResponse
      try {
        data = JSON.parse(responseText)
        console.log("[ShineMonitor] Response Body (parsed):", JSON.stringify(data, null, 2))
      } catch (parseError) {
        console.error("[ShineMonitor] Failed to parse response JSON:", parseError)
        console.error("[ShineMonitor] Raw response:", responseText)
        throw new Error(`ShineMonitor API error: Invalid JSON response`)
      }

      if (data.err !== 0) {
        console.error("[ShineMonitor] API Error Response:", {
          err: data.err,
          desc: data.desc,
          fullResponse: JSON.stringify(data, null, 2),
        })
        throw new Error(`ShineMonitor API error: ${data.desc || "Unknown error"}`)
      }

      const plants = data.dat?.plant || []
      const total = data.dat?.total || 0

      if (currentPage === 0) {
        // Calculate total pages from first response
        totalPages = Math.ceil(total / pageSize) - 1 // -1 because page is 0-indexed
        console.log(
          `[ShineMonitor] Total plants: ${total}, pages: ${totalPages + 1} (page size: ${pageSize})`
        )
      }

      console.log(`[ShineMonitor] Page ${currentPage}: Received ${plants.length} plants`)
      if (plants.length > 0) {
        console.log("[ShineMonitor] Sample plant (first):", JSON.stringify({
          pid: plants[0].pid,
          name: plants[0].name,
          nominalPower: plants[0].nominalPower,
          status: plants[0].status,
          address: plants[0].address,
        }, null, 2))
      }
      console.log("[ShineMonitor] ========== PLANT LIST RESPONSE (Page " + currentPage + ") COMPLETE ==========")

      // Map ShineMonitor plants to Plant format
      const mappedPlants = plants.map((plant) => {
        // Parse capacity from string (e.g., "3.0000" -> 3.0)
        const capacityKw = parseFloat(plant.nominalPower) || 0

        // Map location
        let location: any = undefined
        if (plant.address) {
          location = {
            lat: plant.address.lat ? parseFloat(plant.address.lat) : null,
            lng: plant.address.lon ? parseFloat(plant.address.lon) : null,
            address: plant.address.address || plant.usr || null,
          }
        }

        // Map network status: 0=ONLINE/NORMAL, 1=ALL_OFFLINE, others=PARTIAL_OFFLINE
        let networkStatus: string | null = null
        if (plant.status === 0) {
          networkStatus = "NORMAL"
        } else if (plant.status === 1) {
          networkStatus = "ALL_OFFLINE"
        } else {
          networkStatus = "PARTIAL_OFFLINE"
        }

        // Parse install date: "2025-08-27 11:39:45" -> ISO string
        let vendorCreatedDate: string | null = null
        if (plant.install) {
          try {
            const date = new Date(plant.install.replace(" ", "T"))
            if (!isNaN(date.getTime())) {
              vendorCreatedDate = date.toISOString()
            }
          } catch (error) {
            console.warn(`[ShineMonitor] Failed to parse install date: ${plant.install}`, error)
          }
        }

        // Parse gts (start operating time): "2025-08-27 11:39:45" -> ISO string
        let startOperatingTime: string | null = null
        if (plant.gts) {
          try {
            const date = new Date(plant.gts.replace(" ", "T"))
            if (!isNaN(date.getTime())) {
              startOperatingTime = date.toISOString()
            }
          } catch (error) {
            console.warn(`[ShineMonitor] Failed to parse gts: ${plant.gts}`, error)
          }
        }

        // Parse production metrics
        // outputPower is in kW (already correct unit)
        const currentPowerKw = parseFloat(plant.outputPower) || 0
        
        // energy is daily energy in kWh (already correct unit)
        const dailyEnergyKwh = parseFloat(plant.energy) || 0
        
        // energyMonth, energyYear, energyTotal are in kWh, need to convert to MWh
        const monthlyEnergyMwh = (parseFloat(plant.energyMonth) || 0) / 1000
        const yearlyEnergyMwh = (parseFloat(plant.energyYear) || 0) / 1000
        const totalEnergyMwh = (parseFloat(plant.energyTotal) || 0) / 1000

        // Parse last update time from energyDatDate
        let lastUpdateTime: string | null = null
        if (plant.energyDatDate) {
          try {
            const date = new Date(plant.energyDatDate.replace(" ", "T"))
            if (!isNaN(date.getTime())) {
              lastUpdateTime = date.toISOString()
            }
          } catch (error) {
            console.warn(`[ShineMonitor] Failed to parse energyDatDate: ${plant.energyDatDate}`, error)
          }
        }

        return {
          id: plant.pid.toString(), // vendor_plant_id
          name: plant.name || `Plant ${plant.pid}`,
          capacityKw,
          location,
          metadata: {
            // Production metrics
            currentPowerKw,
            dailyEnergyKwh,
            monthlyEnergyMwh,
            yearlyEnergyMwh,
            totalEnergyMwh,
            lastUpdateTime,
            // Additional fields for sync service
            networkStatus,
            createdDate: vendorCreatedDate, // Sync service expects createdDate
            startOperatingTime,
            locationAddress: plant.address?.address || plant.usr || null,
            // Store raw data for reference
            raw: {
              pid: plant.pid,
              uid: plant.uid,
              usr: plant.usr,
              type: plant.type,
              status: plant.status,
              address: plant.address,
              nominalPower: plant.nominalPower,
              install: plant.install,
              gts: plant.gts,
              outputPower: plant.outputPower,
              energy: plant.energy,
              energyMonth: plant.energyMonth,
              energyYear: plant.energyYear,
              energyTotal: plant.energyTotal,
              energyDatDate: plant.energyDatDate,
            },
          },
        }
      })

      allPlants.push(...mappedPlants)

      // Check if we've fetched all pages
      if (currentPage >= totalPages || plants.length === 0) {
        break
      }

      currentPage++
    }

    console.log(`[ShineMonitor] ========== PLANT LIST COMPLETE ==========`)
    console.log(`[ShineMonitor] Successfully fetched ${allPlants.length} plants across ${currentPage + 1} pages`)
    return allPlants
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

