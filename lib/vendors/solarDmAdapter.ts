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

interface SolarDmPlantResponse {
  code: number
  message: string
  data: {
    total: number
    list: Array<{
      id: string
      plantName: string
      address: string
      timeZone: number
      type: number
      systemType: number
      capacity: string // e.g., "5.00"
      longitude: number
      latitude: number
      monetaryUnit: number
      ownerName: string
      ownerPhone: string
      isDeleted: number
      createBy: string
      createTime: string // Format: "2025-11-28 10:08:41"
      updateBy: string
      updateTime: string
      communicateStatus: number // 2=offline, 1=online, 3=PARTIAL_OFFLINE
      alarmStatus: number
      isSelf: boolean
      createByType: number
      [key: string]: any
    }>
  }
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
      console.log("[SolarDM] returing cached token")
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
   * Endpoint: GET /dms/plant/list_all
   */
  async listPlants(): Promise<Plant[]> {
    const token = await this.authenticate()
    const baseUrl = this.getApiBaseUrl()
    const url = `${baseUrl}/dms/plant/list_all`

    console.log("[SolarDM] Fetching plants from:", url)

    const response = await pooledFetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[SolarDM] Failed to fetch plants:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      throw new Error(`Failed to fetch plants from SolarDM: ${response.statusText} - ${errorText}`)
    }

    const data: SolarDmPlantResponse = await response.json()

    if (data.code !== 0 || !data.data?.list) {
      throw new Error(`SolarDM API error: ${data.message || "Unknown error"}`)
    }

    const total = data.data.total || 0
    const plants = data.data.list || []
    console.log(`[SolarDM] Successfully fetched ${plants.length} plants (total: ${total})`)

