import { createHash } from "crypto"
import { BaseVendorAdapter } from "./baseVendorAdapter"
import type {
  Plant,
  TelemetryData,
  Alert,
  RealtimeData,
  VendorConfig,
} from "./types"
import { pooledFetch } from "./httpClient"
import { logger } from "@/lib/context/logger"

const BATCH_SIZE = 10
const BATCH_DELAY_MS = 1100
/** FoxESS rate-limit errno: "Too many requests, please retry later" */
const FOX_ERRNO_RATE_LIMIT = 40400
const RATE_LIMIT_RETRY_DELAY_MS = 5000
const RATE_LIMIT_MAX_RETRIES = 3

// --- FoxESS API response types ---

interface FoxApiResponse<T = unknown> {
  errno: number
  msg?: string
  result?: T
}

/** Minimal plant from POST /op/v0/plant/list (list does not include capacity, address, etc.) */
interface FoxPlantListItem {
  stationID: string
  name: string
  ianaTimezone?: string
}

interface FoxPlantListResult {
  currentPage: number
  pageSize: number
  total: number
  data: FoxPlantListItem[]
}

/** Full plant from GET /op/v0/plant/detail?id={stationID} (used for capacity, address, createDate, modules) */
interface FoxPlantDetailResult {
  stationName?: string
  country?: string
  address?: string
  city?: string
  timezone?: string
  postcode?: string
  capacity?: number
  createDate?: string
  modules?: Array<{ moduleSN?: string; deviceSN?: string }>
  installer?: { name?: string; email?: string; phone?: string }
  user?: { name?: string; email?: string; phone?: string }
}

interface FoxDeviceItem {
  deviceSN: string
  deviceType?: string
  stationID?: string
  stationName?: string
  status?: number
}

interface FoxDeviceListResult {
  currentPage?: number
  pageSize?: number
  total?: number
  data: FoxDeviceItem[]
}

/** Device detail from GET /op/v1/device/detail?sn={sn} */
interface FoxDeviceDetailResult {
  deviceType?: string
  deviceSN?: string
  capacity?: number
  stationName?: string
  stationID?: string
  status?: number
  hasPV?: boolean
  hasBattery?: boolean
  productType?: string
  moduleSN?: string
  batteryList?: unknown[]
  masterVersion?: string
  slaveVersion?: string
  [key: string]: unknown
}

/** GET /op/v0/device/generation?sn={sn} - returns today, month, cumulative only */
interface FoxGenerationResult {
  today?: number
  month?: number
  cumulative?: number
}

interface FoxHistoryDataPoint {
  variable: string
  unit?: string
  data: Array<[number, number]> // [epochMs, value]
}

interface FoxHistoryResult {
  deviceSN?: string
  datas?: FoxHistoryDataPoint[]
}

interface FoxReportResult {
  data?: Array<{ index: number; value: number }>
}

/** POST /op/v0/device/report/query with dimension "year" - result is array of { variable, unit?, values } (values = per month) */
interface FoxReportYearResultItem {
  variable?: string
  unit?: string
  values?: number[]
}

/** real/query can return object keyed by SN or array of { deviceSN, datas } */
interface FoxRealQueryResult {
  [deviceSN: string]: Array<{ variable: string; value?: number; data?: number; unit?: string }>
}

interface FoxRealQueryResultItem {
  deviceSN: string
  time?: string
  datas?: Array<{ variable: string; value?: number; data?: number; unit?: string }>
}

interface FoxErrorItem {
  id?: string
  errorCode?: string
  errorName?: string
  deviceSN?: string
  level?: number
  startTime?: number
  endTime?: number
}

// --- Helpers ---

function mapFoxStatus(status: number): string {
  switch (status) {
    case 1:
      return "NORMAL"
    case 2:
      return "ALL_OFFLINE"
    case 3:
      return "PARTIAL_OFFLINE"
    default:
      return "ALL_OFFLINE"
  }
}

function mapFoxAlertSeverity(
  level: number
): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  switch (level) {
    case 0:
      return "LOW"
    case 1:
      return "MEDIUM"
    case 2:
      return "HIGH"
    case 3:
      return "CRITICAL"
    default:
      return "MEDIUM"
  }
}

/** Parse FoxESS createDate e.g. "2025-04-12 17:46:42 IST+0530" to ISO string */
function parseFoxCreateDate(createDate: string | undefined): string | null {
  if (!createDate || typeof createDate !== "string") return null
  try {
    const normalized = createDate.replace(/\s+IST[^\s]*$/, "").trim().replace(" ", "T")
    const date = new Date(normalized)
    if (!isNaN(date.getTime())) return date.toISOString()
  } catch {
    // ignore
  }
  return null
}

export class FoxesscloudAdapter extends BaseVendorAdapter {


