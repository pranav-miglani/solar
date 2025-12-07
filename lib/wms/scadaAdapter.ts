import { BaseWmsAdapter, type WmsSite, type WmsDevice, type InsolationReading } from "./baseWmsAdapter"
import type { WmsVendorConfig } from "./baseWmsAdapter"
import { getMainClient } from "@/lib/supabase/pooled"

/**
 * SCADA WMS Vendor Adapter
 * 
 * Handles authentication and data fetching from SCADA WMS API
 * API Base: https://log.poweramr.com
 */
export class ScadaAdapter extends BaseWmsAdapter {
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
   * Authenticate with SCADA API
   * Uses cached SS_KEY if available, otherwise fetches new key
   * SS_KEY is persistent and only refreshed if API calls fail
   */
  async authenticate(): Promise<string> {
    const credentials = this.getCredentials()
    const loginId = credentials.loginId as string
    const password = credentials.password as string
    const userName = credentials.userName as string
    const userType = credentials.userType as string

    if (!loginId || !password || !userName || !userType) {
      throw new Error("SCADA credentials missing: loginId, password, userName, and userType are required")
    }

    // Check for cached SS_KEY in database
    if (this.vendorId && this.supabaseClient) {
      const { logger } = await import("@/lib/context/logger")
      logger.info(`[ScadaAdapter] Checking for cached SS_KEY for vendor ID: ${this.vendorId}`)
      
      const { data: vendor } = await this.supabaseClient
        .from("wms_vendors")
        .select("access_token, token_metadata")
        .eq("id", this.vendorId)
        .single()

      if (vendor?.access_token) {
        // SS_KEY is persistent, use cached value
        logger.info(`[ScadaAdapter] Using cached SS_KEY: ${vendor.access_token.substring(0, 20)}...`)
        return vendor.access_token
      } else {
        logger.info(`[ScadaAdapter] No cached SS_KEY found, fetching new key`)
      }
    }

    // Fetch new SS_KEY
    const apiBaseUrl = this.getApiBaseUrl()
    const authUrl = `${apiBaseUrl}/api/CMN_07_Super/SLogin`
    const { logger } = await import("@/lib/context/logger")
    
    logger.info(`[ScadaAdapter] Calling authentication API: POST ${authUrl}`)
    logger.info(`[ScadaAdapter] Request params: LOGIN_ID=${loginId}, USER_NAME=${userName}, USER_TYPE=${userType}`)
    
    // Build form-urlencoded body
    const formData = new URLSearchParams()
    formData.append('LOGIN_ID', loginId)
    formData.append('PASSWORD', password)
    formData.append('USER_NAME', userName)
    formData.append('USER_TYPE', userType)

    const requestStartTime = Date.now()
    const response = await fetch(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "accept": "application/json, text/plain, */*",
        "origin": "https://scada.solaramr.com",
        "referer": "https://scada.solaramr.com/",
      },
      body: formData.toString(),
    })

    const requestDuration = Date.now() - requestStartTime
    logger.info(`[ScadaAdapter] Authentication API response: ${response.status} ${response.statusText} (${requestDuration}ms)`)

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[ScadaAdapter] Authentication API failed: ${response.status} ${errorText}`)
      throw new Error(`SCADA authentication failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const ssKey = data.SS_KEY as string
    const responseCode = data.responseCode as string
    const success = data.success as string

    if (!ssKey || success !== "True" || responseCode !== "Login Success") {
      logger.error(`[ScadaAdapter] Authentication failed in response: ${JSON.stringify(data)}`)
      throw new Error(`SCADA authentication failed: ${responseCode || "Unknown error"}`)
    }

    logger.info(`[ScadaAdapter] Authentication successful. SS_KEY obtained.`)

    // Cache SS_KEY in database (persistent, no expiration)
    if (this.vendorId && this.supabaseClient) {
      logger.info(`[ScadaAdapter] Caching SS_KEY in database`)
      await this.supabaseClient
        .from("wms_vendors")
        .update({
          access_token: ssKey,
          token_expires_at: null, // SS_KEY doesn't expire, but we'll refresh if API calls fail
          token_metadata: {
            loginId: loginId,
            userName: data.USER_NAME,
            stored_at: new Date().toISOString(),
          },
        })
        .eq("id", this.vendorId)
      logger.info(`[ScadaAdapter] SS_KEY cached successfully`)
    }

    return ssKey
  }

  /**
   * List all sites and devices from SCADA API
   * SCADA returns both sites and devices in a single API call
   */
  async listSites(): Promise<WmsSite[]> {
    const ssKey = await this.authenticate()
    const credentials = this.getCredentials()
    const loginId = credentials.loginId as string

    const apiBaseUrl = this.getApiBaseUrl()
    const sitesUrl = `${apiBaseUrl}/api/CMN_07_Super/POST_USER_SUM_LIST_WMS`
    const { logger } = await import("@/lib/context/logger")
    
    logger.info(`[ScadaAdapter] Calling list sites API: POST ${sitesUrl}`)
    logger.info(`[ScadaAdapter] Request params: LOGIN_ID=${loginId}`)

    // Build form-urlencoded body
    const formData = new URLSearchParams()
    formData.append('LOGIN_ID', loginId)
    formData.append('SS_KEY', ssKey)

    const requestStartTime = Date.now()
    const response = await fetch(sitesUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "accept": "*/*",
        "origin": "https://scada.solaramr.com",
        "referer": "https://scada.solaramr.com/",
      },
      body: formData.toString(),
    })

    const requestDuration = Date.now() - requestStartTime
    logger.info(`[ScadaAdapter] List sites API response: ${response.status} ${response.statusText} (${requestDuration}ms)`)

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[ScadaAdapter] List sites API failed: ${response.status} ${errorText}`)
      
      // If authentication error, try refreshing SS_KEY
      if (response.status === 401 || response.status === 403) {
        logger.info(`[ScadaAdapter] Authentication error detected, refreshing SS_KEY`)
        // Clear cached token and retry
        if (this.vendorId && this.supabaseClient) {
          await this.supabaseClient
            .from("wms_vendors")
            .update({ access_token: null })
            .eq("id", this.vendorId)
        }
        // Retry with fresh authentication
        return this.listSites()
      }
      
      throw new Error(`Failed to fetch SCADA sites: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    
    if (!result.success || !result.data || !Array.isArray(result.data)) {
      logger.error(`[ScadaAdapter] Invalid response format: ${JSON.stringify(result)}`)
      throw new Error("Invalid response format from SCADA API")
    }

    logger.info(`[ScadaAdapter] Parsed ${result.data.length} sites from API response`)

    // Map SCADA response to WmsSite format
    // Each item in data array represents a site with its device
    const siteMap = new Map<string, WmsSite>()

    result.data.forEach((item: any) => {
      const vendorSiteId = String(item.SN) // SN = vendor_site_id
      const siteName = item.user || "" // user = site_name
      
      // Parse PLANT_COMMISSIONED_DATE (format: "2025-Jul-16")
      let createdDate: string | undefined
      if (item.PLANT_COMMISSIONED_DATE) {
        try {
          const date = new Date(item.PLANT_COMMISSIONED_DATE)
          if (!isNaN(date.getTime())) {
            createdDate = date.toISOString().split('T')[0] // YYYY-MM-DD
          }
        } catch (e) {
          // Ignore date parsing errors
        }
      }

      if (!siteMap.has(vendorSiteId)) {
        // Create new site
        siteMap.set(vendorSiteId, {
          vendorSiteId,
          siteName,
          address: item.PLANT_LOCATION, // PLANT_LOCATION = address
          latitude: item.LATITUDE ? parseFloat(item.LATITUDE) : undefined,
          longitude: item.LONGITUDE ? parseFloat(item.LONGITUDE) : undefined,
          location: item.ADDRESS, // ADDRESS = location
          createdDate,
          metadata: {
            // Store device info in metadata for later extraction
            // Note: LOC_CODE is used for insolation API calls, so we use it as vendor_device_id
            devices: [{
              vendorDeviceId: String(item.LOC_CODE), // LOC_CODE = vendor_device_id (used for API calls)
              deviceName: item.LOC_CODE, // LOC_CODE = device_name
              macAddress: item.PASSWORD, // PASSWORD = mac_address
              serialNo: String(item.USER_ID), // USER_ID stored as serial_no
              metadata: {
                user_id: String(item.USER_ID), // Store USER_ID in metadata
              },
              createdDate,
            }],
          },
        })
      } else {
        // Add device to existing site
        const site = siteMap.get(vendorSiteId)!
        if (!site.metadata) {
          site.metadata = { devices: [] }
        }
        if (!site.metadata.devices) {
          site.metadata.devices = []
        }
        site.metadata.devices.push({
          vendorDeviceId: String(item.LOC_CODE), // LOC_CODE = vendor_device_id
          deviceName: item.LOC_CODE,
          macAddress: item.PASSWORD,
          serialNo: String(item.USER_ID), // USER_ID stored as serial_no
          metadata: {
            user_id: String(item.USER_ID),
          },
          createdDate,
        })
      }
    })

    const sites = Array.from(siteMap.values())
    logger.info(`[ScadaAdapter] Mapped ${sites.length} unique sites with devices`)

    return sites
  }

  /**
   * Get insolation data for a specific device
   * SCADA returns daily aggregated insolation values already in kWh/m²
   * @param deviceId - LOC_CODE (device identifier)
   * @param fromDate - Start date (YYYY-MM-DD)
   * @param toDate - End date (YYYY-MM-DD)
   */
  async getInsolationData(
    deviceId: string,
    fromDate: string,
    toDate: string
  ): Promise<InsolationReading[]> {
    const ssKey = await this.authenticate()
    const credentials = this.getCredentials()
    const loginId = credentials.loginId as string

    const apiBaseUrl = this.getApiBaseUrl()
    const insolationUrl = `${apiBaseUrl}/api/CMN_02/WM_DASH`
    const { logger } = await import("@/lib/context/logger")
    
    logger.info(`[ScadaAdapter] Calling insolation data API: POST ${insolationUrl}`)
    logger.info(`[ScadaAdapter] Request params: LOC_CODE=${deviceId}, LOGIN_ID=${loginId}, DT1=${fromDate}, DT2=${toDate}`)

    // Build form-urlencoded body
    const formData = new URLSearchParams()
    formData.append('LOC_CODE', deviceId)
    formData.append('LOGIN_ID', loginId)
    formData.append('WM_TYPE', 'ISO')
    formData.append('DT1', fromDate)
    formData.append('DT2', toDate)

    const requestStartTime = Date.now()
    const response = await fetch(insolationUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "accept": "application/json, text/plain, */*",
        "origin": "https://scada.solaramr.com",
        "referer": "https://scada.solaramr.com/",
      },
      body: formData.toString(),
    })

    const requestDuration = Date.now() - requestStartTime
    logger.info(`[ScadaAdapter] Insolation data API response: ${response.status} ${response.statusText} (${requestDuration}ms)`)

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[ScadaAdapter] Insolation data API failed: ${response.status} ${errorText}`)
      
      // If authentication error, try refreshing SS_KEY
      if (response.status === 401 || response.status === 403) {
        logger.info(`[ScadaAdapter] Authentication error detected, refreshing SS_KEY`)
        // Clear cached token and retry
        if (this.vendorId && this.supabaseClient) {
          await this.supabaseClient
            .from("wms_vendors")
            .update({ access_token: null })
            .eq("id", this.vendorId)
        }
        // Retry with fresh authentication
        return this.getInsolationData(deviceId, fromDate, toDate)
      }
      
      throw new Error(`Failed to fetch SCADA insolation data: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    
    if (!result.success || !result.WM_DASH || !Array.isArray(result.WM_DASH)) {
      logger.error(`[ScadaAdapter] Invalid insolation response format: ${JSON.stringify(result)}`)
      throw new Error("Invalid response format from SCADA insolation API")
    }

    logger.info(`[ScadaAdapter] Parsed ${result.WM_DASH.length} insolation readings from API response`)

    // Map SCADA response to InsolationReading format
    // SCADA returns daily values already in kWh/m²
    // Date format: "01-11-2025" (DD-MM-YYYY)
    const readings: InsolationReading[] = result.WM_DASH.map((item: any) => {
      // Parse date from DD-MM-YYYY to YYYY-MM-DD
      const dateParts = item.Date.split('-')
      if (dateParts.length === 3) {
        const day = dateParts[0]
        const month = dateParts[1]
        const year = dateParts[2]
        const isoDate = `${year}-${month}-${day}` // YYYY-MM-DD
        
        // SCADA returns daily aggregated values in kWh/m²
        const insolationKwh = parseFloat(item["Solar Insolation"]) || 0
        
        // Store the daily kWh/m² value
        // Note: irr field expects W/m², but for SCADA we store kWh/m² directly
        // The calculateDailyInsolation method will handle this correctly
        return {
          deviceId,
          date: isoDate,
          hour: "00:00:00", // Daily reading, use midnight
          irr: insolationKwh, // Store kWh/m² directly (will be handled in calculateDailyInsolation)
          generation: insolationKwh, // Store original kWh/m² value
        } as InsolationReading & { generation?: number }
      }
      return null
    }).filter((r: InsolationReading | null) => r !== null) as InsolationReading[]

    logger.info(`[ScadaAdapter] Mapped ${readings.length} insolation readings`)

    return readings
  }

  /**
   * Override calculateDailyInsolation for SCADA
   * SCADA already provides daily aggregated values in kWh/m²
   * So we can directly use the value without integration
   */
  calculateDailyInsolation(readings: InsolationReading[]): number {
    if (!readings || readings.length === 0) {
      return 0
    }

    // SCADA readings already contain daily aggregated values
    // Check if readings have the generation field (kWh/m²)
    const hasGeneration = readings.some(r => (r as any).generation != null)
    
    if (hasGeneration) {
      // Use the generation field which contains kWh/m² directly
      // For daily calculation, we can average or sum depending on the data
      // Since SCADA returns one reading per day, we can use the value directly
      const validReadings = readings.filter(r => (r as any).generation != null && (r as any).generation >= 0)
      if (validReadings.length === 0) {
        return 0
      }
      
      // For a single day, return the value directly
      // For multiple days, this method is called per day, so return the single value
      if (validReadings.length === 1) {
        return (validReadings[0] as any).generation
      }
      
      // If multiple readings (shouldn't happen for daily), average them
      const sum = validReadings.reduce((acc, r) => acc + ((r as any).generation || 0), 0)
      return sum / validReadings.length
    }

    // Fallback to base class calculation if generation field not available
    return super.calculateDailyInsolation(readings)
  }
}

