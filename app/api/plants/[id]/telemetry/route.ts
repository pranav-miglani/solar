import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"
import { VendorManager } from "@/lib/vendors/vendorManager"

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Extract plantId from params - handle both string and Promise cases
    const plantIdParam = params?.id || (params as any)?.id
    console.log(`[Telemetry API] GET request received`)
    console.log(`[Telemetry API] Params object:`, JSON.stringify(params))
    console.log(`[Telemetry API] Plant ID from params: ${plantIdParam}`)
    console.log(`[Telemetry API] Request URL: ${request.url}`)
    
    // Extract plantId from URL if params.id is not available
    const urlPath = new URL(request.url).pathname
    const urlMatch = urlPath.match(/\/api\/plants\/(\d+)\/telemetry/)
    const plantIdFromUrl = urlMatch ? urlMatch[1] : null
    
    const finalPlantIdParam = plantIdParam || plantIdFromUrl
    
    if (!finalPlantIdParam) {
      console.error(`[Telemetry API] Missing plant ID parameter. URL: ${request.url}, Params:`, params)
      return NextResponse.json({ error: "Plant ID is required" }, { status: 400 })
    }

    const session = request.cookies.get("session")?.value

    if (!session) {
      console.error(`[Telemetry API] No session cookie found`)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let sessionData
    try {
      sessionData = JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      console.error(`[Telemetry API] Invalid session cookie`)
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const plantId = parseInt(finalPlantIdParam)
    const { searchParams } = new URL(request.url)
    
    // Support date-based query (for day view) or hours-based query (for 24h view)
    const year = searchParams.get("year")
    const month = searchParams.get("month")
    const day = searchParams.get("day")
    const hours = searchParams.get("hours")

    console.log(`[Telemetry API] Request params: plantId=${plantId}, year=${year}, month=${month}, day=${day}`)

    if (isNaN(plantId)) {
      console.error(`[Telemetry API] Invalid plant ID: ${finalPlantIdParam}`)
      return NextResponse.json({ error: "Invalid plant ID" }, { status: 400 })
    }

    const supabase = getMainClient()

    // Step 1: Fetch plant with vendor information to identify the vendor
    // Use the internal plant.id to find the plant, then get vendor_plant_id from the database
    // Note: api_base_url is no longer stored in DB - it's read from environment variables
    console.log(`[Telemetry API] Querying database for plant ID: ${plantId}`)
    const { data: plant, error: plantError } = await supabase
      .from("plants")
      .select(`
        id,
        vendor_id,
        vendor_plant_id,
        vendors (
          id,
          name,
          vendor_type,
          credentials,
          is_active
        )
      `)
      .eq("id", plantId)
      .single()

    console.log(`[Telemetry API] Database query result - Plant:`, plant ? `Found (id: ${plant.id}, vendor_plant_id: ${plant.vendor_plant_id})` : "Not found")
    console.log(`[Telemetry API] Database query error:`, plantError)

    if (plantError) {
      console.error(`[Telemetry API] Error fetching plant ${plantId}:`, plantError)
      console.error(`[Telemetry API] Error code: ${plantError.code}, message: ${plantError.message}`)
      return NextResponse.json(
        { error: "Plant not found", details: plantError.message, code: plantError.code },
        { status: 404 }
      )
    }

    if (!plant) {
      console.error(`[Telemetry API] Plant ${plantId} not found in database`)
      return NextResponse.json({ error: "Plant not found" }, { status: 404 })
    }

    // Step 2: Extract vendor information (handle array response from Supabase)
    const vendor = Array.isArray(plant.vendors) ? plant.vendors[0] : plant.vendors

    if (!vendor) {
      console.error(`[Telemetry API] Vendor not found for plant ${plantId}`)
      return NextResponse.json({ error: "Vendor not found for this plant" }, { status: 404 })
    }

    if (!vendor.is_active) {
      console.error(`[Telemetry API] Vendor ${vendor.id} is inactive for plant ${plantId}`)
      return NextResponse.json({ error: "Vendor is inactive" }, { status: 404 })
    }

    // Step 3: Validate vendor_plant_id exists (this is the vendor's plant ID, not our internal plant ID)
    // This is CRITICAL: We use vendor_plant_id (from DB) to call vendor APIs, NOT our internal plant.id
    if (!plant.vendor_plant_id) {
      console.error(`[Telemetry API] vendor_plant_id is missing for plant ${plantId}`)
      console.error(`[Telemetry API] Plant data:`, JSON.stringify(plant, null, 2))
      return NextResponse.json(
        { error: "Vendor plant ID not found for this plant" },
        { status: 400 }
      )
    }

    console.log(`[Telemetry API] Processing telemetry request:`)
    console.log(`[Telemetry API]   - Internal plant.id: ${plantId}`)
    console.log(`[Telemetry API]   - vendor_plant_id (from DB): ${plant.vendor_plant_id}`)
    console.log(`[Telemetry API]   - Vendor type: ${vendor.vendor_type}`)
    console.log(`[Telemetry API]   - Will use vendor_plant_id (${plant.vendor_plant_id}) for vendor API call`)

    // Step 4: If we have date parameters, fetch daily telemetry from vendor API
    // Currently only Solarman is fully implemented; other vendors will be added in pipeline
    if (year && month && day) {
      try {
        // Get the appropriate vendor adapter (currently only SolarmanAdapter is fully implemented)
        // Note: apiBaseUrl is optional - adapter will read from environment variables if not provided
        // The api_base_url column was removed from vendors table and is now stored in env vars
        const adapter = VendorManager.getAdapter({
          id: vendor.id,
          name: vendor.name,
          vendorType: vendor.vendor_type,
          // apiBaseUrl is optional - BaseVendorAdapter.getApiBaseUrl() will read from env vars
          credentials: vendor.credentials,
          isActive: vendor.is_active,
        })

        // Set token storage if the adapter supports it (e.g., SolarmanAdapter)
        if (typeof (adapter as any).setTokenStorage === "function") {
          (adapter as any).setTokenStorage(vendor.id, supabase)
        }

        // Extract vendor_plant_id (vendor's plant identifier, NOT our internal plant.id)
        const vendorPlantId = plant.vendor_plant_id.toString()
        const vendorPlantIdNum = parseInt(plant.vendor_plant_id)
        const yearNum = parseInt(year)
        const monthNum = parseInt(month)
        const dayNum = parseInt(day)

        if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum)) {
          return NextResponse.json({ error: "Invalid date parameters" }, { status: 400 })
        }

        if (isNaN(vendorPlantIdNum)) {
          return NextResponse.json(
            { error: "Invalid vendor plant ID format" },
            { status: 400 }
          )
        }

        // Step 5: Check if adapter supports getDailyTelemetryRecords method
        // Currently only SolarmanAdapter implements this method
        // Future vendors will be added to the pipeline once Solarman flow is complete
        if (typeof (adapter as any).getDailyTelemetryRecords === "function") {
          // CRITICAL: Make API call to vendor using vendor_plant_id (vendor's plant identifier)
          // NEVER use our internal plant.id when calling vendor APIs
          // For Solarman: systemId parameter = vendor_plant_id (numeric)
          const dailyData = await (adapter as any).getDailyTelemetryRecords(
            vendorPlantIdNum, // vendor_plant_id - vendor's plant identifier (NOT plant.id)
            yearNum,
            monthNum,
            dayNum
          )

          // Step 6: Transform vendor response to our standard format
          // Each vendor adapter returns vendor-specific format, we normalize it here
          const telemetry = (dailyData.records || []).map((record: any) => {
            // Handle different timestamp formats (Unix seconds or ISO string)
            let timestamp: string
            if (typeof record.dateTime === "number") {
              timestamp = new Date(record.dateTime * 1000).toISOString()
            } else if (record.ts) {
              timestamp = record.ts
            } else {
              timestamp = new Date().toISOString()
            }

            // Convert power from W to kW if needed, or use as-is if already in kW
            const powerKw = record.generationPower
              ? record.generationPower / 1000 // Convert W to kW
              : record.power_kw || record.generation_power_kw || 0

            return {
              plant_id: plantId, // Our internal plant ID (for reference)
              ts: timestamp,
              power_kw: powerKw,
              generation_power_kw: powerKw,
              generation_capacity: record.generationCapacity || null,
              timezone_offset: record.timeZoneOffset || null,
              metadata: {
                vendorPlantId, // Vendor's plant ID (used in API call)
                systemId: record.systemId || vendorPlantId,
                acceptDay: record.acceptDay || null,
                acceptMonth: record.acceptMonth || null,
                raw: record, // Original vendor response
              },
            }
          })

          return NextResponse.json({
            plantId,
            data: telemetry,
            statistics: dailyData.statistics
              ? {
                  dailyGenerationKwh: dailyData.statistics.generationValue || null,
                  fullPowerHoursDay: dailyData.statistics.fullPowerHoursDay || null,
                  incomeValue: dailyData.statistics.incomeValue || null,
                }
              : null,
            period: "day",
            date: `${year}-${month}-${day}`,
          })
        } else {
          // Fallback to generic getTelemetry method if daily method not available
          // This is for future vendors that don't implement getDailyTelemetryRecords yet
          const startTime = new Date(yearNum, monthNum - 1, dayNum, 0, 0, 0)
          const endTime = new Date(yearNum, monthNum - 1, dayNum, 23, 59, 59)

          // CRITICAL: Always use vendor_plant_id (vendor's plant identifier) for vendor API calls
          // NEVER use our internal plant.id when calling vendor APIs
          const telemetryData = await adapter.getTelemetry(
            vendorPlantId, // vendor_plant_id - vendor's plant identifier (NOT plant.id)
            startTime,
            endTime
          )

          // Transform to expected format
          const telemetry = telemetryData.map((data) => ({
            plant_id: plantId,
            ts: data.timestamp instanceof Date ? data.timestamp.toISOString() : new Date(data.timestamp).toISOString(),
            power_kw: data.generationPowerKw,
            generation_power_kw: data.generationPowerKw,
            metadata: {
              vendorPlantId,
              raw: data.metadata || {},
            },
          }))

          return NextResponse.json({
            plantId,
            data: telemetry,
            period: "day",
            date: `${year}-${month}-${day}`,
          })
        }
      } catch (error: any) {
        console.error(`Error fetching telemetry from ${vendor.vendor_type}:`, error)
        return NextResponse.json(
          { error: `Failed to fetch telemetry: ${error.message}` },
          { status: 500 }
        )
      }
    }

    // If date parameters are not provided, return empty data
    // Telemetry is fetched directly from vendor APIs on demand
    // Requires: year, month, day query parameters
    return NextResponse.json({
      plantId,
      data: [],
      period: "24h",
      message: "Date parameters (year, month, day) are required for telemetry data",
    })
  } catch (error: any) {
    const plantIdParam = params?.id || (params as any)?.id || "unknown"
    console.error(`[Telemetry API] Unexpected error for plant ${plantIdParam}:`, error)
    console.error(`[Telemetry API] Error stack:`, error.stack)
    return NextResponse.json(
      { 
        error: error.message || "Internal server error",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
