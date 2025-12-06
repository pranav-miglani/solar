import { BaseWmsAdapter, type WmsSite, type WmsDevice, type InsolationReading } from "./baseWmsAdapter"
import type { WmsVendorConfig } from "./baseWmsAdapter"
import { getMainClient } from "@/lib/supabase/pooled"

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
      const { logger } = await import("@/lib/context/logger")
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
    const { logger } = await import("@/lib/context/logger")
    
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
    const { logger } = await import("@/lib/context/logger")
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
   * Get insolation data for a specific device
   * @param deviceId - RTU ID (e.g., "RTU2495")
   * @param fromDate - Start date (YYYY-MM-DD)
   * @param toDate - End date (YYYY-MM-DD)
   */
  async getInsolationData(
    deviceId: string,
    fromDate: string,
    toDate: string
  ): Promise<InsolationReading[]> {
    const { logger } = await import("@/lib/context/logger")
    const apiBaseUrl = this.getApiBaseUrl()
    const insolationUrl = `/api/intello/rtu/v1/data?fromDate=${fromDate}&toDate=${toDate}&mode=Daily&resultType=site&rtuid=${deviceId}`
    const fullUrl = `${apiBaseUrl}${insolationUrl}`
    
    logger.info(`[IntelloAdapter] Calling insolation data API: GET ${fullUrl}`)
    logger.info(`[IntelloAdapter] Request params: deviceId=${deviceId}, fromDate=${fromDate}, toDate=${toDate}`)
    const requestStartTime = Date.now()
    
    const response = await this.fetchWithAuth(insolationUrl)

    const requestDuration = Date.now() - requestStartTime
    logger.info(`[IntelloAdapter] Insolation data API response: ${response.status} ${response.statusText} (${requestDuration}ms)`)

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[IntelloAdapter] Insolation data API failed: ${response.status} ${errorText}`)
      throw new Error(
        `Failed to fetch Intello insolation data: ${response.status} ${errorText}`
      )
    }

    const readings = await response.json() as any[]
    logger.info(`[IntelloAdapter] Parsed ${readings.length} insolation readings from API response`)

    const mappedReadings = readings.map((reading) => ({
      deviceId: reading.id || deviceId,
      date: reading.date || fromDate,
      hour: reading.hour || "00:00:00",
      irr: reading.irr || 0,
      generation: reading.generation,
    }))

    if (mappedReadings.length > 0) {
      const avgIrr = mappedReadings.reduce((sum, r) => sum + (r.irr || 0), 0) / mappedReadings.length
      logger.info(`[IntelloAdapter] Average IRR: ${avgIrr.toFixed(2)} W/m² (from ${mappedReadings.length} readings)`)
    }

    return mappedReadings
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

