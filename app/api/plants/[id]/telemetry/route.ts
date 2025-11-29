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
    const session = request.cookies.get("session")?.value

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let sessionData
    try {
      sessionData = JSON.parse(Buffer.from(session, "base64").toString())
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    const plantId = parseInt(params.id)
    const { searchParams } = new URL(request.url)
    
    // Support date-based query (for day view) or hours-based query (for 24h view)
    const year = searchParams.get("year")
    const month = searchParams.get("month")
    const day = searchParams.get("day")
    const hours = searchParams.get("hours")

    if (isNaN(plantId)) {
      return NextResponse.json({ error: "Invalid plant ID" }, { status: 400 })
    }

    const supabase = getMainClient()

    // Step 1: Fetch plant with vendor information to identify the vendor
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
          api_base_url,
          credentials,
          is_active
        )
      `)
      .eq("id", plantId)
      .single()

    if (plantError || !plant) {
      return NextResponse.json({ error: "Plant not found" }, { status: 404 })
    }

    // Step 2: Extract vendor information (handle array response from Supabase)
    const vendor = Array.isArray(plant.vendors) ? plant.vendors[0] : plant.vendors

    if (!vendor || !vendor.is_active) {
      return NextResponse.json({ error: "Vendor not found or inactive" }, { status: 404 })
    }

    // Step 3: Validate vendor_plant_id exists (this is the vendor's plant ID, not our internal plant ID)
    if (!plant.vendor_plant_id) {
      return NextResponse.json(
        { error: "Vendor plant ID not found for this plant" },
        { status: 400 }
      )
    }

    // Step 4: If we have date parameters, fetch daily telemetry from vendor API
    // Currently only Solarman is fully implemented; other vendors will be added in pipeline
    if (year && month && day) {
      try {
        // Get the appropriate vendor adapter (currently only SolarmanAdapter is fully implemented)
        const adapter = VendorManager.getAdapter({
          id: vendor.id,
          name: vendor.name,
          vendorType: vendor.vendor_type,
          apiBaseUrl: vendor.api_base_url,
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
    console.error("Telemetry error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
