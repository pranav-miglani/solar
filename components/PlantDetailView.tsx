"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Building2,
  Zap,
  MapPin,
  Calendar,
  ArrowLeft,
  AlertCircle,
  Phone,
  Wifi,
  WifiOff,
  Activity,
  TrendingUp,
  Clock,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { TelemetryChart } from "@/components/TelemetryChart"
import { format, addDays, subDays, addMonths, subMonths, startOfMonth, addYears, subYears, startOfYear } from "date-fns"

// Main plant payload for detail view. Energy values follow our kWh/MWh schema:
// - daily_energy_kwh is in kWh (per latest migrations)
// - monthly/yearly/total energy stay in MWh.
interface Plant {
  id: number
  name: string
  capacity_kw: number | null
  current_power_kw: number | null
  daily_energy_kwh: number | null
  monthly_energy_mwh: number | null
  yearly_energy_mwh: number | null
  total_energy_mwh: number | null
  last_update_time: string | null
  last_refreshed_at: string | null
  network_status: string | null
  vendor_created_date: string | null
  start_operating_time: string | null
  location: {
    lat?: number
    lng?: number
    address?: string
  } | null
  vendors: {
    id: number
    name: string
    vendor_type: string
  }
  organizations: {
    id: number
    name: string
  }
}

interface TelemetryData {
  ts: string
  generation_power_kw?: number
  power_kw?: number
}

interface TelemetryStatistics {
  dailyGenerationKwh?: number
  fullPowerHoursDay?: number
}

// Recent alert snapshot used for the sidebar card. Note the combination of
// downtime seconds (raw vendor duration) and derived benefit in kWh.
interface PlantAlert {
  id: number
  title: string | null
  description: string | null
  severity: string | null
  status: string | null
  alert_time: string | null
  end_time: string | null
  grid_down_seconds: number | null
  grid_down_benefit_kwh: number | null
}

