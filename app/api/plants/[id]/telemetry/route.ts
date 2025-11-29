import { NextRequest, NextResponse } from "next/server"
import { getMainClient } from "@/lib/supabase/pooled"
import { VendorManager } from "@/lib/vendors/vendorManager"
import { SolarmanAdapter } from "@/lib/vendors/solarmanAdapter"

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

    // Fetch plant with vendor information
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

    // Handle vendors as array (Supabase returns it as array even for single relation)
    const vendor = Array.isArray(plant.vendors) ? plant.vendors[0] : plant.vendors

    if (!vendor || !vendor.is_active) {
      return NextResponse.json({ error: "Vendor not found or inactive" }, { status: 404 })
    }

    // If vendor is Solarman and we have date parameters, call Solarman API directly
    if (vendor.vendor_type === "SOLARMAN" && year && month && day) {
      try {
        const adapter = VendorManager.getAdapter({
          id: vendor.id,
          name: vendor.name,
          vendorType: vendor.vendor_type,
          apiBaseUrl: vendor.api_base_url,
          credentials: vendor.credentials,
          isActive: vendor.is_active,
        }) as SolarmanAdapter

        // Set token storage for the adapter
        adapter.setTokenStorage(vendor.id, supabase)

        const systemId = parseInt(plant.vendor_plant_id)
        if (isNaN(systemId)) {
          return NextResponse.json({ error: "Invalid vendor plant ID" }, { status: 400 })
        }

        const yearNum = parseInt(year)
        const monthNum = parseInt(month)
        const dayNum = parseInt(day)

        if (isNaN(yearNum) || isNaN(monthNum) || isNaN(dayNum)) {
          return NextResponse.json({ error: "Invalid date parameters" }, { status: 400 })
        }

        // Fetch daily telemetry records from Solarman
        const solarmanData = await adapter.getDailyTelemetryRecords(
          systemId,
          yearNum,
          monthNum,
          dayNum
        )

        // Transform Solarman response to expected format
        const telemetry = solarmanData.records.map((record) => {
          // Convert Unix timestamp to ISO string
          const timestamp = new Date(record.dateTime * 1000).toISOString()
          
          // Convert power from W to kW
          const powerKw = record.generationPower / 1000

          return {
            plant_id: plantId,
            ts: timestamp,
            power_kw: powerKw,
            generation_power_kw: powerKw,
            generation_capacity: record.generationCapacity,
            timezone_offset: record.timeZoneOffset,
            metadata: {
              systemId: record.systemId,
              acceptDay: record.acceptDay,
              acceptMonth: record.acceptMonth,
              raw: record,
            },
          }
        })

        return NextResponse.json({
          plantId,
          data: telemetry,
          statistics: {
            dailyGenerationKwh: solarmanData.statistics.generationValue,
            fullPowerHoursDay: solarmanData.statistics.fullPowerHoursDay,
            incomeValue: solarmanData.statistics.incomeValue,
          },
          period: "day",
          date: `${year}-${month}-${day}`,
        })
      } catch (error: any) {
        console.error("Error fetching Solarman telemetry:", error)
        return NextResponse.json(
          { error: `Failed to fetch telemetry from Solarman: ${error.message}` },
          { status: 500 }
        )
      }
    }

    // Fallback to existing database query for non-Solarman vendors or when date params not provided
    const hoursNum = hours ? parseInt(hours) : 24
    const startTime = new Date()
    startTime.setHours(startTime.getHours() - hoursNum)

    const { data: telemetry, error } = await supabase
      .from("telemetry")
      .select("*")
      .eq("plant_id", params.id)
      .gte("ts", startTime.toISOString())
      .order("ts", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      plantId,
      data: telemetry || [],
      period: `${hoursNum}h`,
    })
  } catch (error: any) {
    console.error("Telemetry error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