  protected getApiBaseUrl(): string {
    if (this.config.apiBaseUrl) {
      return this.config.apiBaseUrl
    }
    return (
      process.env.FOXESSCLOUD_API_BASE_URL || "https://www.foxesscloud.com"
    )
  }

  /**
   * Build FoxESS request headers: token (apiKey), timestamp, signature (MD5), lang.
   * Signature = MD5(path + "\\r\\n" + token + "\\r\\n" + timestamp) using the four
   * characters backslash-r-backslash-n (per FoxESS API). path = pathname only, no query.
   */
  private buildFoxHeaders(pathOrUrl: string): Record<string, string> {
    const credentials = this.getCredentials()
    const apiKey = credentials.apiKey as string
    if (!apiKey) {
      throw new Error("[FoxESS] credentials.apiKey is required")
    }
    let pathForSignature: string
    if (pathOrUrl.startsWith("http")) {
      pathForSignature = new URL(pathOrUrl).pathname
    } else {
      pathForSignature = pathOrUrl.includes("?") ? pathOrUrl.split("?")[0] : pathOrUrl
    }
    const timestamp = Date.now().toString()
    const sep = "\\r\\n"
    const rawSig = pathForSignature + sep + apiKey + sep + timestamp
    const signature = createHash("md5").update(rawSig, "utf8").digest("hex")

    logger.info("[FoxESS] Signature generation", { pathForSignature, timestamp, signature })

    return {
      token: apiKey,
      timestamp,
      signature,
      lang: "en",
      "Content-Type": "application/json",
    }
  }

  /**
   * Log request/response for FoxESS API call (similar to SolarDM loggedFetch).
   * Logs full headers (token, signature) for debugging; redact in production if needed.
   */
  private async loggedFoxGet(
    path: string,
    context?: { operation?: string; description?: string }
  ): Promise<unknown> {
    const baseUrl = this.getApiBaseUrl()
    const url = path.startsWith("http") ? path : `${baseUrl}${path}`
    const pathOnly = path.startsWith("http") ? new URL(path).pathname : path
    const headers = this.buildFoxHeaders(pathOnly)
    const operation = context?.operation ?? "API_GET"
    const description = context?.description ?? pathOnly

    logger.info(`[FoxESS] ${operation}: ${description}`)
    logger.info(`[FoxESS] Request URL: ${url}`)
    logger.info("[FoxESS] Request method: GET")
    logger.info("[FoxESS] Request headers:", JSON.stringify(headers, null, 2))

    const res = await pooledFetch(url, { method: "GET", headers })

    logger.info(`[FoxESS] Response status: ${res.status} ${res.statusText}`)
    const resClone = res.clone()
    try {
      const text = await resClone.text()
      logger.info(
        `[FoxESS] Response body (first 500 chars):`,
        text.length > 500 ? text.substring(0, 500) + "..." : text
      )
    } catch {
      logger.info("[FoxESS] Could not read response body for logging")
    }

    if (!res.ok) {
      throw new Error(`[FoxESS] HTTP ${res.status} on ${path}`)
    }
    const data = (await res.json()) as FoxApiResponse
    if (data.errno !== 0) {
      throw new Error(
        `[FoxESS] API error errno=${data.errno} on ${path}: ${data.msg ?? "unknown"}`
      )
    }
    return data.result
  }

  /**
   * Log request/response for FoxESS API POST (similar to SolarDM loggedFetch).
   * Logs full headers for debugging; sanitizes body (array lengths for large arrays).
   */
  private async loggedFoxPost(
    path: string,
    body: object,
    context?: { operation?: string; description?: string }
  ): Promise<unknown> {
    const baseUrl = this.getApiBaseUrl()
    const url = `${baseUrl}${path}`
    const headers = this.buildFoxHeaders(path)
    const operation = context?.operation ?? "API_POST"
    const description = context?.description ?? path

    const logBody: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(body)) {
      logBody[k] = Array.isArray(v) && v.length > 5 ? `[${v.length} items]` : v
    }

    logger.info(`[FoxESS] ${operation}: ${description}`)
    logger.info(`[FoxESS] Request URL: ${url}`)
    logger.info("[FoxESS] Request method: POST")
    logger.info("[FoxESS] Request headers:", JSON.stringify(headers, null, 2))
    logger.info("[FoxESS] Request body:", JSON.stringify(logBody, null, 2))

