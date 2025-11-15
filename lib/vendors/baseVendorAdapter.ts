import type {
  VendorConfig,
  Plant,
  TelemetryData,
  Alert,
  RealtimeData,
} from "./types"

/**
 * Base abstract class for all vendor adapters
 * Each vendor implementation must extend this class and implement all abstract methods
 */
export abstract class BaseVendorAdapter {
  protected config: VendorConfig

  constructor(config: VendorConfig) {
    this.config = config
  }

  /**
   * Authenticate with vendor API and return access token
   * Should implement token caching internally
   */
  abstract authenticate(): Promise<string>

  /**
   * List all plants/stations available from this vendor
   */
  abstract listPlants(): Promise<Plant[]>

  /**
   * Get telemetry data for a specific plant
   * @param plantId - Vendor-specific plant identifier
   * @param startTime - Start time for telemetry range
   * @param endTime - End time for telemetry range
   */
  abstract getTelemetry(
    plantId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TelemetryData[]>

  /**
   * Get realtime data for a specific plant
   */
  abstract getRealtime(plantId: string): Promise<RealtimeData>

  /**
   * Get active alerts for a specific plant
   */
  abstract getAlerts(plantId: string): Promise<Alert[]>

  /**
   * Normalize vendor-specific telemetry data to standard format
   */
  protected abstract normalizeTelemetry(rawData: any): TelemetryData

  /**
   * Normalize vendor-specific alert data to standard format
   */
  protected abstract normalizeAlert(rawData: any): Alert

  protected getApiBaseUrl(): string {
    return this.config.apiBaseUrl
  }

  protected getCredentials(): Record<string, any> {
    return this.config.credentials
  }

  protected async fetchWithAuth(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = await this.authenticate()
    const url = `${this.getApiBaseUrl()}${endpoint}`

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
  }
}

