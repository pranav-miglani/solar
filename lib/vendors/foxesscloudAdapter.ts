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

// --- FoxESS API response types ---

interface FoxApiResponse<T = unknown> {
  errno: number
  msg?: string
  result?: T
}

interface FoxPlantItem {
  stationID: string
  name: string
  capacity?: number
  address?: string
  lat?: number
  lon?: number
  timezone?: string
  status?: number
  createTime?: number
}

interface FoxPlantListResult {
  currentPage: number
  pageSize: number
  total: number
  data: FoxPlantItem[]
}

interface FoxDeviceItem {
  deviceSN: string
  deviceType?: string
  plantID?: string
  status?: number
}

interface FoxDeviceListResult {
  currentPage?: number
  pageSize?: number
  total?: number
  data: FoxDeviceItem[]
}

interface FoxGenerationResult {
  today?: number
  month?: number
  year?: number
  cumulate?: number
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

interface FoxRealQueryResult {
  [deviceSN: string]: Array<{ variable: string; value?: number; data?: number }>
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

export class FoxesscloudAdapter extends BaseVendorAdapter {
  private vendorId?: number
  private supabaseClient?: any

  setTokenStorage(vendorId: number, supabaseClient: any) {
    this.vendorId = vendorId
    this.supabaseClient = supabaseClient
  }

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
   * path = URL path only (e.g. /op/v0/plant/list), not full URL.
   */
  private buildFoxHeaders(path: string): Record<string, string> {
    const credentials = this.getCredentials()
    const apiKey = credentials.apiKey as string
    if (!apiKey) {
      throw new Error("[FoxESS] credentials.apiKey is required")
    }
    const timestamp = Date.now().toString()
    const rawSig = path + "\r\n" + apiKey + "\r\n" + timestamp
    const signature = createHash("md5").update(rawSig, "utf8").digest("hex")
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
   * Redacts token and signature in headers.
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
    logger.info("[FoxESS] Request headers:", JSON.stringify({
      ...headers,
      token: "[REDACTED]",
      signature: "[REDACTED]",
    }, null, 2))

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
   * Redacts token and signature in headers; sanitizes body (array lengths).
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
    logger.info("[FoxESS] Request headers:", JSON.stringify({
      ...headers,
      token: "[REDACTED]",
      signature: "[REDACTED]",
    }, null, 2))
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
    logger.info("[FoxESS] Using API key authentication (no login required)")
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
        if (d.plantID === plantId && d.deviceSN) {
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
    return sns
  }

  /**
   * Build stationID -> deviceSN[] by fetching all devices (paginated).
   */
  private async getPlantToDevicesMap(): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>()
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
        if (d.plantID && d.deviceSN) {
          const arr = map.get(d.plantID) ?? []
          arr.push(d.deviceSN)
          map.set(d.plantID, arr)
        }
      }
      const total = result?.total ?? 0
      if (list.length < pageSize || page * pageSize >= total) {
        hasMore = false
      } else {
        page++
      }
    }
    return map
  }