export function PlantDetailView({ plantId }: { plantId: string }) {
  const router = useRouter()
  const [plant, setPlant] = useState<Plant | null>(null)
  const [telemetry, setTelemetry] = useState<TelemetryData[]>([])
  const [telemetryStats, setTelemetryStats] = useState<TelemetryStatistics | null>(null)
  const [alerts, setAlerts] = useState<PlantAlert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Date selection for day view
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedPeriod, setSelectedPeriod] = useState<"day" | "month" | "year" | "total">("day")
  const [telemetryLoading, setTelemetryLoading] = useState(false)
  // For total view: date range (fixed from 2000 to current year, not user-changeable)
  const startYear = 2000
  const endYear = new Date().getFullYear()
  const [telemetryLoaded, setTelemetryLoaded] = useState(false) // Track if user has requested to load graph

  useEffect(() => {
    fetchPlantData()
    fetchAlerts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantId])

  useEffect(() => {
    // Only fetch telemetry if user has requested to load the graph
    if (plant && telemetryLoaded) {
      fetchTelemetry()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plant, selectedDate, selectedPeriod, telemetryLoaded])

  async function fetchPlantData() {
    try {
      setLoading(true)
      const response = await fetch(`/api/plants/${plantId}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch plant data")
      }

      const result = await response.json()
      setPlant(result)
    } catch (err: any) {
      setError(err.message || "Failed to load plant data")
    } finally {
      setLoading(false)
    }
  }

  // Fetch telemetry data based on selected period and date
  async function fetchTelemetry() {
    if (!plant) return

    try {
      setTelemetryLoading(true)
      let response: Response

      // For Solarman and SolarDM vendors, use the new API with date parameters
      if ((plant?.vendors?.vendor_type === "SOLARMAN" || plant?.vendors?.vendor_type === "SOLARDM") && selectedDate) {
        const year = selectedDate.getFullYear()
        const month = selectedDate.getMonth() + 1
        
        if (selectedPeriod === "day") {
          const day = selectedDate.getDate()
          response = await fetch(`/api/plants/${plantId}/telemetry?year=${year}&month=${month}&day=${day}`)
        } else if (selectedPeriod === "month") {
          // For month view, only send year and month (no day)
          // Both Solarman and SolarDM support month view
          response = await fetch(`/api/plants/${plantId}/telemetry?year=${year}&month=${month}`)
        } else if (selectedPeriod === "year") {
          // For year view, only send year (no month, no day)
          // Only Solarman supports year view currently
          if (plant?.vendors?.vendor_type === "SOLARMAN") {
            response = await fetch(`/api/plants/${plantId}/telemetry?year=${year}`)
          } else {
            setTelemetry([])
            setTelemetryStats(null)
            return
          }
        } else if (selectedPeriod === "total") {
          // For total view, send period=total and date range
          // Only Solarman supports total view currently
          if (plant?.vendors?.vendor_type === "SOLARMAN") {
            response = await fetch(`/api/plants/${plantId}/telemetry?period=total&startYear=${startYear}&endYear=${endYear}`)
          } else {
            setTelemetry([])
            setTelemetryStats(null)
            return
          }
        } else {
          setTelemetry([])
          setTelemetryStats(null)
          return
        }
      } else {
        // Fallback: return empty data if not Solarman or SolarDM
        setTelemetry([])
        setTelemetryStats(null)
        return
      }
      
      if (response.ok) {
        const result = await response.json()
        setTelemetry(result.data || [])
        
        // Set statistics if available (from Solarman API)
        if (result.statistics) {
          setTelemetryStats(result.statistics)
        } else {
          setTelemetryStats(null)
        }
      } else {
        setTelemetry([])
        setTelemetryStats(null)
      }
    } catch (err) {
      console.error("Failed to fetch telemetry:", err)
      setTelemetry([])
      setTelemetryStats(null)
    } finally {
      setTelemetryLoading(false)
    }
  }

  const handleDateChange = (direction: "prev" | "next") => {
    if (selectedPeriod === "day") {
      if (direction === "prev") {
        setSelectedDate(subDays(selectedDate, 1))
      } else {
        setSelectedDate(addDays(selectedDate, 1))
      }
    } else if (selectedPeriod === "month") {
      if (direction === "prev") {
        setSelectedDate(subMonths(startOfMonth(selectedDate), 1))
      } else {
        setSelectedDate(addMonths(startOfMonth(selectedDate), 1))
      }
    } else if (selectedPeriod === "year") {
      if (direction === "prev") {
        setSelectedDate(subYears(startOfYear(selectedDate), 1))
      } else {
        setSelectedDate(addYears(startOfYear(selectedDate), 1))
      }
    }
    // Total view: date range is fixed, no navigation allowed
    // useEffect will automatically trigger fetchTelemetry() when selectedDate changes
    // No need to call it manually here to avoid double calls
  }

  const handleLoadGraph = () => {
    // Set telemetryLoaded to true - useEffect will automatically trigger fetchTelemetry()
    // This prevents double API calls
    setTelemetryLoaded(true)
  }

  // Fetch the latest alerts for this plant (limited via API default) so users see
  // quick downtime context without leaving the detail view.
  async function fetchAlerts() {
    try {
      setAlertsLoading(true)
      const response = await fetch(`/api/alerts?plantId=${plantId}&limit=5`)
      if (!response.ok) {
        setAlerts([])
        return
      }
      const result = await response.json()
      setAlerts(result.alerts || [])
    } catch (err) {
      console.error("Failed to fetch alerts:", err)
      setAlerts([])
    } finally {
      setAlertsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (error || !plant) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error || "Plant not found"}</p>
            </div>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const getNetworkStatusBadge = (status: string | null) => {
    if (!status) {
      return (
        <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
          <HelpCircle className="h-3 w-3" />
          N/A
        </Badge>
      )
    }
    
    // Normalize status by trimming whitespace (handle ' ALL_OFFLINE' with leading space)
    const normalizedStatus = status.trim().toUpperCase()
    
    const statusMap: Record<string, { variant: "default" | "destructive" | "secondary", label: string, icon: any }> = {
      NORMAL: { variant: "default", label: "Online", icon: Wifi },
      ALL_OFFLINE: { variant: "destructive", label: "Offline", icon: WifiOff },
      PARTIAL_OFFLINE: { variant: "secondary", label: "Partial", icon: Activity },
    }

    const statusInfo = statusMap[normalizedStatus]
    
    if (!statusInfo) {
      // Unknown status - show as N/A with help icon
      return (
        <Badge variant="outline" className="flex items-center gap-1 text-muted-foreground">
          <HelpCircle className="h-3 w-3" />
          N/A
        </Badge>
      )
    }
    
    const Icon = statusInfo.icon

    return (
      <Badge variant={statusInfo.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {statusInfo.label}
      </Badge>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Building2 className="h-6 w-6 md:h-8 md:w-8 text-primary flex-shrink-0" />
            <h1 className="text-2xl md:text-3xl font-bold text-foreground break-words">
              {plant.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{plant.organizations.name}</span>
            <span>•</span>
            <Badge variant="outline">{plant.vendors.name}</Badge>
            {getNetworkStatusBadge(plant.network_status)}
          </div>
        </div>
        <Link href={`/orgs/${plant.organizations.id}/plants`}>
          <Button variant="outline" className="w-full sm:w-auto">
            View All Plants
          </Button>
        </Link>
      </div>

      {/* Plant Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Capacity */}
        {plant.capacity_kw !== null && plant.capacity_kw !== undefined && (
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Installed Capacity
                  </p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {typeof plant.capacity_kw === 'number' ? plant.capacity_kw.toFixed(2) : 'N/A'} kW
                  </p>
                </div>
                <Zap className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Power */}
        {plant.current_power_kw !== null && plant.current_power_kw !== undefined && (
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    Current Power
                  </p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {typeof plant.current_power_kw === 'number' ? `${plant.current_power_kw.toFixed(2)} kW` : "N/A"}
                  </p>
                </div>
                <Activity className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* Energy Production Cards - Only show cards for data that exists */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plant.daily_energy_kwh !== null && plant.daily_energy_kwh !== undefined && (
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Daily Energy</p>
                <p className="text-xl font-bold">
                  {typeof plant.daily_energy_kwh === 'number' ? `${plant.daily_energy_kwh.toFixed(2)} kWh` : "N/A"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {plant.monthly_energy_mwh !== null && plant.monthly_energy_mwh !== undefined && (
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monthly Energy</p>
                <p className="text-xl font-bold">
                  {typeof plant.monthly_energy_mwh === 'number' ? `${plant.monthly_energy_mwh.toFixed(3)} MWh` : "N/A"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {plant.yearly_energy_mwh !== null && plant.yearly_energy_mwh !== undefined && (
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Yearly Energy</p>
                <p className="text-xl font-bold">
                  {typeof plant.yearly_energy_mwh === 'number' ? `${plant.yearly_energy_mwh.toFixed(3)} MWh` : "N/A"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {plant.total_energy_mwh !== null && plant.total_energy_mwh !== undefined && (
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Energy</p>
                <p className="text-xl font-bold">
                  {typeof plant.total_energy_mwh === 'number' ? `${plant.total_energy_mwh.toFixed(3)} MWh` : "N/A"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Plant Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Location & Contact */}
        <Card>
          <CardHeader>
            <CardTitle>Plant Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {plant.location?.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">Location</p>
                  <p className="text-base break-words">{plant.location.address}</p>
                  {plant.location.lat !== null && plant.location.lat !== undefined && 
                   plant.location.lng !== null && plant.location.lng !== undefined && 
                   typeof plant.location.lat === 'number' && typeof plant.location.lng === 'number' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {plant.location?.lat !== null && plant.location?.lat !== undefined && plant.location?.lng !== null && plant.location?.lng !== undefined
                        ? `${plant.location.lat.toFixed(6)}, ${plant.location.lng.toFixed(6)}`
                        : "N/A"}
                    </p>
                  )}
                </div>
              </div>
            )}

            {plant.vendor_created_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created Date</p>
                  <p className="text-base">
                    {format(new Date(plant.vendor_created_date), "PPP")}
                  </p>
                </div>
              </div>
            )}

            {plant.start_operating_time && (
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Operating Since</p>
                  <p className="text-base">
                    {format(new Date(plant.start_operating_time), "PPP")}
                  </p>
                </div>
              </div>
            )}

            {plant.last_update_time && (
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                  <p className="text-base">
                    {format(new Date(plant.last_update_time), "PPp")}
                  </p>
                </div>
              </div>
            )}

            {plant.last_refreshed_at && (
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Last Refresh</p>
                  <p className="text-base">
                    {format(new Date(plant.last_refreshed_at), "PPp")}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Telemetry Chart + Recent Alerts */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4">
                <CardTitle>Telemetry</CardTitle>
                
                {/* Period Tabs and Date Selector (for Solarman and SolarDM) */}
                {(plant?.vendors?.vendor_type === "SOLARMAN" || plant?.vendors?.vendor_type === "SOLARDM") && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <Tabs 
                      value={selectedPeriod} 
                      onValueChange={(v) => {
                        setSelectedPeriod(v as typeof selectedPeriod)
                        // useEffect will automatically trigger fetchTelemetry() when selectedPeriod changes
                        // No need to call it manually here to avoid double calls
                      }}
                    >
                      <TabsList>
                        <TabsTrigger value="day">Day</TabsTrigger>
                        <TabsTrigger value="month">Month</TabsTrigger>
                        <TabsTrigger value="year" disabled={plant?.vendors?.vendor_type === "SOLARDM"}>Year</TabsTrigger>
                        <TabsTrigger value="total" disabled={plant?.vendors?.vendor_type === "SOLARDM"}>Total</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    
                    {(selectedPeriod === "day" || selectedPeriod === "month" || selectedPeriod === "year") && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDateChange("prev")}
                          disabled={telemetryLoading}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-background">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {selectedPeriod === "day" 
                              ? format(selectedDate, "yyyy/MM/dd")
                              : selectedPeriod === "month"
                              ? format(selectedDate, "yyyy/MM")
                              : format(selectedDate, "yyyy")}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDateChange("next")}
                          disabled={telemetryLoading || 
                            (selectedPeriod === "day" && selectedDate && selectedDate >= new Date()) || 
                            (selectedPeriod === "month" && selectedDate && startOfMonth(selectedDate) >= startOfMonth(new Date())) || 
                            (selectedPeriod === "year" && selectedDate && startOfYear(selectedDate) >= startOfYear(new Date()))}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {selectedPeriod === "total" && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-background">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {startYear} ~ {endYear}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!telemetryLoaded ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Activity className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mb-4">Click the button below to load telemetry graph</p>
                  <Button onClick={handleLoadGraph} className="gap-2">
                    <Activity className="h-4 w-4" />
                    Load Telemetry Graph
                  </Button>
                </div>
              ) : telemetryLoading ? (
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                  <div className="relative">
                    {/* Outer spinning ring */}
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary border-r-primary"></div>
                    {/* Inner pulsing dot */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-3 w-3 bg-primary rounded-full animate-pulse"></div>
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm font-medium text-foreground">Fetching telemetry data...</p>
                    <p className="text-xs text-muted-foreground">This may take a few seconds</p>
                    {/* Animated dots */}
                    <div className="flex items-center justify-center gap-1 pt-2">
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              ) : telemetry.length > 0 ? (
                <TelemetryChart 
                  data={telemetry} 
                  title={selectedPeriod === "day" ? "Solar Power" : selectedPeriod === "month" ? "Monthly Production" : selectedPeriod === "year" ? "Yearly Production" : selectedPeriod === "total" ? "Total Production" : "Generation Power (24h)"}
                  statistics={telemetryStats || undefined}
                  showAreaFill={plant?.vendors?.vendor_type === "SOLARMAN" || (plant?.vendors?.vendor_type === "SOLARDM" && selectedPeriod === "day")}
                  period={selectedPeriod}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <div className="text-center">
                    <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="mb-4">No telemetry data available</p>
                    <Button variant="outline" onClick={handleLoadGraph} className="gap-2">
                      <Activity className="h-4 w-4" />
                      Retry
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Recent Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alertsLoading ? (
                <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                  Loading alerts...
                </div>
              ) : alerts.length === 0 ? (
                <div className="flex items-center justify-center h-20 text-xs text-muted-foreground text-center">
                  No recent alerts for this plant.
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="rounded-md border bg-card/60 px-3 py-2 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">
                          {alert.title || "No Mains Voltage"}
                        </span>
                        {alert.severity && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {alert.severity}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        {alert.alert_time && (
                          <span>
                            Start: {new Date(alert.alert_time).toLocaleString()}
                          </span>
                        )}
                        {alert.end_time && (
                          <span>
                            End: {new Date(alert.end_time).toLocaleString()}
                          </span>
                        )}
                        {typeof alert.grid_down_seconds === "number" && (
                          <span>
                            Grid down: {(alert.grid_down_seconds / 60).toFixed(1)} min
                          </span>
                        )}
                        {typeof alert.grid_down_benefit_kwh === "number" && (
                          <span>
                            Grid downtime benefit: {alert.grid_down_benefit_kwh !== null && alert.grid_down_benefit_kwh !== undefined && typeof alert.grid_down_benefit_kwh === 'number'
                              ? alert.grid_down_benefit_kwh.toFixed(2)
                              : 'N/A'} kWh
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex justify-end">
                <Link href={`/alerts/vendor/${plant?.vendors?.id}/plant/${plant?.id}`}>
                  <Button variant="outline" size="sm" className="h-7 px-3 text-xs">
                    View full alert history
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

