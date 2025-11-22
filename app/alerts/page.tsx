import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { getMainClient } from "@/lib/supabase/pooled"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Factory, AlertTriangle, Clock, Building2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { DashboardSidebar } from "@/components/DashboardSidebar"

export const dynamic = "force-dynamic"

export default async function AlertsVendorsPage() {
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

  // Only SUPERADMIN and GOVT get the global alerts vendor view for now
  if (accountType !== "SUPERADMIN" && accountType !== "GOVT") {
    redirect("/dashboard")
  }

  const supabase = getMainClient()

  // Load organizations with their active vendors
  const { data: orgs } = await supabase
    .from("organizations")
    .select(
      `
      id,
      name,
      vendors (
        id,
        name,
        vendor_type,
        is_active,
        last_alert_synced_at
      )
    `
    )
    .order("name")

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardSidebar accountType={accountType} />
      <div className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
            Alerts
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Start from an organization, drill into its vendors, then view plant-level alerts.
          </p>
        </div>
        <div className="space-y-6">
          {(orgs || []).map((org: any) => {
            const vendors = Array.isArray(org.vendors)
              ? (org.vendors as any[]).filter((v) => v.is_active)
              : []

            if (vendors.length === 0) {
              return null
            }

            return (
              <section key={org.id} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-800 items-center justify-center">
                    <Building2 className="h-4 w-4 text-slate-800 dark:text-slate-100" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold leading-tight">{org.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      Vendors for this organization with alert sync enabled.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {vendors.map((vendor: any) => (
                    <Link key={vendor.id} href={`/alerts/vendor/${vendor.id}`}>
                      <Card className="group hover:shadow-xl transition-all duration-200 cursor-pointer">
                        <CardHeader className="space-y-2 pb-3">
                          <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                              <span className="inline-flex h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 p-1.5">
                                <Factory className="h-full w-full text-white" />
                              </span>
                              <span className="truncate">{vendor.name}</span>
                            </CardTitle>
                            <Badge variant="outline">{vendor.vendor_type}</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Alerts synced at vendor level</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>
                              Last alert sync:{" "}
                              {vendor.last_alert_synced_at
                                ? formatDistanceToNow(
                                    new Date(vendor.last_alert_synced_at),
                                    { addSuffix: true }
                                  )
                                : "Never"}
                            </span>
                          </div>
                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full justify-center"
                            >
                              View plants & alerts
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}

          {(!orgs || orgs.length === 0) && (
            <Card className="p-6 flex flex-col items-center justify-center">
              <AlertTriangle className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm">
                No organizations or vendors found. Configure organizations and vendors
                first to see alerts.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}


