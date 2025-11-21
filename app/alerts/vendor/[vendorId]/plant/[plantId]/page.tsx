import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import Link from "next/link"
import { getMainClient } from "@/lib/supabase/pooled"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Leaf, ArrowLeft, AlertTriangle } from "lucide-react"

export const dynamic = "force-dynamic"

interface PageProps {
  params: { vendorId: string; plantId: string }
  searchParams?: { year?: string; month?: string }
}

function getMonthRange(year?: number, month?: number) {
  const now = new Date()
  const y = year ?? now.getFullYear()
  const m = month ?? now.getMonth() + 1 // 1-based

  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0))

  return { start, end, year: y, month: m }
}

export default async function PlantAlertsPage({ params, searchParams }: PageProps) {
  const vendorId = parseInt(params.vendorId, 10)
  const plantId = parseInt(params.plantId, 10)

  const cookieStore = await cookies()
  const session = cookieStore.get("session")?.value

  if (!session) {
    redirect("/auth/login")
  }

  let sessionData: any
  try {
    sessionData = JSON.parse(Buffer.from(session, "base64").toString())
  } catch {
    redirect("/auth/login")
  }

  const accountType = sessionData.accountType as string
  if (accountType !== "SUPERADMIN" && accountType !== "GOVT") {
    redirect("/dashboard")
  }

  const supabase = getMainClient()

  // Load vendor and plant info for header context
  const [{ data: vendor }, { data: plant }] = await Promise.all([
    supabase
      .from("vendors")
      .select("id, name, vendor_type")
      .eq("id", vendorId)
      .single(),
    supabase
      .from("plants")
      .select("id, name, vendor_plant_id, last_refreshed_at")
      .eq("id", plantId)
      .single(),
  ])

  if (!vendor || !plant) {
    redirect("/alerts")
  }

  // Determine month range for alerts
  const urlYear = searchParams?.year ? parseInt(searchParams.year, 10) : undefined
  const urlMonth = searchParams?.month ? parseInt(searchParams.month, 10) : undefined
  const { start, end, year, month } = getMonthRange(urlYear, urlMonth)

  // Fetch alerts for this plant in the selected month
  const { data: alerts } = await supabase
    .from("alerts")
    .select("id, title, description, severity, status, alert_time, end_time, grid_down_seconds, vendor_plant_id")
    .eq("plant_id", plant.id)
    .gte("alert_time", start.toISOString())
    .lt("alert_time", end.toISOString())
    .order("alert_time", { ascending: false })

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
              {plant.name} Alerts
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Vendor: {vendor.name} ({vendor.vendor_type}) · Vendor plant ID:{" "}
              {plant.vendor_plant_id}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={`/alerts/vendor/${vendor.id}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to plants
              </Button>
            </Link>
          </div>
        </div>

        <Card className="mb-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-1.5">
                <Leaf className="h-full w-full text-white" />
              </span>
              <div>
                <CardTitle className="text-base md:text-lg">{plant.name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Last plant sync:{" "}
                  {plant.last_refreshed_at
                    ? new Date(plant.last_refreshed_at).toLocaleString()
                    : "Never"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                Viewing alerts for{" "}
                {start.toLocaleDateString(undefined, { year: "numeric", month: "long" })}
              </span>
            </div>
          </CardHeader>
        </Card>

        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Link
              href={`/alerts/vendor/${vendor.id}/plant/${plant.id}?year=${prevMonth.year}&month=${prevMonth.month}`}
            >
              <Button variant="outline" size="sm">
                Prev Month
              </Button>
            </Link>
            <Link
              href={`/alerts/vendor/${vendor.id}/plant/${plant.id}?year=${nextMonth.year}&month=${nextMonth.month}`}
            >
              <Button variant="outline" size="sm">
                Next Month
              </Button>
            </Link>
          </div>
          <div className="text-xs text-muted-foreground">
            {year}-{month.toString().padStart(2, "0")}
          </div>
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alerts for this month ({alerts?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts && alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.map((alert: any) => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-lg border bg-card/60 flex flex-col gap-1 text-xs md:text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold truncate">{alert.title}</div>
                      <Badge variant="outline" className="ml-2">
                        {alert.severity}
                      </Badge>
                    </div>
                    {alert.description && (
                      <p className="text-muted-foreground text-xs">{alert.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground mt-1">
                      <span>
                        Start:{" "}
                        {alert.alert_time
                          ? new Date(alert.alert_time).toLocaleString()
                          : "N/A"}
                      </span>
                      <span>
                        End:{" "}
                        {alert.end_time
                          ? new Date(alert.end_time).toLocaleString()
                          : "N/A"}
                      </span>
                      <span>Status: {alert.status}</span>
                      {typeof alert.grid_down_seconds === "number" && (
                        <span>
                          Grid downtime: {(alert.grid_down_seconds / 60).toFixed(1)} min
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No alerts for this plant in{" "}
                {start.toLocaleDateString(undefined, { year: "numeric", month: "long" })}.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


