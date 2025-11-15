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

  async authenticate(): Promise<string> {
    // Check cache
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.token
    }

    const credentials = this.getCredentials() as {
      appId: string
      appSecret: string
      username: string
      passwordSha256: string
      orgId?: number // Optional Solarman orgId (not our organization ID)
    }

    // Build request body according to SOLARMAN_DOC.md
    const requestBody: any = {
      appSecret: credentials.appSecret,
      username: credentials.username,
      password: credentials.passwordSha256,
    }

    // Add orgId if provided (for org-scoped login)
    if (credentials.orgId) {
      requestBody.orgId = credentials.orgId
    }

    // appId goes in query parameter, not body
    const url = `${this.getApiBaseUrl()}/account/v1.0/token?appId=${credentials.appId}`

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Solarman authentication failed: ${response.statusText} - ${errorText}`)
    }

    const data: SolarmanAuthResponse = await response.json()

    // Cache token (expires 1 hour before actual expiry for safety)
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 3600) * 1000,
    }

    return data.access_token
  }

  async listPlants(): Promise<Plant[]> {
    const token = await this.authenticate()
    
    // Use the new v2 search endpoint that returns detailed production metrics
    // Try the new endpoint first, fallback to old endpoint if needed
    const baseUrl = this.getApiBaseUrl()
    
    // Check if baseUrl contains 'globalpro' (new API) or 'globalapi' (old API)
    // Also check for 'globalpro' in any form
    const isNewApi = baseUrl.includes('globalpro') || baseUrl.includes('globalpro.solarmanpv.com')
    
    if (isNewApi) {
      // Use new v2 search endpoint
      const response = await fetch(
        `${baseUrl}/maintain-s/operating/station/v2/search?page=1&size=50&order.direction=ASC&order.property=name`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "accept": "application/json, text/plain, */*",
          },
          body: JSON.stringify({
            station: {
              powerTypeList: ["PV"]
            }
          }),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch stations: ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()

      if (!data.data || !Array.isArray(data.data)) {
        throw new Error("Invalid response format from Solarman API")
      }

      return data.data.map((item: any) => {
        const station = item.station
        return {
          id: station.id.toString(),
          name: station.name,
          capacityKw: station.installedCapacity || 0,
          location: station.locationAddress
            ? {
                address: station.locationAddress,
                lat: station.locationLat || undefined,
                lng: station.locationLng || undefined,
              }
            : undefined,
          metadata: {
            stationId: station.id,
            // Production metrics (only those shown in Production Overview dashboard)
            currentPowerKw: station.generationPower ? station.generationPower / 1000 : null, // Convert W to kW
            dailyEnergyMwh: station.generationValue ? station.generationValue / 1000 : null, // Convert kWh to MWh
            monthlyEnergyMwh: station.generationMonth ? station.generationMonth / 1000 : null,
            yearlyEnergyMwh: station.generationYear ? station.generationYear / 1000 : null,
            totalEnergyMwh: station.generationTotal ? station.generationTotal / 1000 : null,
            performanceRatio: station.generationCapacity || null, // PR as decimal (0-1 range)
            lastUpdateTime: station.lastUpdateTime ? new Date(station.lastUpdateTime * 1000).toISOString() : null,
          },
        }
      })
    } else {
      // Fallback to old v1.0/list endpoint
      const response = await fetch(
        `${baseUrl}/station/v1.0/list`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to fetch stations: ${response.statusText} - ${errorText}`)
      }

      const data: SolarmanStationListResponse = await response.json()

      if (!data.success) {
        throw new Error("Failed to fetch stations from Solarman")
      }

      return data.data.map((station) => ({
        id: station.stationId.toString(),
        name: station.stationName,
        capacityKw: station.capacity,
        location: station.location
          ? {
              lat: station.location.latitude,
              lng: station.location.longitude,
              address: station.location.address,
            }
          : undefined,
        metadata: {
          stationId: station.stationId,
        },
      }))
    }
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

