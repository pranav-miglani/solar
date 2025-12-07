import { BaseWmsAdapter, type WmsSite, type WmsDevice, type InsolationReading } from "./baseWmsAdapter"
import type { WmsVendorConfig } from "./baseWmsAdapter"
import { getMainClient } from "@/lib/supabase/pooled"
import { logger } from "@/lib/context/logger"

/**
 * Intello WMS Vendor Adapter
 * 
 * Handles authentication and data fetching from Intello WMS API
 */
export class IntelloAdapter extends BaseWmsAdapter {
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
   * Authenticate with Intello API
   * Uses cached token if valid, otherwise fetches new token
   */
  async authenticate(): Promise<string> {
    const credentials = this.getCredentials()
    const email = credentials.email as string
    const passwordHash = credentials.password_hash as string

    if (!email || !passwordHash) {
      throw new Error("Intello credentials missing: email and password_hash required")
    }

    // Check for cached token in database
    if (this.vendorId && this.supabaseClient) {
      logger.info(`[IntelloAdapter] Checking for cached token for vendor ID: ${this.vendorId}`)
      
      const { data: vendor } = await this.supabaseClient
        .from("wms_vendors")
        .select("access_token, token_expires_at")
        .eq("id", this.vendorId)
        .single()

      if (vendor?.access_token && vendor?.token_expires_at) {
        const expiresAt = new Date(vendor.token_expires_at)
        const now = new Date()
        
        // Token is valid if it expires more than 5 minutes from now
        if (expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
          logger.info(`[IntelloAdapter] Using cached token (expires at: ${expiresAt.toISOString()})`)
          return vendor.access_token
        } else {
          logger.info(`[IntelloAdapter] Cached token expired (expires at: ${expiresAt.toISOString()}), fetching new token`)
        }
      } else {
        logger.info(`[IntelloAdapter] No cached token found, fetching new token`)
      }
    }

    // Fetch new token
    const apiBaseUrl = this.getApiBaseUrl()
    const authUrl = `${apiBaseUrl}/api/intello/authenticate`
    
    logger.info(`[IntelloAdapter] Calling authentication API: POST ${authUrl}`)
    logger.info(`[IntelloAdapter] Request body: { username: "${email}", password: "***" }`)
    
    const requestStartTime = Date.now()
    const response = await fetch(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: email,
        password: passwordHash,
      }),
    })

    const requestDuration = Date.now() - requestStartTime
    logger.info(`[IntelloAdapter] Authentication API response: ${response.status} ${response.statusText} (${requestDuration}ms)`)

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[IntelloAdapter] Authentication API failed: ${response.status} ${errorText}`)
      throw new Error(`Intello authentication failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const token = data.token as string
    const expirationTime = data.expirationTime as number // seconds

    if (!token) {
      logger.error(`[IntelloAdapter] No token in authentication response: ${JSON.stringify(data)}`)
      throw new Error("Intello authentication failed: no token in response")
    }

    logger.info(`[IntelloAdapter] Authentication successful. Token expiration: ${expirationTime}s`)

    // Cache token in database
    if (this.vendorId && this.supabaseClient) {
      const expiresAt = new Date(Date.now() + expirationTime * 1000)
      logger.info(`[IntelloAdapter] Caching token in database (expires at: ${expiresAt.toISOString()})`)
      await this.supabaseClient
        .from("wms_vendors")
        .update({
          access_token: token,
          token_expires_at: expiresAt.toISOString(),
          token_metadata: {
            expirationTime,
            stored_at: new Date().toISOString(),
          },
        })
        .eq("id", this.vendorId)
      logger.info(`[IntelloAdapter] Token cached successfully`)
    }

    return token
  }

  /**
   * List all sites from Intello API
   */
  async listSites(): Promise<WmsSite[]> {
    const apiBaseUrl = this.getApiBaseUrl()
    const sitesUrl = `${apiBaseUrl}/api/intello/user/v1/sites`
    
    logger.info(`[IntelloAdapter] Calling list sites API: GET ${sitesUrl}`)
    const requestStartTime = Date.now()
    
    const response = await this.fetchWithAuth("/api/intello/user/v1/sites")

    const requestDuration = Date.now() - requestStartTime
    logger.info(`[IntelloAdapter] List sites API response: ${response.status} ${response.statusText} (${requestDuration}ms)`)

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[IntelloAdapter] List sites API failed: ${response.status} ${errorText}`)
      throw new Error(`Failed to fetch Intello sites: ${response.status} ${errorText}`)
    }

    const sites = await response.json() as any[]
    logger.info(`[IntelloAdapter] Parsed ${sites.length} sites from API response`)

    const mappedSites = sites.map((site) => ({
      vendorSiteId: String(site.id),
      siteName: site.siteName || "",
      address: site.address,
      latitude: site.latitude,
      longitude: site.longitude,
      location: site.location,
      elevation: site.elevation,
      status: site.status,
      panelCount: site.panelCount,
      panelWattage: site.panelWattage,
      createdDate: site.createdDate,
      installerType: site.installerType,
      metadata: {
        rtuList: site.rtuList || [], // Store RTU list in metadata
      },
    }))

    // Log device counts per site
    mappedSites.forEach((site) => {
      const deviceCount = site.metadata?.rtuList?.length || 0
      logger.info(
        `[IntelloAdapter] Site ${site.vendorSiteId} (${site.siteName}): ${deviceCount} devices`
      )
    })

    return mappedSites
  }

  /**
   * Get report API base URL from environment variable
   * Separate from main API base URL for insolation report endpoint
   */
  private getReportApiBaseUrl(): string {
    const reportBaseUrl = process.env.INTELLO_REPORT_API_BASE_URL
    
    if (!reportBaseUrl) {
      throw new Error(
        `Report API base URL not configured. Please set INTELLO_REPORT_API_BASE_URL environment variable.`
      )
    }
    
    return reportBaseUrl
  }

  /**
   * Get insolation data for a specific device
   * Uses new API endpoint that returns pre-calculated daily insolation
   * @param deviceId - RTU ID (e.g., "RTU2684")
   * @param fromDate - Start date (YYYY-MM-DD) - API only supports single day per call
   * @param toDate - End date (YYYY-MM-DD) - should match fromDate for this API
   * @param deviceName - Optional device name (not used for INTELLO, kept for interface consistency)
   */
  async getInsolationData(
    deviceId: string,
    fromDate: string,
    toDate: string,
    deviceName?: string
  ): Promise<InsolationReading[]> {
    const reportApiBaseUrl = this.getReportApiBaseUrl()
    
    // New API endpoint: /report?fromDate=YYYY-MM-DD&mode=Daily&resultType=ZDGLOSS&rtuid={rtuid}
    // Note: API only supports single day per call, so we use fromDate
    // Uses separate report API base URL (INTELLO_REPORT_API_BASE_URL)
    const insolationUrl = `/report?fromDate=${fromDate}&mode=Daily&resultType=ZDGLOSS&rtuid=${deviceId}`
    const fullUrl = `${reportApiBaseUrl}${insolationUrl}`
    
    logger.info(`[IntelloAdapter] Calling insolation data API: GET ${fullUrl}`)
    logger.info(`[IntelloAdapter] Request params: deviceId=${deviceId}, fromDate=${fromDate}, toDate=${toDate}`)
    const requestStartTime = Date.now()
    
    // Use report API base URL for this endpoint (not the main API base URL)
    // Need to make direct fetch call since fetchWithAuth uses main API base URL
    const token = await this.authenticate()
    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    const requestDuration = Date.now() - requestStartTime
    logger.info(`[IntelloAdapter] Insolation data API response: ${response.status} ${response.statusText} (${requestDuration}ms)`)

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[IntelloAdapter] Insolation data API failed: ${response.status} ${errorText}`)
      throw new Error(
        `Failed to fetch Intello insolation data: ${response.status} ${errorText}`
      )
    }

    const result = await response.json() as any
    logger.info(`[IntelloAdapter] Received insolation API response for date: ${result.date || fromDate}`)

    // Parse dailyReport JSON string
    let insolationValue = 0
    let parsedDailyReport: any[] = []
    
    if (result.dailyReport) {
      try {
        parsedDailyReport = JSON.parse(result.dailyReport)
        if (Array.isArray(parsedDailyReport) && parsedDailyReport.length > 0) {
          // Extract insolation from first item in dailyReport array
          insolationValue = parsedDailyReport[0]?.insolation || 0
          logger.info(`[IntelloAdapter] Extracted insolation: ${insolationValue} kWh/m² from dailyReport`)
        } else {
          logger.warn(`[IntelloAdapter] dailyReport is empty or not an array: ${result.dailyReport}`)
        }
      } catch (parseError: any) {
        logger.error(`[IntelloAdapter] Failed to parse dailyReport JSON: ${parseError.message}`, { dailyReport: result.dailyReport })
        throw new Error(`Failed to parse dailyReport: ${parseError.message}`)
      }
    } else {
      logger.warn(`[IntelloAdapter] No dailyReport in response: ${JSON.stringify(result)}`)
    }

    // Return as InsolationReading format for consistency
    // Since API returns pre-calculated daily value, we create a single reading entry
    // The date comes from response.date or falls back to fromDate
    const responseDate = result.date || fromDate
    
    // Store insolation in kWh/m² directly in the generation field (similar to SCADA)
    // irr field is not used for pre-calculated values
    const mappedReadings: InsolationReading[] = [{
      deviceId: deviceId,
      date: responseDate,
      hour: "00:00:00", // Daily aggregated value, no specific hour
      generation: insolationValue, // Store kWh/m² directly (will be used by calculateDailyInsolation)
    } as InsolationReading & { generation?: number }]

    logger.info(`[IntelloAdapter] Mapped insolation: ${insolationValue} kWh/m² for device ${deviceId} on ${responseDate}`)

    return mappedReadings
  }

  /**
   * Calculate daily insolation from readings
   * For INTELLO, the API now returns pre-calculated daily insolation in kWh/m²
   * This method extracts the pre-calculated value directly (similar to SCADA)
   */
  calculateDailyInsolation(readings: InsolationReading[]): number {
    if (!readings || readings.length === 0) {
      return 0
    }

    // INTELLO API now returns pre-calculated daily insolation
    // The insolation value is stored in the generation field (kWh/m²)
    const hasGeneration = readings.some(r => (r as any).generation != null)
    
    if (hasGeneration) {
      // Use the generation field which contains kWh/m² directly
      const validReadings = readings.filter(r => (r as any).generation != null && (r as any).generation >= 0)
      if (validReadings.length === 0) {
        return 0
      }
      
      // For a single day, return the value directly
      if (validReadings.length === 1) {
        const insolationKwh = (validReadings[0] as any).generation
        logger.info(`[IntelloAdapter] Using pre-calculated insolation: ${insolationKwh} kWh/m²`)
        return insolationKwh
      }
      
      // If multiple readings (shouldn't happen for daily), average them
      const sum = validReadings.reduce((acc, r) => acc + ((r as any).generation || 0), 0)
      return sum / validReadings.length
    }

    // Fallback to base class calculation if generation field not available
    logger.warn(`[IntelloAdapter] No generation field found, using base calculation`)
    return super.calculateDailyInsolation(readings)
  }

  /**
   * Extract devices from sites
   * Intello returns devices (RTUs) within the site response
   */
  extractDevicesFromSite(site: WmsSite): WmsDevice[] {
    const rtuList = site.metadata?.rtuList || []
    
    return rtuList.map((rtu: any) => ({
      vendorDeviceId: rtu.id || "",
      deviceName: rtu.name,
      macAddress: rtu.macAddress,
      serialNo: rtu.serialNo,
      metadata: {
        ...rtu,
      },
    }))
  }
}

