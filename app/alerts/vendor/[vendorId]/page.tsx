import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getMainClient } from "@/lib/supabase/pooled"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Factory, Leaf, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { DashboardSidebar } from "@/components/DashboardSidebar"

export const dynamic = "force-dynamic"

interface PageProps {
  params: { vendorId: string }
}

export default async function AlertsVendorPlantsPage({ params }: PageProps) {
  const vendorId = parseInt(params.vendorId, 10)

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

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, name, vendor_type, organizations ( id, name )")
    .eq("id", vendorId)
    .single()

  if (!vendor) {
    redirect("/alerts")
  }

  // Fetch plants for this vendor that have at least one alert
  const { data: plants } = await supabase
    .from("plants")
    .select(
      `
      id,
      name,
      vendor_plant_id,
      org_id,
      last_refreshed_at,
      alerts:alerts (
        id
      )
    `
    )
    .eq("vendor_id", vendor.id)

  const plantsWithAlerts =
    plants?.filter((p: any) => Array.isArray(p.alerts) && p.alerts.length > 0) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardSidebar accountType={accountType} />
      <div className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
        <div className="mb-6 md:mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
              {vendor.name} Alerts
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Select a plant to view its alerts month by month.
            </p>
          </div>
          <Link href="/alerts">
            <Button variant="outline" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to vendors</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </Link>
        </div>

        <div className="mb-6 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 p-2 shadow-md">
            <Factory className="h-full w-full text-white" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base md:text-lg">{vendor.name}</span>
              <Badge variant="outline" className="text-[10px] md:text-xs">
                {vendor.vendor_type}
              </Badge>
            </div>
            {Array.isArray((vendor as any).organizations) &&
              (vendor as any).organizations.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Organization: {(vendor as any).organizations[0].name}
                </p>
              )}
            <p className="text-[11px] text-muted-foreground/80 mt-1">
              {plantsWithAlerts.length} plant
              {plantsWithAlerts.length === 1 ? "" : "s"} with active or historical alerts
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plantsWithAlerts.map((plant: any, index: number) => (
            <Link
              key={plant.id}
              href={`/alerts/vendor/${vendor.id}/plant/${plant.id}`}
            >
              <Card
                className="group relative overflow-hidden border-2 border-transparent bg-gradient-to-br from-background to-muted/60 hover:from-background hover:to-muted shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer animate-in fade-in-50 zoom-in-95"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-cyan-500/5" />
                <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-1.5 shadow-sm">
                      <Leaf className="h-full w-full text-white" />
                    </span>
                    <span className="truncate">{plant.name}</span>
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-2 py-0.5 bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300/60 dark:border-emerald-700/60"
                  >
                    {Array.isArray(plant.alerts) ? plant.alerts.length : 0} alerts
                  </Badge>
                </CardHeader>
                <CardContent className="relative space-y-1 text-xs text-muted-foreground">
                  <p className="font-mono text-[11px]">
                    Vendor plant ID:{" "}
                    <span className="text-foreground">{plant.vendor_plant_id}</span>
                  </p>
                  {plant.last_refreshed_at && (
                    <p>
                      Last plant sync:{" "}
                      <span className="text-foreground">
                        {new Date(plant.last_refreshed_at).toLocaleString()}
                      </span>
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}

          {plantsWithAlerts.length === 0 && (
            <Card className="p-6 flex flex-col items-center justify-center">
              <Leaf className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">
                No plants with alerts found for this vendor.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}


