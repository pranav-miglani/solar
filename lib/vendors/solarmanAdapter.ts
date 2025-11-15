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
    }

    const response = await fetch(`${this.getApiBaseUrl()}/account/v1.0/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        appid: credentials.appId,
        secret: credentials.appSecret,
        username: credentials.username,
        password: credentials.passwordSha256,
      }),
    })

    if (!response.ok) {
      throw new Error(`Solarman authentication failed: ${response.statusText}`)
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
    const response = await fetch(
      `${this.getApiBaseUrl()}/station/v1.0/list`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch stations: ${response.statusText}`)
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

  async getTelemetry(
    plantId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TelemetryData[]> {
    const token = await this.authenticate()
    const start = Math.floor(startTime.getTime() / 1000)
    const end = Math.floor(endTime.getTime() / 1000)

    const response = await fetch(
      `${this.getApiBaseUrl()}/station/v1.0/history?stationId=${plantId}&startTime=${start}&endTime=${end}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch telemetry: ${response.statusText}`)
    }

    const data: SolarmanTelemetryResponse = await response.json()

    if (!data.success) {
      throw new Error("Failed to fetch telemetry from Solarman")
    }

    return data.data.map((item) =>
      this.normalizeTelemetry({
        ...item,
        plantId,
      })
    )
  }

  async getRealtime(plantId: string): Promise<RealtimeData> {
    const token = await this.authenticate()
    const response = await fetch(
      `${this.getApiBaseUrl()}/station/v1.0/rt?stationId=${plantId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch realtime: ${response.statusText}`)
    }

    const data: SolarmanRealtimeResponse = await response.json()

    if (!data.success) {
      throw new Error("Failed to fetch realtime from Solarman")
    }

    return {
      plantId,
      timestamp: new Date(),
      data: data.data,
    }
  }

  async getAlerts(plantId: string): Promise<Alert[]> {
    const token = await this.authenticate()
    const response = await fetch(
      `${this.getApiBaseUrl()}/station/v1.0/alerts?stationId=${plantId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch alerts: ${response.statusText}`)
    }

    const data: SolarmanAlertsResponse = await response.json()

    if (!data.success) {
      throw new Error("Failed to fetch alerts from Solarman")
    }

    return data.data.map((alert) => this.normalizeAlert(alert))
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

  protected normalizeAlert(rawData: SolarmanAlert): Alert {
    // Map Solarman alert levels to our severity
    const severityMap: Record<number, Alert["severity"]> = {
      1: "LOW",
      2: "MEDIUM",
      3: "HIGH",
      4: "CRITICAL",
    }

    return {
      vendorAlertId: rawData.alertId,
      title: rawData.alertType || "Alert",
      description: rawData.message,
      severity: severityMap[rawData.alertLevel] || "MEDIUM",
      metadata: {
        ...rawData,
      },
    }
  }
}

