import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/rbac"

/**
 * Export CSV endpoint - GOVT only
 * Exports global system data to CSV format
 */

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
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

    const accountType = sessionData.accountType as string

    // Only GOVT can export
    requirePermission(accountType as any, "organizations", "read")
    if (accountType !== "GOVT") {
      return NextResponse.json(
        { error: "Only Government accounts can export data" },
        { status: 403 }
      )
    }

    // Fetch all data
    const [orgsResult, plantsResult, workOrdersResult, alertsResult] =
      await Promise.all([
        supabase.from("organizations").select("*").order("name"),
        supabase.from("plants").select("*, organizations(name)").order("name"),
        supabase
          .from("work_orders")
          .select("*, work_order_plants(plants(*))")
          .order("created_at", { ascending: false }),
        supabase
          .from("alerts")
          .select("*, plants(name, organizations(name))")
          .order("created_at", { ascending: false }),
      ])

    const orgs = orgsResult.data || []
    const plants = plantsResult.data || []
    const workOrders = workOrdersResult.data || []
    const alerts = alertsResult.data || []

    // Generate CSV content
    let csvContent = "WOMS System Export\n"
    csvContent += `Generated: ${new Date().toISOString()}\n\n`

    // Organizations
    csvContent += "=== ORGANIZATIONS ===\n"
    csvContent += "ID,Name,Created At\n"
    orgs.forEach((org: any) => {
      csvContent += `${org.id},"${org.name}",${org.created_at}\n`
    })
    csvContent += "\n"

    // Plants
    csvContent += "=== PLANTS ===\n"
    csvContent += "ID,Name,Organization,Capacity (kW),Vendor Plant ID,Location\n"
    plants.forEach((plant: any) => {
      const orgName = (plant.organizations as any)?.name || "N/A"
      const location = plant.location
        ? `${plant.location.lat || ""},${plant.location.lng || ""}`
        : "N/A"
      csvContent += `${plant.id},"${plant.name}","${orgName}",${plant.capacity_kw},"${plant.vendor_plant_id}","${location}"\n`
    })
    csvContent += "\n"

    // Work Orders
    csvContent += "=== WORK ORDERS ===\n"
    csvContent += "ID,Title,Description,Priority,Created At,Plants\n"
    workOrders.forEach((wo: any) => {
      const plantNames =
        wo.work_order_plants
          ?.map((wop: any) => wop.plants?.name || "N/A")
          .join("; ") || "None"
      csvContent += `${wo.id},"${wo.title}","${wo.description || ""}",${wo.priority},${wo.created_at},"${plantNames}"\n`
    })
    csvContent += "\n"

    // Alerts
    csvContent += "=== ALERTS ===\n"
    csvContent +=
      "ID,Title,Description,Severity,Status,Plant,Organization,Created At\n"
    alerts.forEach((alert: any) => {
      const plantName = alert.plants?.name || "N/A"
      const orgName = alert.plants?.organizations?.name || "N/A"
      csvContent += `${alert.id},"${alert.title}","${alert.description || ""}",${alert.severity},${alert.status},"${plantName}","${orgName}",${alert.created_at}\n`
    })

    // Return CSV file
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="woms-export-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error: any) {
    console.error("Export CSV error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