  async listPlants(): Promise<Plant[]> {
    const baseUrl = this.getApiBaseUrl()
    logger.info("[FoxESS] Fetching plants from:", `${baseUrl}/op/v0/plant/list`)

    const plants: Plant[] = []
    let page = 1
    const pageSize = 100
    let hasMore = true
    const allStations: FoxPlantItem[] = []

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

    const plantToDevices = await this.getPlantToDevicesMap()

    for (const station of allStations) {
      const deviceSNs = plantToDevices.get(station.stationID) ?? []
      const generationByDevice: FoxGenerationResult[] = []

      for (let i = 0; i < deviceSNs.length; i += BATCH_SIZE) {
        const batch = deviceSNs.slice(i, i + BATCH_SIZE)
        const settled = await Promise.allSettled(
          batch.map((sn) =>
            this.foxGet(`/op/v0/device/generation?sn=${encodeURIComponent(sn)}`)
          )
        )
        for (const s of settled) {
          if (s.status === "fulfilled" && s.value) {
            generationByDevice.push(s.value as FoxGenerationResult)
          }
        }
        if (i + BATCH_SIZE < deviceSNs.length) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
        }
      }

      const dailyKwh =
        generationByDevice.reduce((sum, g) => sum + (g.today ?? 0), 0)
      const monthlyKwh =
        generationByDevice.reduce((sum, g) => sum + (g.month ?? 0), 0)
      const yearlyKwh =
        generationByDevice.reduce((sum, g) => sum + (g.year ?? 0), 0)
      const totalKwh =
        generationByDevice.reduce((sum, g) => sum + (g.cumulate ?? 0), 0)

      plants.push({
        id: station.stationID,
        name: station.name ?? "",
        capacityKw: station.capacity ?? 0,
        location: {
          lat: station.lat ?? undefined,
          lng: station.lon ?? undefined,
          address: station.address ?? undefined,
        },
        metadata: {
          currentPowerKw: null,
          dailyEnergyKwh: dailyKwh,
          monthlyEnergyMwh: monthlyKwh / 1000,
          yearlyEnergyMwh: yearlyKwh / 1000,
          totalEnergyMwh: totalKwh / 1000,
          networkStatus: mapFoxStatus(station.status ?? 0),
          lastUpdateTime: null,
          vendorCreatedDate: station.createTime
            ? new Date(station.createTime * 1000).toISOString()
            : null,
          startOperatingTime: station.createTime
            ? new Date(station.createTime * 1000).toISOString()
            : null,
          timezone: station.timezone ?? null,
        },
      })
    }

    logger.info(`[FoxESS] Successfully fetched ${plants.length} plants`)
    return plants
  }

  async listPlant(vendorPlantId: string): Promise<Plant | null> {
    const deviceSNs = await this.getDeviceSNsForPlant(vendorPlantId)
    if (deviceSNs.length === 0) {
      return null
    }

    let currentPowerKw: number | null = null
    const generationByDevice: FoxGenerationResult[] = []

    for (const sn of deviceSNs) {
      try {
        const gen = (await this.foxGet(
          `/op/v0/device/generation?sn=${encodeURIComponent(sn)}`
        )) as FoxGenerationResult
        generationByDevice.push(gen)
      } catch {
        // skip device
      }
    }

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
      generationByDevice.reduce((sum, g) => sum + (g.year ?? 0), 0)
    const totalKwh =
      generationByDevice.reduce((sum, g) => sum + (g.cumulate ?? 0), 0)

    let station: FoxPlantItem | undefined
    let page = 1
    const pageSize = 100
    while (true) {
      const stationRes = (await this.foxPost("/op/v0/plant/list", {
        currentPage: page,
        pageSize,
      })) as FoxPlantListResult
      const list = stationRes?.data ?? []
      station = list.find((s) => s.stationID === vendorPlantId)
      if (station || list.length < pageSize) break
      page++
    }

    return {
      id: vendorPlantId,
      name: station?.name ?? "",
      capacityKw: station?.capacity ?? 0,
      location: {
        lat: station?.lat ?? undefined,
        lng: station?.lon ?? undefined,
        address: station?.address ?? undefined,
      },
      metadata: {
        currentPowerKw,
        dailyEnergyKwh: dailyKwh,
        monthlyEnergyMwh: monthlyKwh / 1000,
        yearlyEnergyMwh: yearlyKwh / 1000,
        totalEnergyMwh: totalKwh / 1000,
        networkStatus: station
          ? mapFoxStatus(station.status ?? 0)
          : "NORMAL",
        lastUpdateTime: null,
        vendorCreatedDate: station?.createTime
          ? new Date(station.createTime * 1000).toISOString()
          : null,
        startOperatingTime: station?.createTime
          ? new Date(station.createTime * 1000).toISOString()
          : null,
        timezone: station?.timezone ?? null,
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
        totalCumulateKwh += gen.cumulate ?? 0
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
