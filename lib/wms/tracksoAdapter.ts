import { BaseWmsAdapter, type WmsSite, type WmsDevice, type InsolationReading } from "./baseWmsAdapter"
import type { WmsVendorConfig } from "./baseWmsAdapter"
import { logger } from "@/lib/context/logger"

/**
 * TRACKSO WMS Vendor Adapter
 * 
 * Handles authentication and data fetching from TRACKSO WMS API
 * API Base: https://prodapi.trackso.in
 */
export class TracksoAdapter extends BaseWmsAdapter {
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
   * Authenticate with TRACKSO API
   * Uses cached auth_token if valid, otherwise fetches new token
   * auth_token expires after 23 hours 30 minutes
   */
  async authenticate(): Promise<string> {
    const credentials = this.getCredentials()
    const email = credentials.email as string
    const password = credentials.password as string

    if (!email || !password) {
      throw new Error("TRACKSO credentials missing: email and password are required")
    }

    // Check for cached token in database
    if (this.vendorId && this.supabaseClient) {
      logger.info(`[TracksoAdapter] Checking for cached token for vendor ID: ${this.vendorId}`)
      
      const { data: vendor } = await this.supabaseClient
        .from("wms_vendors")
        .select("access_token, token_expires_at")
        .eq("id", this.vendorId)
        .single()

      if (vendor?.access_token) {
        if (vendor.token_expires_at) {
          const expiresAt = new Date(vendor.token_expires_at)
          const now = new Date()
          
          // Token is valid if it expires more than 5 minutes from now
          if (expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
            logger.info(`[TracksoAdapter] Using cached token (expires at: ${expiresAt.toISOString()})`)
            return vendor.access_token
          } else {
            logger.info(`[TracksoAdapter] Cached token expired (expires at: ${expiresAt.toISOString()}), fetching new token`)
          }
        } else {
          // Token exists but expiration is not present - set default 23h 30m
          logger.info(`[TracksoAdapter] Token expiration not present, setting default 23h 30m`)
          const defaultExpirationMs = 23 * 60 * 60 * 1000 + 30 * 60 * 1000 // 23h 30m in milliseconds
          const defaultExpiresAt = new Date(Date.now() + defaultExpirationMs)
          
          await this.supabaseClient
            .from("wms_vendors")
            .update({ token_expires_at: defaultExpiresAt.toISOString() })
            .eq("id", this.vendorId)
          
          logger.info(`[TracksoAdapter] Set default token expiration: ${defaultExpiresAt.toISOString()}, using cached token`)
          return vendor.access_token
        }
      } else {
        logger.info(`[TracksoAdapter] No cached token found, fetching new token`)
      }
    }

    // Fetch new token
    const apiBaseUrl = this.getApiBaseUrl()
    const authUrl = `${apiBaseUrl}/v1/login`
    
    logger.info(`[TracksoAdapter] Calling authentication API: POST ${authUrl}`)
    logger.info(`[TracksoAdapter] Request body: { email: "${email}", password: "***" }`)
    
    const requestStartTime = Date.now()
    const response = await fetch(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json, text/plain, */*",
        "origin": "https://solar.trackso.in",
        "referer": "https://solar.trackso.in/",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    })

    const requestDuration = Date.now() - requestStartTime
    logger.info(`[TracksoAdapter] Authentication API response: ${response.status} ${response.statusText} (${requestDuration}ms)`)

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[TracksoAdapter] Authentication API failed: ${response.status} ${errorText}`)
      throw new Error(`TRACKSO authentication failed: ${response.status} ${errorText}`)
    }

    const data = await response.json() as any
    const result = data.result
    const authToken = result?.auth_token as string
    const status = data.status as string
    const statusCode = data.statusCode as number

    if (!authToken || status !== "OK" || statusCode !== 200) {
      logger.error(`[TracksoAdapter] Authentication failed in response: ${JSON.stringify(data)}`)
      throw new Error("TRACKSO authentication failed: invalid response")
    }

    // Token expires after 23 hours 30 minutes
    const expirationTimeMs = 23 * 60 * 60 * 1000 + 30 * 60 * 1000 // 23h 30m in milliseconds
    const expiresAt = new Date(Date.now() + expirationTimeMs)

    logger.info(`[TracksoAdapter] Authentication successful. Token expires at: ${expiresAt.toISOString()}`)

    // Cache token in database
    if (this.vendorId && this.supabaseClient) {
      logger.info(`[TracksoAdapter] Caching token in database (expires at: ${expiresAt.toISOString()})`)
      
      // Store site_access in token_metadata for efficient access without re-authentication
      const tokenMetadata = {
        expirationTimeMs,
        stored_at: new Date().toISOString(),
        user_key: result.user_key,
        user_id: result.id,
        site_access: result.site_access || {}, // Store device information from auth response
      }
      
      await this.supabaseClient
        .from("wms_vendors")
        .update({
          access_token: authToken,
          token_expires_at: expiresAt.toISOString(),
          token_metadata: tokenMetadata,
        })
        .eq("id", this.vendorId)
      logger.info(`[TracksoAdapter] Token cached successfully with site_access (${Object.keys(result.site_access || {}).length} devices)`)
    }

    return authToken
  }

  /**
   * List all sites from TRACKSO API
   * Devices are returned in the authentication response (site_access)
   * We fetch full site details for each device
   * Uses cached site_access from token_metadata to avoid re-authentication
   */
  async listSites(): Promise<WmsSite[]> {
    const apiBaseUrl = this.getApiBaseUrl()
    
    // Authenticate to get token (may use cached token)
    const authToken = await this.authenticate()
    
    // Try to get site_access from cached token_metadata first
    let siteAccess: Record<string, { access_level: number; site_name: string }> = {}
    
    if (this.vendorId && this.supabaseClient) {
      logger.info(`[TracksoAdapter] Fetching site_access from token_metadata`)
      
      const { data: vendor } = await this.supabaseClient
        .from("wms_vendors")
        .select("token_metadata")
        .eq("id", this.vendorId)
        .maybeSingle()

      if (vendor?.token_metadata?.site_access) {
        siteAccess = vendor.token_metadata.site_access as Record<string, { access_level: number; site_name: string }>
        logger.info(`[TracksoAdapter] Found ${Object.keys(siteAccess).length} devices in cached site_access`)
      } else {
        logger.warn(`[TracksoAdapter] No site_access in token_metadata, will need to re-authenticate to fetch`)
      }
    }

    // If site_access is not in cache, we need to fetch it (this should be rare)
    // This can happen if token_metadata was not stored properly or was cleared
    if (Object.keys(siteAccess).length === 0) {
      logger.info(`[TracksoAdapter] site_access not in cache, fetching from authentication API`)
      
      const credentials = this.getCredentials()
      const email = credentials.email as string
      const password = credentials.password as string
      
      const authUrl = `${apiBaseUrl}/v1/login`
      const authResponse = await fetch(authUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "accept": "application/json, text/plain, */*",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      })

      if (!authResponse.ok) {
        throw new Error(`Failed to fetch site_access: ${authResponse.status}`)
      }

      const authData = await authResponse.json() as any
      siteAccess = authData.result?.site_access as Record<string, { access_level: number; site_name: string }> || {}
      
      // Update token_metadata with site_access for future use
      if (this.vendorId && this.supabaseClient && Object.keys(siteAccess).length > 0) {
        const { data: vendor } = await this.supabaseClient
          .from("wms_vendors")
          .select("token_metadata")
          .eq("id", this.vendorId)
          .maybeSingle()
        
        if (vendor?.token_metadata) {
          await this.supabaseClient
            .from("wms_vendors")
            .update({
              token_metadata: {
                ...vendor.token_metadata,
                site_access: siteAccess,
              },
            })
            .eq("id", this.vendorId)
          logger.info(`[TracksoAdapter] Updated token_metadata with site_access`)
        }
      }

      logger.info(`[TracksoAdapter] Found ${Object.keys(siteAccess).length} devices in site_access from API`)
    }

    // Fetch full site details for each device
    const sites: WmsSite[] = []
    const deviceIds = Object.keys(siteAccess)

    for (const deviceId of deviceIds) {
      try {
        const siteInfo = siteAccess[deviceId]
        const siteUrl = `${apiBaseUrl}/sites/${deviceId}`
        
        logger.info(`[TracksoAdapter] Fetching site details for device ${deviceId}: GET ${siteUrl}`)
        const requestStartTime = Date.now()
        
        const siteResponse = await fetch(siteUrl, {
          method: "GET",
          headers: {
            "accept": "application/json",
            "x-auth-token": authToken,
          },
        })

        const requestDuration = Date.now() - requestStartTime
        logger.info(`[TracksoAdapter] Site details API response: ${siteResponse.status} ${requestDuration}ms`)

        if (!siteResponse.ok) {
          // If authentication error, try refreshing token
          if (siteResponse.status === 401 || siteResponse.status === 403) {
            logger.info(`[TracksoAdapter] Authentication error detected in listSites, refreshing token`)
            // Clear cached token
            if (this.vendorId && this.supabaseClient) {
              await this.supabaseClient
                .from("wms_vendors")
                .update({ access_token: null, token_expires_at: null })
                .eq("id", this.vendorId)
            }
            // Retry entire listSites with fresh authentication
            return this.listSites()
          }
          logger.warn(`[TracksoAdapter] Failed to fetch site details for device ${deviceId}: ${siteResponse.status}`)
          continue
        }

        const siteData = await siteResponse.json() as any
        const siteResult = siteData.result

        if (!siteResult) {
          logger.warn(`[TracksoAdapter] No result in site response for device ${deviceId}`)
          continue
        }

        // Map TRACKSO site to WmsSite
        // Priority: siteInfo.site_name (from site_access) > siteResult.name (from full site API)
        // This ensures siteName and address match deviceName as per user requirement
        const deviceName = siteInfo.site_name || siteResult.name || ""
        
        const site: WmsSite = {
          vendorSiteId: siteResult.id || deviceId,
          siteName: deviceName, // Use deviceName from site_access as primary
          address: deviceName, // Same as siteName (and deviceName) as per user requirement
          latitude: siteResult.coordinates?.[0] ? parseFloat(siteResult.coordinates[0]) : undefined,
          longitude: siteResult.coordinates?.[1] ? parseFloat(siteResult.coordinates[1]) : undefined,
          location: siteResult.description || "",
          elevation: siteResult.panel_average_tilt || undefined,
          status: siteResult.siteStatus?.status || undefined,
          panelCount: siteResult.panel_count || undefined,
          panelWattage: siteResult.ac_capacity || siteResult.site_capacity || undefined,
          createdDate: siteResult.createdAt ? new Date(siteResult.createdAt).toISOString() : undefined,
          metadata: {
            site_key: siteResult.site_key || deviceId,
            type: siteResult.type,
            owner: siteResult.owner,
            phone_number: siteResult.phone_number,
            timezone: siteResult.timezone,
            // Store device info in metadata
            devices: [{
              vendorDeviceId: siteResult.site_key || deviceId,
              deviceName: deviceName, // Use same deviceName for consistency
              metadata: {
                site_key: siteResult.site_key || deviceId,
                site_id: siteResult.id,
              },
            }],
          },
        }

        sites.push(site)
      } catch (error: any) {
        logger.error(`[TracksoAdapter] Error fetching site details for device ${deviceId}: ${error.message}`)
        // Continue with other devices
      }
    }

    logger.info(`[TracksoAdapter] Successfully fetched ${sites.length} sites`)

    return sites
  }

  /**
   * Get insolation data for a specific device
   * @param deviceId - Site key (e.g., "e3838e49a8")
   * @param fromDate - Start date (YYYY-MM-DD)
   * @param toDate - End date (YYYY-MM-DD)
   * @param deviceName - Optional device name (not used for TRACKSO, kept for interface consistency)
   */
  async getInsolationData(
    deviceId: string,
    fromDate: string,
    toDate: string,
    deviceName?: string
  ): Promise<InsolationReading[]> {
    const apiBaseUrl = this.getApiBaseUrl()
    const authToken = await this.authenticate()

    // Convert dates to epoch milliseconds in IST (Asia/Kolkata) timezone
    // For TRACKSO, if fromDate === toDate, use that single day's start and end in IST
    // Otherwise, use the range from start of fromDate to end of toDate in IST
    
    // Helper function to convert date string to IST start of day (00:00:00 IST)
    const getISTStartOfDay = (dateStr: string): number => {
      // Parse date string (YYYY-MM-DD)
      const [year, month, day] = dateStr.split('-').map(Number)
      // Create date string in IST format: "YYYY-MM-DD 00:00:00" in IST
      // Use Intl.DateTimeFormat to get the correct epoch for IST midnight
      const istDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+05:30`
      return new Date(istDateStr).getTime()
    }

    // Helper function to convert date string to IST end of day (23:59:59.999 IST)
    const getISTEndOfDay = (dateStr: string): number => {
      const [year, month, day] = dateStr.split('-').map(Number)
      const istDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59.999+05:30`
      return new Date(istDateStr).getTime()
    }

    // For TRACKSO: if fromDate === toDate, use that single day's range in IST
    // Otherwise, use fromDate start to toDate end in IST
    let startTime: number
    let endTime: number

    if (fromDate === toDate) {
      // Single day: use that day's start and end in IST
      startTime = getISTStartOfDay(fromDate)
      endTime = getISTEndOfDay(toDate)
    } else {
      // Date range: use start of fromDate to end of toDate in IST
      startTime = getISTStartOfDay(fromDate)
      endTime = getISTEndOfDay(toDate)
    }

    const insolationUrl = `${apiBaseUrl}/dataquery/site`
    
    logger.info(`[TracksoAdapter] Calling insolation data API: POST ${insolationUrl}`)
    logger.info(`[TracksoAdapter] Request params: deviceId=${deviceId}, fromDate=${fromDate}, toDate=${toDate}, startTime=${startTime}, endTime=${endTime}`)
    
    const requestBody = {
      startTime,
      endTime,
      timeGrouping: "DAY",
      limit: 1,
      provideBufferData: false,
      suppressErrors: true,
      bufferInterval: null,
      cumulate: false,
      siteParameterAggregationType: {
        [deviceId]: [
          {
            parameterName: "Solar Insolation",
            dataQueryOperation: "LAST",
          },
        ],
      },
    }

    logger.info(`[TracksoAdapter] Request body: ${JSON.stringify(requestBody, null, 2)}`)

    const requestStartTime = Date.now()
    const response = await fetch(insolationUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json",
        "x-auth-token": authToken,
      },
      body: JSON.stringify(requestBody),
    })