    // Map SolarDM plants to Plant format
    return plants.map((plant) => {
      // Parse capacity from string (e.g., "5.00" -> 5.0)
      const capacityKw = parseFloat(plant.capacity) || 0

      // Map location
      let location: any = undefined
      if (plant.latitude || plant.longitude || plant.address) {
        location = {
          lat: plant.latitude || null,
          lng: plant.longitude || null,
          address: plant.address || null,
        }
      }
      // Map network status: 2=offline, 1=online, 3=PARTIAL_OFFLINE
      let networkStatus: string | null = null
      if (plant.communicateStatus === 1) {
        networkStatus = "NORMAL"
      } else if (plant.communicateStatus === 2) {
        networkStatus = "ALL_OFFLINE"
      } else if (plant.communicateStatus === 3) {
        networkStatus = "PARTIAL_OFFLINE"
      }

      // Parse createTime: "2025-11-28 10:08:41" -> ISO string
      let vendorCreatedDate: string | null = null
      let startOperatingTime: string | null = null
      if (plant.createTime) {
        try {
          // Parse "YYYY-MM-DD HH:mm:ss" format
          const date = new Date(plant.createTime.replace(" ", "T"))
          if (!isNaN(date.getTime())) {
            const isoString = date.toISOString()
            vendorCreatedDate = isoString
            startOperatingTime = isoString // Both use createTime
          }
        } catch (error) {
          console.warn(`[SolarDM] Failed to parse createTime: ${plant.createTime}`, error)
        }
      }

      return {
        id: plant.id, // vendor_plant_id
        name: plant.plantName || `Plant ${plant.id}`,
        capacityKw,
        location,
        metadata: {
          // Additional fields for sync service
          networkStatus,
          createdDate: vendorCreatedDate, // Sync service expects createdDate
          startOperatingTime,
          locationAddress: plant.address || null,
          // Store raw data for reference
          raw: {
            communicateStatus: plant.communicateStatus,
            alarmStatus: plant.alarmStatus,
            timeZone: plant.timeZone,
            type: plant.type,
            systemType: plant.systemType,
            createTime: plant.createTime,
            updateTime: plant.updateTime,
          },
        },
      }
    })
  }

  /**
   * Get telemetry data for a plant (base method - fallback)
   * This is used when specific period methods (getDailyTelemetryRecords, etc.) are not available
   */
  async getTelemetry(
    plantId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TelemetryData[]> {
    // This is a fallback method - prefer using getDailyTelemetryRecords, etc. if available
    console.warn("[SolarDM] getTelemetry() called - not yet implemented. Use specific period methods if available.")
    return []
  }

  /**
   * Get daily telemetry records (20-minute intervals for a specific day)
   * Endpoint: GET /dms/data_panel/history/stats/daily/{plantId}?plantId={plantId}&type=date&time=YYYY-MM-DD
   * Similar to Solarman's getDailyTelemetryRecords()
   */
  async getDailyTelemetryRecords(
    plantId: string | number,
    year: number,
    month: number,
    day: number
  ): Promise<{
    statistics: {
      systemId: number | string
      year: number
      month: number
      day: number
      generationValue: number // Daily generation in kWh
      fullPowerHoursDay?: number
      acceptDay?: string
    }
    records: Array<{
      systemId: number | string
      acceptDay?: number
      acceptMonth?: number
      generationPower: number // Power in W (will be converted to kW)
      dateTime: number // Unix timestamp
      generationCapacity?: number // Capacity utilization (0-1)
      timeZoneOffset?: number // Timezone offset in seconds
    }>
  }> {
    const token = await this.authenticate()
    const baseUrl = this.getApiBaseUrl()
    
    // Convert plantId to string (SolarDM uses string IDs)
    const plantIdStr = plantId.toString()
    
    // Format date as YYYY-MM-DD
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    
    // SolarDM endpoint: /dms/data_panel/history/stats/daily/{plantId}?plantId={plantId}&type=date&time=YYYY-MM-DD
    const url = `${baseUrl}/dms/data_panel/history/stats/daily/${plantIdStr}?plantId=${plantIdStr}&type=date&time=${dateStr}`

    console.log("[SolarDM] Fetching daily telemetry records:", {
      plantId: plantIdStr,
      year,
      month,
      day,
      dateStr,
      url,
    })

    const response = await pooledFetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[SolarDM] Failed to fetch daily telemetry:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      throw new Error(`Failed to fetch daily telemetry from SolarDM: ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()

    if (data.code !== 0 || !data.data?.dataList) {
      throw new Error(`SolarDM API error: ${data.message || "Unknown error"}`)
    }

    const dataList = data.data.dataList || []
    console.log(`[SolarDM] Successfully fetched ${dataList.length} daily telemetry records`)

    // Transform SolarDM response to match Solarman format
    const records = dataList.map((item: any) => {
      // Parse time string "YYYY-MM-DD HH:mm:ss" to Unix timestamp (seconds)
      let dateTime: number
      try {
        // Parse the time string and convert to Unix timestamp
        const date = new Date(item.time.replace(" ", "T"))
        dateTime = Math.floor(date.getTime() / 1000) // Convert to Unix seconds
      } catch (error) {
        console.warn(`[SolarDM] Failed to parse time: ${item.time}`, error)
        dateTime = Math.floor(Date.now() / 1000) // Fallback to current time
      }

      // generationPower is already in W (watts) - keep as is for now, will be converted to kW in API route
      // Note: SolarDM provides 20-minute intervals, not 15-minute like Solarman
      return {
        systemId: plantIdStr,
        generationPower: item.generationPower || 0, // Power in W
        dateTime, // Unix timestamp in seconds
        generationCapacity: null, // Not provided by SolarDM
        timeZoneOffset: null, // Not provided by SolarDM
      }
    })

    // Calculate statistics from records
    // Daily generation: sum of (power * interval_duration) for all intervals
    // Interval duration: 20 minutes = 1/3 hour
    const intervalHours = 20 / 60 // 20 minutes in hours
    let dailyGenerationKwh = 0

    records.forEach((record: any) => {
      const powerKw = record.generationPower / 1000 // Convert W to kW
      const energyKwh = powerKw * intervalHours
      dailyGenerationKwh += energyKwh
    })

    const statistics = {
      systemId: plantIdStr,
      year,
      month,
      day,
      generationValue: dailyGenerationKwh, // Daily generation in kWh
      fullPowerHoursDay: undefined, // Would need capacity to calculate
      acceptDay: dateStr, // Format: YYYY-MM-DD
    }

    return {
      statistics,
      records,
    }
  }

  /**
   * Get monthly telemetry records (daily aggregation for a specific month)
   * Endpoint: GET /dms/data_panel/history/stats/month/{plantId}?plantId={plantId}&type=month&time=YYYY-MM
   * Similar to Solarman's getMonthlyTelemetryRecords()
   */
  async getMonthlyTelemetryRecords(
    plantId: string | number,
    year: number,
    month: number
  ): Promise<{
    statistics: {
      systemId: number | string
      year: number
      month: number
      day: number
      generationValue: number // Monthly generation in kWh
      fullPowerHoursDay?: number
    }
    records: Array<{
      systemId: number | string
      year: number
      month: number
      day: number
      generationValue: number // Daily generation in kWh
      fullPowerHoursDay?: number
      acceptDay?: string
    }>
  }> {
    const token = await this.authenticate()
    const baseUrl = this.getApiBaseUrl()
    
    // Convert plantId to string (SolarDM uses string IDs)
    const plantIdStr = plantId.toString()
    
    // Format date as YYYY-MM
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    
    // SolarDM endpoint: /dms/data_panel/history/stats/month/{plantId}?plantId={plantId}&type=month&time=YYYY-MM
    const url = `${baseUrl}/dms/data_panel/history/stats/month/${plantIdStr}?plantId=${plantIdStr}&type=month&time=${monthStr}`

    console.log("[SolarDM] Fetching monthly telemetry records:", {
      plantId: plantIdStr,
      year,
      month,
      monthStr,
      url,
    })

    const response = await pooledFetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[SolarDM] Failed to fetch monthly telemetry:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      throw new Error(`Failed to fetch monthly telemetry from SolarDM: ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()

    if (data.code !== 0 || !data.data?.dataList) {
      throw new Error(`SolarDM API error: ${data.message || "Unknown error"}`)
    }

    const dataList = data.data.dataList || []
    console.log(`[SolarDM] Successfully fetched ${dataList.length} monthly telemetry records`)

    // Transform SolarDM response to match Solarman format
    const records = dataList.map((item: any) => {
      // Parse day from time string (e.g., "1", "2", "21" -> 1, 2, 21)
      const day = parseInt(item.time, 10) || 0

      // generationEnergy is already in kWh - use as is
      const dailyGenerationKwh = item.generationEnergy || 0

      // Format acceptDay as YYYYMMDD (e.g., "20251121")
      const acceptDay = day > 0 
        ? `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`
        : undefined

      return {
        systemId: plantIdStr,
        year,
        month,
        day,
        generationValue: dailyGenerationKwh, // Daily generation in kWh
        fullPowerHoursDay: undefined, // Not provided by SolarDM
        acceptDay,
      }
    })

    // Calculate statistics from records
    // Monthly generation: sum of all daily generation values
    const monthlyGenerationKwh = records.reduce((sum: number, record: { generationValue?: number }) => {
      return sum + (record.generationValue || 0)
    }, 0)

    const statistics = {
      systemId: plantIdStr,
      year,
      month,
      day: 0, // Not applicable for monthly stats
      generationValue: monthlyGenerationKwh, // Monthly generation in kWh
      fullPowerHoursDay: undefined, // Would need capacity to calculate
    }

    return {
      statistics,
      records,
    }
  }

  /**
   * Get yearly telemetry records (monthly aggregation for a specific year)
   * Endpoint: GET /dms/data_panel/history/stats/year/{plantId}?plantId={plantId}&type=year&time=YYYY
   * Similar to Solarman's getYearlyTelemetryRecords()
   */
  async getYearlyTelemetryRecords(
    plantId: string | number,
    year: number
  ): Promise<{
    statistics: {
      systemId: number | string
      year: number
      month: number
      day: number
      generationValue: number // Yearly generation in kWh
      fullPowerHoursDay?: number
    }
    records: Array<{
      systemId: number | string
      year: number
      month: number
      day: number
      generationValue: number // Monthly generation in kWh
      fullPowerHoursDay?: number
    }>
  }> {
    const token = await this.authenticate()
    const baseUrl = this.getApiBaseUrl()
    
    // Convert plantId to string (SolarDM uses string IDs)
    const plantIdStr = plantId.toString()
    
    // Format year as YYYY
    const yearStr = year.toString()
    
    // SolarDM endpoint: /dms/data_panel/history/stats/year/{plantId}?plantId={plantId}&type=year&time=YYYY
    const url = `${baseUrl}/dms/data_panel/history/stats/year/${plantIdStr}?plantId=${plantIdStr}&type=year&time=${yearStr}`

    console.log("[SolarDM] Fetching yearly telemetry records:", {
      plantId: plantIdStr,
      year,
      yearStr,
      url,
    })

    const response = await pooledFetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[SolarDM] Failed to fetch yearly telemetry:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      throw new Error(`Failed to fetch yearly telemetry from SolarDM: ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()

    if (data.code !== 0 || !data.data?.dataList) {
      throw new Error(`SolarDM API error: ${data.message || "Unknown error"}`)
    }

    const dataList = data.data.dataList || []
    console.log(`[SolarDM] Successfully fetched ${dataList.length} yearly telemetry records`)

    // Transform SolarDM response to match Solarman format
    const records = dataList.map((item: any) => {
      // Parse month from time string (e.g., "1", "2", "11" -> 1, 2, 11)
      const month = parseInt(item.time, 10) || 0

      // generationEnergy is already in kWh (monthly generation) - use as is
      const monthlyGenerationKwh = item.generationEnergy || 0

      return {
        systemId: plantIdStr,
        year,
        month,
        day: 0, // Not applicable for monthly records in yearly view
        generationValue: monthlyGenerationKwh, // Monthly generation in kWh
        fullPowerHoursDay: undefined, // Not provided by SolarDM
      }
    })

    // Calculate statistics from records
    // Yearly generation: sum of all monthly generation values
    const yearlyGenerationKwh = records.reduce((sum: number, record: { generationValue?: number }) => {
      return sum + (record.generationValue || 0)
    }, 0)

    const statistics = {
      systemId: plantIdStr,
      year,
      month: 0, // Not applicable for yearly stats
      day: 0, // Not applicable for yearly stats
      generationValue: yearlyGenerationKwh, // Yearly generation in kWh
      fullPowerHoursDay: undefined, // Would need capacity to calculate
    }

    return {
      statistics,
      records,
    }
  }

  /**
   * Get total telemetry records (yearly aggregation across multiple years)
   * Endpoint: GET /dms/data_panel/history/stats/total/{plantId}?plantId={plantId}&type=all&time=YYYY+~+YYYY
   * Similar to Solarman's getTotalTelemetryRecords()
   */
  async getTotalTelemetryRecords(
    plantId: string | number,
    startYear: number,
    endYear: number
  ): Promise<{
    statistics: {
      systemId: number | string
      generationValue: number // Total generation in kWh
      useValue?: number
      gridValue?: number
      buyValue?: number
      gridRatio?: number
      generationRatio?: number
      fullPowerHoursDay?: number
      absorbedUseValue?: number
      genForGrid?: number
      selfGenAndUseValue?: number
    }
    records: Array<{
      systemId: number | string
      year: number
      month: number
      day: number
      generationValue: number // Yearly generation in kWh
      useValue?: number
      gridValue?: number
      buyValue?: number
      fullPowerHoursDay?: number
      gridRatio?: number
      generationRatio?: number
    }>
    operatingTotalDays?: number
  }> {
    const token = await this.authenticate()
    const baseUrl = this.getApiBaseUrl()
    
    // Convert plantId to string (SolarDM uses string IDs)
    const plantIdStr = plantId.toString()
    
    // Format time parameter as "YYYY+~+YYYY" (URL encoded space as +)
    const timeStr = `${startYear}+~+${endYear}`
    
    // SolarDM endpoint: /dms/data_panel/history/stats/total/{plantId}?plantId={plantId}&type=all&time=YYYY+~+YYYY
    const url = `${baseUrl}/dms/data_panel/history/stats/total/${plantIdStr}?plantId=${plantIdStr}&type=all&time=${timeStr}`

    console.log("[SolarDM] Fetching total telemetry records:", {
      plantId: plantIdStr,
      startYear,
      endYear,
      timeStr,
      url,
    })

    const response = await pooledFetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[SolarDM] Failed to fetch total telemetry:`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      throw new Error(`Failed to fetch total telemetry from SolarDM: ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()

    if (data.code !== 0 || !data.data?.dataList) {
      throw new Error(`SolarDM API error: ${data.message || "Unknown error"}`)
    }

    const dataList = data.data.dataList || []
    console.log(`[SolarDM] Successfully fetched ${dataList.length} total telemetry records`)

    // Transform SolarDM response to match Solarman format
    const records = dataList.map((item: any) => {
      // Parse year from time string (e.g., "2025" -> 2025)
      const year = parseInt(item.time, 10) || 0

      // generationEnergy is already in kWh (yearly generation) - use as is
      const yearlyGenerationKwh = item.generationEnergy || 0

      return {
        systemId: plantIdStr,
        year,
        month: 0, // Not applicable for yearly records in total view
        day: 0, // Not applicable for yearly records in total view
        generationValue: yearlyGenerationKwh, // Yearly generation in kWh
        useValue: undefined, // Not provided by SolarDM
        gridValue: undefined, // Not provided by SolarDM
        buyValue: undefined, // Not provided by SolarDM
        fullPowerHoursDay: undefined, // Not provided by SolarDM
        gridRatio: undefined, // Not provided by SolarDM
        generationRatio: undefined, // Not provided by SolarDM
      }
    })

    // Calculate statistics from records
    // Total generation: sum of all yearly generation values
    const totalGenerationKwh = records.reduce((sum: number, record: { generationValue?: number }) => {
      return sum + (record.generationValue || 0)
    }, 0)

    const statistics = {
      systemId: plantIdStr,
      generationValue: totalGenerationKwh, // Total generation in kWh
      useValue: undefined, // Not provided by SolarDM
      gridValue: undefined, // Not provided by SolarDM
      buyValue: undefined, // Not provided by SolarDM
      gridRatio: undefined, // Not provided by SolarDM
      generationRatio: undefined, // Not provided by SolarDM
      fullPowerHoursDay: undefined, // Would need capacity to calculate
      absorbedUseValue: undefined, // Not provided by SolarDM
      genForGrid: undefined, // Not provided by SolarDM
      selfGenAndUseValue: undefined, // Not provided by SolarDM
    }

    return {
      statistics,
      records,
      operatingTotalDays: undefined, // Not provided by SolarDM
    }
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
   * Simple logged fetch wrapper for API calls
   */
  private async loggedFetch(
    url: string,
    options: RequestInit = {},
    context?: { operation?: string; description?: string }
  ): Promise<Response> {
    // Use fetchWithAuth for authenticated requests, or pooledFetch for direct calls
    const token = await this.authenticate()
    const fullUrl = url.startsWith("http") ? url : `${this.getApiBaseUrl()}${url}`
    
    const operation = context?.operation || "API_CALL"
    const description = context?.description || "SolarDM API request"
    
    // Build headers object - match Postman request format
    // Extract base domain from API URL (e.g., http://global.solar-dm.com:8010 -> http://global.solar-dm.com)
    const apiBaseUrl = this.getApiBaseUrl()
    const urlObj = new URL(apiBaseUrl)
    const origin = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? `:${urlObj.port}` : ""}`
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-US",
      "Connection": "keep-alive",
      "Origin": origin,
      "Referer": `${origin}/`,
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
    }
    
    // Only add Content-Type for requests with body
    if (options.body) {
      headers["Content-Type"] = "application/json"
    }
    
    // Merge any existing headers from options (convert Headers object to plain object if needed)
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value
        })
      } else {
        Object.assign(headers, options.headers)
      }
    }
    
    console.log(`[SolarDM] ${operation}: ${description}`)
    console.log(`[SolarDM] Request URL: ${fullUrl}`)
    console.log(`[SolarDM] Request method: ${options.method || "GET"}`)
    console.log(`[SolarDM] Request headers:`, JSON.stringify(headers, null, 2))
    console.log(`[SolarDM] Authorization Header: Bearer ${token}`)
    
    if (options.body) {
      console.log(`[SolarDM] Request body:`, typeof options.body === 'string' ? options.body : JSON.stringify(options.body))
    }
    
    const response = await pooledFetch(fullUrl, {
      ...options,
      headers,
    })
    
    console.log(`[SolarDM] Response status: ${response.status} ${response.statusText}`)
    console.log(`[SolarDM] Response headers:`, JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2))
    
    // Log response body for debugging (but don't consume it)
    const responseClone = response.clone()
    try {
      const responseText = await responseClone.text()
      console.log(`[SolarDM] Response body (first 500 chars):`, responseText.substring(0, 500))
    } catch (e) {
      console.log(`[SolarDM] Could not read response body for logging`)
    }
    
    return response
  }

  /**
   * Get alerts for a plant
   * Fetches alerts from SolarDM's inverter fault API
   */
  async getAlerts(plantId: string): Promise<Alert[]> {
    const baseUrl = this.getApiBaseUrl()
    
    // SolarDM alerts endpoint
    const url = `${baseUrl}/dms/inverter_fault/page_list/all`
    
    // Filter for "There is no mains voltage" alerts (same as Solarman)
    const params = new URLSearchParams({
      current: "1",
      size: "100",
      faultInfo: "There is no mains voltage"
    })
    
    const response = await this.loggedFetch(
      `${url}?${params.toString()}`,
      {
        method: "GET",
      },
      {
        operation: "GET_ALERTS_SOLARDM",
        description: `Fetch SolarDM alerts for plant ${plantId}`,
      }
    )
    
    if (!response.ok) {
      const text = await response.text()
      throw new Error(
        `SolarDM alerts request failed: ${response.status} ${response.statusText} - ${text}`
      )
    }
    
    const data = await response.json()
    
    if (data.code !== 0) {
      throw new Error(`SolarDM API error: ${data.message || "Unknown error"}`)
    }
    
    const records = data.data?.records || []
    
    // Filter alerts for the specific plant
    const plantAlerts = records.filter((record: any) => record.plantId === plantId)
    
    return plantAlerts.map((record: any) => this.normalizeAlert(record))
  }
  
  /**
   * Fetch all alerts with pagination
   * Used by alert sync service to fetch all alerts across all plants
   */
  async getAllAlerts(startDate?: Date, endDate?: Date): Promise<any[]> {
    const baseUrl = this.getApiBaseUrl()
    
    const url = `${baseUrl}/dms/inverter_fault/page_list/all`
    const pageSize = 100
    let current = 1
    let totalPages = 1
    const allAlerts: any[] = []
    
    console.log(`[SolarDM] Starting getAllAlerts - startDate: ${startDate?.toISOString()}, endDate: ${endDate?.toISOString()}`)
    
    while (current <= totalPages) {
      const params = new URLSearchParams({
        current: current.toString(),
        size: pageSize.toString(),
        faultInfo: "There is no mains voltage"
      })
      
      const fullUrl = `${url}?${params.toString()}`
      console.log(`[SolarDM] Fetching page ${current}/${totalPages} from: ${fullUrl}`)
      console.log(`[SolarDM] Query parameters:`, {
        current: current.toString(),
        size: pageSize.toString(),
        faultInfo: "There is no mains voltage",
        encoded: params.toString()
      })
      
      const response = await this.loggedFetch(
        fullUrl,
        {
          method: "GET",
        },
        {
          operation: "GET_ALL_ALERTS_SOLARDM",
          description: `Fetch SolarDM alerts page ${current}`,
        }
      )
      
      if (!response.ok) {
        const text = await response.text()
        console.error(`[SolarDM] API request failed (page ${current}):`, {
          status: response.status,
          statusText: response.statusText,
          error: text
        })
        throw new Error(
          `SolarDM alerts request failed (page ${current}): ${response.status} ${response.statusText} - ${text}`
        )
      }
      
      const data = await response.json()
      console.log(`[SolarDM] Page ${current} response:`, {
        code: data.code,
        message: data.message,
        total: data.data?.total,
        pages: data.data?.pages,
        recordsCount: data.data?.records?.length || 0
      })
      
      if (data.code !== 0) {
        console.error(`[SolarDM] API returned error code:`, data)
        throw new Error(`SolarDM API error: ${data.message || "Unknown error"}`)
      }
      
      const records = data.data?.records || []
      const totalRecords = data.data?.total || 0
      const apiPages = data.data?.pages ?? 0
      
      if (current === 1) {
        // Handle pagination: if pages is 0 but we have records, calculate pages
        if (apiPages === 0 && totalRecords > 0) {
          totalPages = Math.ceil(totalRecords / pageSize)
          console.log(`[SolarDM] API returned pages=0 but total=${totalRecords}, calculating pages: ${totalPages}`)
        } else if (apiPages > 0) {
          totalPages = apiPages
        } else {
          totalPages = 1
        }
        
        console.log(`[SolarDM] Total pages: ${totalPages}, total records: ${totalRecords}`)
        
        // Log first few records for debugging
        if (records.length > 0) {
          console.log(`[SolarDM] Sample record from page 1:`, {
            id: records[0].id,
            plantId: records[0].plantId,
            happenTime: records[0].happenTime,
            recoverTime: records[0].recoverTime,
            faultInfo: records[0].faultInfo,
            faultInfoEN: records[0].faultInfoEN,
            faultLevel: records[0].faultLevel,
            status: records[0].status,
          })
        }
      }
      
      if (records.length === 0) {
        console.log(`[SolarDM] No records on page ${current}, stopping pagination`)
        break
      }
      
      console.log(`[SolarDM] Page ${current}: Received ${records.length} records`)
      
      // Don't filter by date here - let the sync service handle it
      // This allows us to see all alerts and log what's being filtered
      allAlerts.push(...records)
      
      // Check if we've reached the last page or if we've fetched all records
      if (current >= totalPages || allAlerts.length >= totalRecords) {
        console.log(`[SolarDM] Reached last page (${totalPages}) or fetched all records (${allAlerts.length}/${totalRecords}), stopping pagination`)
        break
      }
      
      current++
    }
    
    console.log(`[SolarDM] getAllAlerts complete: ${allAlerts.length} total alerts fetched across ${current - 1} pages`)
    return allAlerts
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
   * Normalize alert data from SolarDM API response
   */
  protected normalizeAlert(rawData: any): Alert {
    // Map SolarDM faultLevel to severity
    // faultLevel: 1=LOW, 2=MEDIUM, 3=HIGH, 4=CRITICAL (assuming similar to Solarman)
    const severityMap: Record<number, "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = {
      1: "LOW",
      2: "MEDIUM",
      3: "HIGH",
      4: "CRITICAL",
    }
    
    const severity = severityMap[rawData.faultLevel] || "MEDIUM"
    
    return {
      vendorAlertId: rawData.id?.toString() || "",
      title: rawData.faultInfo || "Alert",
      description: rawData.faultInfo || null,
      severity,
      metadata: rawData,
    }
  }
}