    const res = await pooledFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    })

    logger.info(`[FoxESS] Response status: ${res.status} ${res.statusText}`)
    const resClone = res.clone()
    try {
      const text = await resClone.text()
      logger.info(
        `[FoxESS] Response body (first 500 chars):`,
        text.length > 500 ? text.substring(0, 500) + "..." : text
      )
    } catch {
      logger.info("[FoxESS] Could not read response body for logging")
    }

    if (!res.ok) {
      throw new Error(`[FoxESS] HTTP ${res.status} on ${path}`)
    }
    const data = (await res.json()) as FoxApiResponse
    if (data.errno !== 0) {
      throw new Error(
        `[FoxESS] API error errno=${data.errno} on ${path}: ${data.msg ?? "unknown"}`
      )
    }
    return data.result
  }

  private async foxGet(path: string): Promise<unknown> {
    return this.loggedFoxGet(path)
  }

  private async foxPost(path: string, body: object): Promise<unknown> {
    return this.loggedFoxPost(path, body)
  }

  async authenticate(): Promise<string> {
    const credentials = this.getCredentials()
    const apiKey = credentials.apiKey as string | undefined
    if (!apiKey) {
      throw new Error("[FoxESS] credentials.apiKey is required")
    }
    const baseUrl = this.getApiBaseUrl()
    logger.info("[FoxESS] Using API key authentication (no login required)", { baseUrl })
    return apiKey
  }

  /**
   * Get device SNs for a given plant (stationID). Paginates through device list and filters by plantID.
   */
  private async getDeviceSNsForPlant(plantId: string): Promise<string[]> {
    const sns: string[] = []
    let page = 1
    const pageSize = 20
    let hasMore = true
    while (hasMore) {
      const result = (await this.foxPost("/op/v0/device/list", {
        currentPage: page,
        pageSize,
      })) as FoxDeviceListResult
      const list = result?.data ?? []
      for (const d of list) {
        if (d.stationID === plantId && d.deviceSN) {
          sns.push(d.deviceSN)
        }
      }
      const total = result?.total ?? 0
      if (list.length < pageSize || page * pageSize >= total) {
        hasMore = false
      } else {
        page++
      }
    }
    logger.info(`[FoxESS] Successfully fetched deviceSNs for plant ${plantId}: ${sns}`)
    return sns
  }

  /**
   * Build stationID -> single FoxDeviceItem (one-to-one: one plant has one device).
   */
  private async getPlantToDevicesMap(): Promise<Map<string, FoxDeviceItem>> {
    const map = new Map<string, FoxDeviceItem>()
    let page = 1
    const pageSize = 20
    let hasMore = true
    while (hasMore) {
      const result = (await this.foxPost("/op/v0/device/list", {
        currentPage: page,
        pageSize,
      })) as FoxDeviceListResult
      const list = result?.data ?? []
      for (const d of list) {
        if (d.stationID) {
          map.set(d.stationID, d)
        }
      }
      const total = result?.total ?? 0
      if (list.length < pageSize || page * pageSize >= total) {
        hasMore = false
      } else {
        page++
      }
    }
    logger.info(`[FoxESS] Successfully fetched plantToDevices :  ${JSON.stringify(map, null, 2)} `)
    return map
  }

  /** Retry an async fn on rate-limit (errno 40400) with backoff. */
  private async retryOnRateLimit<T>(
    fn: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastErr: Error | null = null
    for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
      try {
        return await fn()
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e))
        const isRateLimit =
          lastErr.message.includes(`errno=${FOX_ERRNO_RATE_LIMIT}`) ||
          lastErr.message.includes("40400")
        if (!isRateLimit || attempt === RATE_LIMIT_MAX_RETRIES) {
          throw lastErr
        }
        const delayMs = RATE_LIMIT_RETRY_DELAY_MS * (attempt + 1)
        logger.warn(
          `[FoxESS] Rate limit (40400) on ${context}, retry ${attempt + 1}/${RATE_LIMIT_MAX_RETRIES} in ${delayMs}ms`
        )
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }
    throw lastErr ?? new Error("retry failed")
  }

  /**
   * Fetch full plant details (capacity, address, createDate, modules). List API only returns stationID, name, ianaTimezone.
   * Retries on rate-limit (errno 40400).
   */
  private async getPlantDetail(stationID: string): Promise<FoxPlantDetailResult | null> {
    try {
      return await this.retryOnRateLimit(
        async () => {
          const path = `/op/v0/plant/detail?id=${encodeURIComponent(stationID)}`
          const result = (await this.foxGet(path)) as FoxPlantDetailResult | undefined
          return result ?? null
        },
        `getPlantDetail(${stationID})`
      )
    } catch (e) {
      logger.warn(`[FoxESS] getPlantDetail failed for ${stationID}:`, e)
      return null
    }
  }

  /**
   * Fetch device info by SN. GET /op/v1/device/detail?sn={sn}
   */
  private async getDeviceDetail(sn: string): Promise<FoxDeviceDetailResult | null> {
    try {
      const path = `/op/v1/device/detail?sn=${encodeURIComponent(sn)}`
      const result = (await this.foxGet(path)) as FoxDeviceDetailResult | undefined
      return result ?? null
    } catch (e) {
      logger.warn(`[FoxESS] getDeviceDetail failed for ${sn}:`, e)
      return null
    }
  }

  /**
   * Fetch all stations from POST /op/v0/plant/list (paginated).
   */
  private async fetchAllStations(): Promise<FoxPlantListItem[]> {
    const allStations: FoxPlantListItem[] = []
    let page = 1
    const pageSize = 100
    let hasMore = true
    while (hasMore) {
      const result = (await this.loggedFoxPost(
        "/op/v0/plant/list",
        {
          currentPage: page,
          pageSize,
        },
        { operation: "LIST_PLANTS", description: `Fetch plant list page ${page}` }
      )) as FoxPlantListResult
      const list = result?.data ?? []
      const total = result?.total ?? 0
      allStations.push(...list)
      if (list.length < pageSize || page * pageSize >= total) {
        hasMore = false
      } else {
        page++
      }
    }
    logger.info(`[FoxESS] Successfully fetched allStations :  ${JSON.stringify(allStations, null, 2)} `)
    return allStations
  }

  /**
   * Fetch plant details (location, capacity, address, createDate) in parallel, 10 at a time.
   * Returns a map of stationID (vendor plant id) to FoxPlantDetailResult or null.
   */
  private async fetchPlantDetailsMap(
    stations: FoxPlantListItem[]
  ): Promise<Map<string, FoxPlantDetailResult | null>> {
    const detailByStationId = new Map<string, FoxPlantDetailResult | null>()
    const detailBatchSize = 5
    for (let i = 0; i < stations.length; i += detailBatchSize) {
      const batch = stations.slice(i, i + detailBatchSize)
      const details = await Promise.all(
        batch.map((s) => this.getPlantDetail(s.stationID))
      )
      batch.forEach((s, j) => detailByStationId.set(s.stationID, details[j] ?? null))
      if (i + detailBatchSize < stations.length) {
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
    return detailByStationId
  }

  /**
   * Fetch energy generation (today, month, cumulative) for all device SNs in parallel, in batches of 10.
   * Returns a map of device SN to FoxGenerationResult (daily = today, monthly = month, total = cumulative).
   */
  private async getDeviceIdToDailyMonthlyAndTotalEnergy(
    deviceSns: string[]
  ): Promise<Map<string, FoxGenerationResult>> {
    const generationByDeviceSN = new Map<string, FoxGenerationResult>()
    for (let i = 0; i < deviceSns.length; i += BATCH_SIZE) {
      const batch = deviceSns.slice(i, i + BATCH_SIZE)
      const settled = await Promise.allSettled(
        batch.map((sn) =>
          this.foxGet(`/op/v0/device/generation?sn=${encodeURIComponent(sn)}`)
        )
      )
      batch.forEach((sn, j) => {
        const s = settled[j]
        if (s?.status === "fulfilled" && s.value) {
          generationByDeviceSN.set(sn, s.value as FoxGenerationResult)
        }
      })
      if (i + BATCH_SIZE < deviceSns.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
      }
    }
    logger.info(`[FoxESS] Successfully fetched generationByDeviceSN :  ${JSON.stringify(generationByDeviceSN, null, 2)} `)
    return generationByDeviceSN
  }

  /**
   * Get current power (kW) for all device SNs in a single POST /op/v1/device/real/query call.
   * Returns map of deviceSN -> currentPowerKw (value from generationPower, in kW).
   */
  private async getDeviceIdToCurrentPowerKw(
    deviceSns: string[]
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>()
    if (deviceSns.length === 0) return map
    try {
      const result = (await this.foxPost("/op/v1/device/real/query", {
        sns: deviceSns,
        variables: ["generationPower"],
      })) as FoxRealQueryResult | FoxRealQueryResultItem[]
      if (Array.isArray(result)) {
        for (const item of result as FoxRealQueryResultItem[]) {
          const sn = item.deviceSN
          const datas = item.datas ?? []
          const genPower = datas.find((d) => d.variable === "generationPower")
          const val = genPower?.value ?? genPower?.data ?? 0
          const kw = genPower?.unit === "kW" ? Number(val) : Number(val) / 1000
          map.set(sn, kw)
        }
      } else {
        for (const [sn, arr] of Object.entries(result ?? {})) {
          if (!Array.isArray(arr)) continue
          const genPower = arr.find((d) => d.variable === "generationPower")
          const val = genPower?.value ?? genPower?.data ?? 0
          const kw = genPower?.unit === "kW" ? Number(val) : Number(val) / 1000
          map.set(sn, kw)
        }
      }
    } catch (e) {
      logger.warn("[FoxESS] getDeviceIdToCurrentPowerKw real/query failed:", e)
    }
    logger.info(`[FoxESS] Successfully fetched deviceIdToCurrentPowerKw :  ${JSON.stringify(map, null, 2)} `)
    return map
  }

  /**
   * Get yearly energy (kWh) for all device SNs via POST /op/v0/device/report/query per device (dimension "year").
   * Response result can be array of { variable, values } (sum values = yearly kWh) or { data: [{ index, value }] }.
   * Returns map of deviceSN -> yearlyKwh.
   */
  private async getDeviceIdToYearlyEnergyKwh(
    deviceSns: string[],
    year: number
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>()
    for (let i = 0; i < deviceSns.length; i++) {
      const sn = deviceSns[i]
      try {
        const result = (await this.foxPost("/op/v0/device/report/query", {
          sn,
          year,
          dimension: "year",
          variables: ["generation"],
        })) as FoxReportResult | FoxReportYearResultItem[]
        let yearlyKwh = 0
        if (Array.isArray(result)) {
          const item = (result as FoxReportYearResultItem[]).find(
            (r) => r.variable === "generation"
          )
          const values = item?.values ?? []
          yearlyKwh = values.reduce((sum, v) => sum + (Number(v) || 0), 0)
        } else {
          const data = (result as FoxReportResult)?.data ?? []
          yearlyKwh = data.reduce((sum, d) => sum + (d.value ?? 0), 0)
        }
        map.set(sn, yearlyKwh)
      } catch (e) {
        logger.warn(`[FoxESS] getDeviceIdToYearlyEnergyKwh device ${sn}:`, e)
      }
      if (i < deviceSns.length - 1) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
      }
    }
    logger.info(`[FoxESS] Successfully fetched deviceIdToYearlyEnergyKwh :  ${JSON.stringify(map, null, 2)} `)
    return map
  }

  async listPlants(): Promise<Plant[]> {
    const baseUrl = this.getApiBaseUrl()
    logger.info("[FoxESS] Fetching plants from:", `${baseUrl}/op/v0/plant/list`)

    const plants: Plant[] = []
    const allStations = await this.fetchAllStations()

    const vendorPlantIdToDevices = await this.getPlantToDevicesMap()
    const vendorPlantIdToDetail = await this.fetchPlantDetailsMap(allStations)

    const deviceSns = [...vendorPlantIdToDevices.values()]
      .map((d) => d.deviceSN)
      .filter((sn): sn is string => Boolean(sn))
    logger.info(`[FoxESS] Successfully fetched deviceSns :  ${JSON.stringify(deviceSns, null, 2)} `)


    const generationByDeviceSN =
      await this.getDeviceIdToDailyMonthlyAndTotalEnergy(deviceSns)

    const deviceIdToCurrentPowerKw =
      await this.getDeviceIdToCurrentPowerKw(deviceSns)

    const currentYear = new Date().getFullYear()
    const deviceIdToYearlyEnergyKwh =
      await this.getDeviceIdToYearlyEnergyKwh(deviceSns, currentYear)

    for (let idx = 0; idx < allStations.length; idx++) {
      const station = allStations[idx]
      const detail = vendorPlantIdToDetail.get(station.stationID) ?? null
      const device = vendorPlantIdToDevices.get(station.stationID)
      const deviceStatus = device?.status
      const currentPowerKw =
        device != null
          ? (deviceIdToCurrentPowerKw.get(device.deviceSN) ?? null)
          : null
      const generationByDevice = generationByDeviceSN.get(device?.deviceSN ?? "") ?? null

      logger.info(`[FoxESS] Successfully fetched generationByDevice :  ${generationByDevice} `)

      const dailyKwh = generationByDevice?.today ?? 0;
      const monthlyKwh = generationByDevice?.month ?? 0;
      const yearlyKwh = deviceIdToYearlyEnergyKwh.get(device?.deviceSN ?? "") ?? 0;
      const totalKwh = generationByDevice?.cumulative ?? 0;

      const addressParts = [
        detail?.address,
        detail?.city,
        detail?.postcode,
        detail?.country,
      ].filter(Boolean) as string[]
      const address = addressParts.length > 0 ? addressParts.join(", ") : undefined

      plants.push({
        id: station.stationID,
        name: detail?.stationName ?? station.name ?? "",
        capacityKw: detail?.capacity ?? 0,
        location:
          address || device?.deviceSN
            ? {
                address,
                lat: undefined,
                lng: undefined,
                deviceSN: device?.deviceSN,
              }
            : undefined,
        metadata: {
          currentPowerKw,
          dailyEnergyKwh: dailyKwh,
          monthlyEnergyMwh: monthlyKwh / 1000,
          yearlyEnergyMwh: yearlyKwh / 1000,
          totalEnergyMwh: totalKwh / 1000,
          networkStatus: deviceStatus != null ? mapFoxStatus(deviceStatus) : null,
          lastUpdateTime:
            deviceStatus === 1 ? new Date().toISOString() : null,
          vendorCreatedDate: parseFoxCreateDate(detail?.createDate) ?? null,
          startOperatingTime: parseFoxCreateDate(detail?.createDate) ?? null,
          timezone: detail?.timezone ?? station.ianaTimezone ?? null
        },
      })
    }

    logger.info(`[FoxESS] Successfully fetched ${plants.length} plants`)
    return plants
  }

  async listPlant(vendorPlantId: string): Promise<Plant | null> {
    const detail = await this.getPlantDetail(vendorPlantId)
    const deviceSNsFromModules = (detail?.modules?.map((m) => m.deviceSN).filter(Boolean) ?? []) as string[]
    const deviceSNs =
      deviceSNsFromModules.length > 0
        ? deviceSNsFromModules
        : await this.getDeviceSNsForPlant(vendorPlantId)
    if (deviceSNs.length === 0) return null

    const generationByDeviceSN = await this.getDeviceIdToDailyMonthlyAndTotalEnergy(deviceSNs)
    const generationByDevice = deviceSNs
      .map((sn) => generationByDeviceSN.get(sn))
      .filter((g): g is FoxGenerationResult => g != null)

    let currentPowerKw: number | null = null
    try {
      const realResult = (await this.foxPost("/op/v1/device/real/query", {
        sns: deviceSNs,
        variables: ["generationPower"],
      })) as FoxRealQueryResult
      let totalPowerW = 0
      for (const sn of deviceSNs) {
        const arr = realResult?.[sn]
        if (Array.isArray(arr)) {
          const genPower = arr.find((v) => v.variable === "generationPower")
          const val =
            genPower?.value ?? genPower?.data ?? 0
          totalPowerW += Number(val)
        }
      }
      currentPowerKw = totalPowerW / 1000
    } catch {
      // real/query optional
    }

    const dailyKwh =
      generationByDevice.reduce((sum, g) => sum + (g.today ?? 0), 0)
    const monthlyKwh =
      generationByDevice.reduce((sum, g) => sum + (g.month ?? 0), 0)
    const yearlyKwh =
      generationByDevice.reduce((sum, g) => sum + ((g as { year?: number }).year ?? 0), 0)
    const totalKwh =
      generationByDevice.reduce(
        (sum, g) => sum + (g.cumulative ?? 0),
        0
      )

    const addressParts = [
      detail?.address,
      detail?.city,
      detail?.postcode,
      detail?.country,
    ].filter(Boolean) as string[]
    const address = addressParts.length > 0 ? addressParts.join(", ") : undefined
    const firstSN = deviceSNs[0]

    return {
      id: vendorPlantId,
      name: detail?.stationName ?? `Plant ${vendorPlantId}`,
      capacityKw: detail?.capacity ?? 0,
      location:
        address || firstSN
          ? {
              address,
              lat: undefined,
              lng: undefined,
              deviceSN: firstSN,
            }
          : undefined,
      metadata: {
        currentPowerKw,
        dailyEnergyKwh: dailyKwh,
        monthlyEnergyMwh: monthlyKwh / 1000,
        yearlyEnergyMwh: yearlyKwh / 1000,
        totalEnergyMwh: totalKwh / 1000,
        networkStatus: null,
        lastUpdateTime: null,
        vendorCreatedDate: parseFoxCreateDate(detail?.createDate) ?? null,
        startOperatingTime: parseFoxCreateDate(detail?.createDate) ?? null,
        timezone: detail?.timezone ?? null
      },
    }
  }

  async getTelemetry(
    plantId: string,
    startTime: Date,
    endTime: Date
  ): Promise<TelemetryData[]> {
    const start = new Date(startTime)
    const end = new Date(endTime)
    const startDay = {
      y: start.getUTCFullYear(),
      m: start.getUTCMonth() + 1,
      d: start.getUTCDate(),
    }
    const endDay = {
      y: end.getUTCFullYear(),
      m: end.getUTCMonth() + 1,
      d: end.getUTCDate(),
    }
    if (
      startDay.y === endDay.y &&
      startDay.m === endDay.m &&
      startDay.d === endDay.d
    ) {
      const daily = await this.getDailyTelemetryRecords(
        plantId,
        startDay.y,
        startDay.m,
        startDay.d
      )
      return (daily.records ?? []).map((r) => ({
        plantId,
        timestamp: new Date((r.dateTime as number) * 1000),
        generationPowerKw: (r.generationPower ?? 0) / 1000,
      }))
    }
    return []
  }

  async getDailyTelemetryRecords(
    plantId: string | number,
    year: number,
    month: number,
    day: number
  ): Promise<{
    statistics: {
      systemId: string | number
      year: number
      month: number
      day: number
      generationValue: number
      acceptDay?: string
    }
    records: Array<{
      systemId: string | number
      generationPower: number
      dateTime: number
      generationCapacity: number | null
      timeZoneOffset: number | null
    }>
  }> {
    const plantIdStr = plantId.toString()
    const deviceSNs = await this.getDeviceSNsForPlant(plantIdStr)
    if (deviceSNs.length === 0) {
      return {
        statistics: {
          systemId: plantIdStr,
          year,
          month,
          day,
          generationValue: 0,
          acceptDay: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        },
        records: [],
      }
    }

    const startOfDay = Date.UTC(year, month - 1, day, 0, 0, 0, 0)
    const endOfDay = Date.UTC(year, month - 1, day, 23, 59, 59, 999)

    const tsToPower: Record<number, number> = {}
    let totalDailyKwh = 0
    const intervalHours = 5 / 60

    for (let i = 0; i < deviceSNs.length; i++) {
      const sn = deviceSNs[i]
      try {
        const result = (await this.foxPost("/op/v0/device/history/query", {
          sn,
          variables: ["generationPower"],
          begin: startOfDay,
          end: endOfDay,
        })) as FoxHistoryResult
        const datas = result?.datas ?? []
        for (const block of datas) {
          const points = block.data ?? []
          for (const [epochMs, powerW] of points) {
            const sec = Math.floor(epochMs / 1000)
            tsToPower[sec] = (tsToPower[sec] ?? 0) + powerW
            totalDailyKwh += (powerW / 1000) * intervalHours
          }
        }
      } catch (e) {
        logger.warn(`[FoxESS] getDailyTelemetryRecords device ${sn}:`, e)
      }
      if (i < deviceSNs.length - 1) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
      }
    }

    const records = Object.entries(tsToPower)
      .map(([sec, powerW]) => ({
        systemId: plantIdStr,
        generationPower: powerW,
        dateTime: parseInt(sec, 10),
        generationCapacity: null,
        timeZoneOffset: null,
      }))
      .sort((a, b) => a.dateTime - b.dateTime)

    return {
      statistics: {
        systemId: plantIdStr,
        year,
        month,
        day,
        generationValue: totalDailyKwh,
        acceptDay: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      },
      records,
    }
  }

  async getMonthlyTelemetryRecords(
    plantId: string | number,
    year: number,
    month: number
  ): Promise<{
    statistics: { systemId: string | number; year: number; month: number; generationValue: number }
    records: Array<{ day: number; generationValue: number }>
  }> {
    const plantIdStr = plantId.toString()
    const deviceSNs = await this.getDeviceSNsForPlant(plantIdStr)
    const dayToValue: Record<number, number> = {}
    let sumAllDays = 0

    for (let i = 0; i < deviceSNs.length; i++) {
      const sn = deviceSNs[i]
      try {
        const result = (await this.foxPost("/op/v0/device/report/query", {
          sn,
          year,
          month,
          dimension: "month",
          variables: ["generation"],
        })) as FoxReportResult
        const data = result?.data ?? []
        for (const item of data) {
          const day = item.index
          const kwh = item.value ?? 0
          dayToValue[day] = (dayToValue[day] ?? 0) + kwh
          sumAllDays += kwh
        }
      } catch (e) {
        logger.warn(`[FoxESS] getMonthlyTelemetryRecords device ${sn}:`, e)
      }
      if (i < deviceSNs.length - 1) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
      }
    }

    const records = Object.entries(dayToValue)
      .map(([day, kwh]) => ({
        day: parseInt(day, 10),
        generationValue: kwh / 1000,
      }))
      .sort((a, b) => a.day - b.day)

    return {
      statistics: {
        systemId: plantIdStr,
        year,
        month,
        generationValue: sumAllDays / 1000,
      },
      records,
    }
  }

  async getYearlyTelemetryRecords(
    plantId: string | number,
    year: number
  ): Promise<{
    statistics: { systemId: string | number; year: number; generationValue: number }
    records: Array<{ month: number; generationValue: number }>
  }> {
    const plantIdStr = plantId.toString()
    const deviceSNs = await this.getDeviceSNsForPlant(plantIdStr)
    const monthToValue: Record<number, number> = {}
    let sumAllMonths = 0

    for (let i = 0; i < deviceSNs.length; i++) {
      const sn = deviceSNs[i]
      try {
        const result = (await this.foxPost("/op/v0/device/report/query", {
          sn,
          year,
          dimension: "year",
          variables: ["generation"],
        })) as FoxReportResult
        const data = result?.data ?? []
        for (const item of data) {
          const month = item.index
          const kwh = item.value ?? 0
          monthToValue[month] = (monthToValue[month] ?? 0) + kwh
          sumAllMonths += kwh
        }
      } catch (e) {
        logger.warn(`[FoxESS] getYearlyTelemetryRecords device ${sn}:`, e)
      }
      if (i < deviceSNs.length - 1) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
      }
    }

    const records = Object.entries(monthToValue)
      .map(([month, kwh]) => ({
        month: parseInt(month, 10),
        generationValue: kwh / 1000,
      }))
      .sort((a, b) => a.month - b.month)

    return {
      statistics: {
        systemId: plantIdStr,
        year,
        generationValue: sumAllMonths / 1000,
      },
      records,
    }
  }

  async getTotalTelemetryRecords(
    plantId: string | number,
    startYear: number,
    endYear: number
  ): Promise<{
    statistics: { systemId: string | number; generationValue: number; operatingTotalDays?: number | null }
    records: Array<{ year: number; generationValue: number }>
  }> {
    const plantIdStr = plantId.toString()
    const deviceSNs = await this.getDeviceSNsForPlant(plantIdStr)
    let totalCumulateKwh = 0
    const yearlyRecords: Array<{ year: number; generationValue: number }> = []

    for (const sn of deviceSNs) {
      try {
        const gen = (await this.foxGet(
          `/op/v0/device/generation?sn=${encodeURIComponent(sn)}`
        )) as FoxGenerationResult
        totalCumulateKwh += gen.cumulative ?? 0
      } catch {
        // skip
      }
    }

    for (let y = startYear; y <= endYear; y++) {
      try {
        const yr = await this.getYearlyTelemetryRecords(plantIdStr, y)
        yearlyRecords.push({
          year: y,
          generationValue: yr.statistics.generationValue,
        })
      } catch {
        yearlyRecords.push({ year: y, generationValue: 0 })
      }
    }

    return {
      statistics: {
        systemId: plantIdStr,
        generationValue: totalCumulateKwh / 1000,
        operatingTotalDays: null,
      },
      records: yearlyRecords,
    }
  }

  async getRealtime(plantId: string): Promise<RealtimeData> {
    const deviceSNs = await this.getDeviceSNsForPlant(plantId)
    let totalPowerW = 0
    if (deviceSNs.length > 0) {
      try {
        const result = (await this.foxPost("/op/v1/device/real/query", {
          sns: deviceSNs,
          variables: ["generationPower"],
        })) as FoxRealQueryResult
        for (const sn of deviceSNs) {
          const arr = result?.[sn]
          if (Array.isArray(arr)) {
            const genPower = arr.find((v) => v.variable === "generationPower")
            const val = genPower?.value ?? genPower?.data ?? 0
            totalPowerW += Number(val)
          }
        }
      } catch (e) {
        logger.warn("[FoxESS] getRealtime real/query failed:", e)
      }
    }
    return {
      plantId,
      timestamp: new Date(),
      data: {
        generationPowerKw: totalPowerW / 1000,
        generationPower: totalPowerW,
      },
    }
  }

  async getAlerts(plantId: string): Promise<Alert[]> {
    const deviceSNs = await this.getDeviceSNsForPlant(plantId)
    const alerts: Alert[] = []
    for (let i = 0; i < deviceSNs.length; i++) {
      const sn = deviceSNs[i]
      try {
        const result = (await this.foxGet(
          `/op/v0/device/error/query?sn=${encodeURIComponent(sn)}`
        )) as FoxErrorItem[] | undefined
        const list = Array.isArray(result) ? result : []
        for (const raw of list) {
          alerts.push(
            this.normalizeAlert({
              ...raw,
              deviceSN: raw.deviceSN ?? sn,
              vendorPlantId: plantId,
            })
          )
        }
      } catch (e) {
        logger.warn(`[FoxESS] getAlerts device ${sn}:`, e)
      }
      if (i < deviceSNs.length - 1) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
      }
    }
    return alerts
  }

  protected normalizeTelemetry(rawData: any): TelemetryData {
    return {
      plantId: rawData.plantId ?? "",
      timestamp: rawData.timestamp
        ? new Date(rawData.timestamp)
        : new Date(),
      generationPowerKw: rawData.generationPowerKw ?? 0,
    }
  }

  protected normalizeAlert(rawData: any): Alert {
    const severity = mapFoxAlertSeverity(rawData.level ?? 1)
    return {
      vendorAlertId: String(rawData.id ?? rawData.errorCode ?? ""),
      title: rawData.errorName ?? rawData.errorCode ?? "Unknown Alert",
      description: rawData.errorName ?? null,
      severity,
    }
  }
}