    const requestDuration = Date.now() - requestStartTime
    logger.info(`[TracksoAdapter] Insolation data API response: ${response.status} ${response.statusText} (${requestDuration}ms)`)

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[TracksoAdapter] Insolation data API failed: ${response.status} ${errorText}`)
      
      // If authentication error, try refreshing token
      if (response.status === 401 || response.status === 403) {
        logger.info(`[TracksoAdapter] Authentication error detected, refreshing token`)
        // Clear cached token and retry
        if (this.vendorId && this.supabaseClient) {
          await this.supabaseClient
            .from("wms_vendors")
            .update({ access_token: null, token_expires_at: null })
            .eq("id", this.vendorId)
        }
        // Retry with fresh authentication
        return this.getInsolationData(deviceId, fromDate, toDate, deviceName)
      }
      
      throw new Error(
        `Failed to fetch TRACKSO insolation data: ${response.status} ${errorText}`
      )
    }

    const result = await response.json() as any
    logger.info(`[TracksoAdapter] Response body: ${JSON.stringify(result, null, 2)}`)
    
    const resultData = result.result?.result as any[]

    if (!resultData || resultData.length === 0) {
      logger.warn(`[TracksoAdapter] No insolation data in response for device ${deviceId}`)
      return []
    }

    // Extract insolation values from response
    const readings: InsolationReading[] = []

    for (const siteData of resultData) {
      const dataArray = siteData.data as any[]
      if (!dataArray || dataArray.length === 0) {
        continue
      }

      for (const dataPoint of dataArray) {
        if (dataPoint.parameter_name === "Solar Insolation") {
          const insolationValue = parseFloat(dataPoint.value) || 0
          const timestamp = dataPoint.timestamp || dataPoint.latest_timestamp

          // Convert timestamp to date string
          const date = new Date(timestamp)
          const dateStr = date.toISOString().split("T")[0]

          readings.push({
            deviceId: deviceId,
            date: dateStr,
            hour: "00:00:00", // Daily reading, use midnight
            generation: insolationValue, // Store kWh/m² directly (pre-calculated)
          } as InsolationReading & { generation?: number })
        }
      }
    }

    logger.info(`[TracksoAdapter] Mapped ${readings.length} insolation readings`)

    return readings
  }

  /**
   * Calculate daily insolation from readings
   * For TRACKSO, the API returns pre-calculated daily insolation in kWh/m²
   * This method extracts the pre-calculated value directly (similar to SCADA, INTELLO)
   */
  calculateDailyInsolation(readings: InsolationReading[]): number {
    if (!readings || readings.length === 0) {
      return 0
    }

    // TRACKSO API returns pre-calculated daily insolation
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
        logger.info(`[TracksoAdapter] Using pre-calculated insolation: ${insolationKwh} kWh/m²`)
        return insolationKwh
      }
      
      // If multiple readings (shouldn't happen for daily), average them
      const sum = validReadings.reduce((acc, r) => acc + ((r as any).generation || 0), 0)
      return sum / validReadings.length
    }

    // Fallback to base class calculation if generation field not available
    logger.warn(`[TracksoAdapter] No generation field found, using base calculation`)
    return super.calculateDailyInsolation(readings)
  }

  /**
   * Extract devices from sites
   * TRACKSO returns devices in site metadata
   */
  extractDevicesFromSite(site: WmsSite): WmsDevice[] {
    const devices = site.metadata?.devices || []
    
    return devices.map((device: any) => ({
      vendorDeviceId: device.vendorDeviceId || "",
      deviceName: device.deviceName,
      macAddress: device.macAddress, // Include if available
      serialNo: device.serialNo, // Include if available
      metadata: {
        ...device.metadata,
      },
    }))
  }
}

