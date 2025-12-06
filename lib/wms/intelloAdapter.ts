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
          return vendor.access_token
        }
      }
    }

    // Fetch new token
    const apiBaseUrl = this.getApiBaseUrl()
    const response = await fetch(`${apiBaseUrl}/api/intello/authenticate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: email,
        password: passwordHash,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Intello authentication failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const token = data.token as string
    const expirationTime = data.expirationTime as number // seconds

    if (!token) {
      throw new Error("Intello authentication failed: no token in response")
    }

    // Cache token in database
    if (this.vendorId && this.supabaseClient) {
      const expiresAt = new Date(Date.now() + expirationTime * 1000)
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
    }

    return token
  }

  /**
   * List all sites from Intello API
   */
  async listSites(): Promise<WmsSite[]> {
    const response = await this.fetchWithAuth("/api/intello/user/v1/sites")

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch Intello sites: ${response.status} ${errorText}`)
    }

    const sites = await response.json() as any[]

    return sites.map((site) => ({
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
    const response = await this.fetchWithAuth(
      `/api/intello/rtu/v1/data?fromDate=${fromDate}&toDate=${toDate}&mode=Daily&resultType=site&rtuid=${deviceId}`
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `Failed to fetch Intello insolation data: ${response.status} ${errorText}`
      )
    }

    const readings = await response.json() as any[]

    return readings.map((reading) => ({
      deviceId: reading.id || deviceId,
      date: reading.date || fromDate,
      hour: reading.hour || "00:00:00",
      irr: reading.irr || 0,
      generation: reading.generation,
    }))
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

