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
  private tokenCache: {
    token: string
    expiresAt: number
  } | null = null

  private vendorId?: number
  private supabaseClient?: any // Supabase client for token storage

  /**
   * Set vendor ID and Supabase client for token storage
   */
  setTokenStorage(vendorId: number, supabaseClient: any) {
    this.vendorId = vendorId
    this.supabaseClient = supabaseClient
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
    // Check in-memory cache first
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.token
    }

    // Check database for stored token
    const dbToken = await this.getTokenFromDB()
    if (dbToken) {
      // Cache in memory for this session
      const jwtExpiry = this.decodeJWTExpiry(dbToken)
      this.tokenCache = {
        token: dbToken,
        expiresAt: jwtExpiry || Date.now() + 3600 * 1000, // Default 1 hour if can't decode
      }
      return dbToken
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

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
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

    // Store token in database
    await this.storeTokenInDB(data.access_token, data.expires_in || 3600)

    // Cache token in memory (expires 5 minutes before actual expiry for safety)
    const expiresIn = data.expires_in || 3600
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (expiresIn - 300) * 1000,
    }

    return data.access_token
  }

  async listPlants(): Promise<Plant[]> {
    const token = await this.authenticate()
    
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
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
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
          // Additional station metadata
          networkStatus: station.networkStatus,
          type: station.type,
          contactPhone: station.contactPhone,
          gridInterconnectionType: station.gridInterconnectionType,
          regionTimezone: station.regionTimezone,
          startOperatingTime: station.startOperatingTime,
          // Include all other fields for reference
          ...station,
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

    const response = await fetch(
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

    const response = await fetch(
      `${this.getApiBaseUrl()}/device/v1.0/currentData`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
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

    const response = await fetch(
      `${this.getApiBaseUrl()}/device/v1.0/alertList`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
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
    
    const response = await fetch(
      `${this.getApiBaseUrl()}/station/v1.0/base?language=en`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stationId }),
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
    
    const response = await fetch(
      `${this.getApiBaseUrl()}/station/v1.0/device`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stationId }),
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

