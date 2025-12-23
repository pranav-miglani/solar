"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ClipboardList,
  Building2,
  Zap,
  MapPin,
  ArrowLeft,
  ExternalLink,
  AlertCircle,
  Trash2,
  Wifi,
  WifiOff,
  Sun,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ProductionOverview } from "@/components/ProductionOverview"
import { WorkOrderModal } from "@/components/WorkOrderModal"
import { InsolationChart } from "@/components/InsolationChart"
import { subDays } from "date-fns"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface Plant {
  id: number
  name: string
  capacity_kw: number
  current_power_kw: number | null
  daily_energy_kwh: number | null
  monthly_energy_mwh: number | null
  yearly_energy_mwh: number | null
  total_energy_mwh: number | null
  last_update_time: string | null
  location: {
    lat?: number
    lng?: number
    address?: string
  } | null
  organizations: {
    id: number
    name: string
  }
  vendors: {
    id: number
    name: string
    vendor_type: string
  }
}

interface WorkOrder {
  id: number
  title: string
  description: string | null
  created_at: string
  wms_device?: {
    id: number
    device_name: string
    vendor_device_id: string
    site_name: string
    site_address: string | null
    vendor_name: string
    vendor_type: string
  } | null
  work_order_plants: Array<{
    id: number
    is_active: boolean
    added_at: string
    plants: Plant
  }>
}

interface InsolationReading {
  reading_date: string
  insolation_value: number
  reading_count?: number
  metadata?: {
    min_irr?: number
    max_irr?: number
  }
}

interface WorkOrderDetailViewProps {
  workOrderId: string
  accountType: string
}

export function WorkOrderDetailView({ workOrderId, accountType }: WorkOrderDetailViewProps) {
  const router = useRouter()
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productionData, setProductionData] = useState<any>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [insolationReadings, setInsolationReadings] = useState<InsolationReading[]>([])
  const [insolationLoading, setInsolationLoading] = useState(false)
  const [insolationDateRange, setInsolationDateRange] = useState(30) // Default to last 30 days

  const isSuperAdmin = accountType === "SUPERADMIN" || accountType === "DEVELOPER"
  const isGovt = accountType === "GOVT"

  useEffect(() => {
    fetchWorkOrder()
    fetchProductionData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId])

  // Fetch insolation data when WMS device is assigned (only for SUPERADMIN/DEVELOPER)
  useEffect(() => {
    if (isSuperAdmin && workOrder?.wms_device?.id) {
      fetchInsolationData(workOrder.wms_device.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrder?.wms_device?.id, isSuperAdmin, insolationDateRange])

  async function fetchWorkOrder() {
    try {
      setLoading(true)
      const response = await fetch(`/api/workorders/${workOrderId}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch work order")
      }

      const result = await response.json()
      setWorkOrder(result.workOrder)
    } catch (err: any) {
      setError(err.message || "Failed to load work order")
    } finally {
      setLoading(false)
    }
  }

  async function fetchProductionData() {
    try {
      const response = await fetch(`/api/workorders/${workOrderId}/production`)
      if (response.ok) {
        const data = await response.json()
        setProductionData(data)
      }
    } catch (err) {
      console.error("Failed to fetch production data:", err)
    }
  }

  async function fetchInsolationData(deviceId: number) {
    try {
      setInsolationLoading(true)
      const endDate = new Date().toISOString().split("T")[0]
      const startDate = subDays(new Date(), insolationDateRange).toISOString().split("T")[0]
      
      const response = await fetch(
        `/api/insolation-readings?deviceId=${deviceId}&startDate=${startDate}&endDate=${endDate}`
      )

      if (response.ok) {
        const data = await response.json()
        setInsolationReadings(data.readings || [])
      } else {
        setInsolationReadings([])
      }
    } catch (err) {
      console.error("Failed to fetch insolation data:", err)
      setInsolationReadings([])
    } finally {
      setInsolationLoading(false)
    }
  }

  async function handleDelete() {
    if (!isSuperAdmin || !workOrder) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/workorders/${workOrderId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Failed to delete work order")
        setDeleting(false)
        return
      }

      // Redirect to work orders list after successful deletion
      router.push("/workorders")
    } catch (error) {
      console.error("Error deleting work order:", error)
      alert("Failed to delete work order")
      setDeleting(false)
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

  if (error || !workOrder) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error || "Work order not found"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Get unique organization (all plants should be from same org)
  const organization = workOrder.work_order_plants?.[0]?.plants?.organizations
  const activePlants = workOrder.work_order_plants
    ?.filter((wop) => wop.is_active)
    .map((wop) => wop.plants) || []

  // Helper to guard .toFixed usage whenever vendor data is missing/NaN.
  const formatNumber = (value: number | null | undefined, fractionDigits = 2, unit?: string) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "N/A"
    }
    return `${value.toFixed(fractionDigits)}${unit ? ` ${unit}` : ""}`
  }

  // Calculate aggregated metrics
  // Aggregate summary uses raw plant payloads (already in kW / kWh / MWh). Keep units aligned
  // with DB schema: capacity/currentPower in kW, dailyEnergy in kWh, monthly/yearly in MWh.
  const aggregatedMetrics = {
    installedCapacityKw: activePlants.reduce((sum, p) => sum + (p.capacity_kw || 0), 0),
    currentPowerKw: activePlants.reduce((sum, p) => sum + (p.current_power_kw || 0), 0),
    dailyEnergyKwh: activePlants.reduce((sum, p) => sum + (p.daily_energy_kwh || 0), 0),
    monthlyEnergyMwh: activePlants.reduce((sum, p) => sum + (p.monthly_energy_mwh || 0), 0),
    yearlyEnergyMwh: activePlants.reduce((sum, p) => sum + (p.yearly_energy_mwh || 0), 0),
    totalEnergyMwh: activePlants.reduce((sum, p) => sum + (p.total_energy_mwh || 0), 0),
  }

  const lastUpdateTime = activePlants
    .map((p) => p.last_update_time)
    .filter(Boolean)
    .sort()
    .reverse()[0] || null

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Link href="/workorders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2 md:gap-3 flex-wrap">
            <ClipboardList className="h-6 w-6 md:h-8 md:w-8 text-primary flex-shrink-0" />
            <span className="break-words">{workOrder.title}</span>
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-2">
            Created {new Date(workOrder.created_at).toLocaleDateString()}
          </p>
        </div>
        {isSuperAdmin && (
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Work Order
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Work Order</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;{workOrder.title}&quot;? This action cannot be undone and will remove all associated plant mappings.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Deleting...
                    </span>
                  ) : (
                    "Delete"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Organization & Summary Cards */}
      <div className={`grid grid-cols-1 gap-4 ${isSuperAdmin ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Organization
                </p>
                <p className="text-xl font-bold text-blue-900 dark:text-blue-100 truncate">
                  {organization?.name || "N/A"}
                </p>
              </div>
              <Building2 className="h-8 w-8 text-blue-500" />
            </div>
            {organization && accountType !== "GOVT" && (
              <Link href={`/orgs/${organization.id}/plants`}>
                <Button variant="ghost" size="sm" className="mt-2 w-full">
                  View Organization Plants
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  Total Plants
                </p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {activePlants.length}
                </p>
              </div>
              <Zap className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  Total Capacity
                </p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {formatNumber(aggregatedMetrics.installedCapacityKw, 1, "kW")}
                </p>
              </div>
              <Zap className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        {/* WMS Device Mapping Card (only for SUPERADMIN/DEVELOPER) */}
        {isSuperAdmin && (
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                    WMS Device Mapping
                  </p>
                  {workOrder?.wms_device ? (
                    <div className="mt-2">
                      <p className="text-sm font-semibold text-orange-900 dark:text-orange-100 truncate">
                        {workOrder.wms_device.site_name} &gt; {workOrder.wms_device.device_name || workOrder.wms_device.vendor_device_id} ({workOrder.wms_device.vendor_name})
                      </p>
                      {workOrder.wms_device.site_address && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {workOrder.wms_device.site_address}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-2">
                      <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                        No WMS mapping
                      </p>
                    </div>
                  )}
                </div>
                {workOrder?.wms_device ? (
                  <Wifi className="h-8 w-8 text-orange-500" />
                ) : (
                  <WifiOff className="h-8 w-8 text-red-500" />
                )}
              </div>
              {!workOrder?.wms_device && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => setEditModalOpen(true)}
                >
                  Assign WMS Device
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Production Overview */}
      {productionData && (
        <ProductionOverview
          metrics={productionData.aggregated}
          lastUpdated={lastUpdateTime ?? undefined}
          title="Work Order Production Overview"
        />
      )}

      {/* Foot Notes */}
      {workOrder.description && (
        <Card>
          <CardHeader>
            <CardTitle>Foot Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{workOrder.description}</p>
          </CardContent>
        </Card>
      )}

      {/* WMS Device Insolation Graph (only for SUPERADMIN/DEVELOPER) */}
      {isSuperAdmin && workOrder?.wms_device && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sun className="h-5 w-5 text-yellow-500" />
                <CardTitle>WMS Device Insolation Data</CardTitle>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={insolationDateRange === 7 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setInsolationDateRange(7)}
                >
                  7 Days
                </Button>
                <Button
                  variant={insolationDateRange === 30 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setInsolationDateRange(30)}
                >
                  30 Days
                </Button>
                <Button
                  variant={insolationDateRange === 100 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setInsolationDateRange(100)}
                >
                  100 Days
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {workOrder.wms_device.site_name} &gt; {workOrder.wms_device.device_name || workOrder.wms_device.vendor_device_id} ({workOrder.wms_device.vendor_name})
            </p>
          </CardHeader>
          <CardContent>
            {insolationLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading insolation data...</div>
              </div>
            ) : insolationReadings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No insolation data available for the selected period
              </div>
            ) : (
              <InsolationChart
                data={insolationReadings}
                title="Insolation Readings"
                statistics={{
                  averageInsolation: insolationReadings.reduce((sum, r) => sum + r.insolation_value, 0) / insolationReadings.length,
                  minInsolation: Math.min(...insolationReadings.map(r => r.insolation_value)),
                  maxInsolation: Math.max(...insolationReadings.map(r => r.insolation_value)),
                  totalDays: insolationReadings.length,
                }}
                period="range"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Plants Table - Desktop */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl md:text-2xl">Plants & Stations</CardTitle>
          <p className="text-sm text-muted-foreground">
            {activePlants.length} {activePlants.length === 1 ? "plant" : "plants"} in this work order
          </p>
        </CardHeader>
        <CardContent>
          {/* Desktop Table View */}
          <div className="hidden lg:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Plant Name</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Current Power</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Production Metrics</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activePlants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No plants assigned to this work order
                    </TableCell>
                  </TableRow>
                ) : (
                  activePlants.map((plant) => (
                    <TableRow key={plant.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{plant.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{plant.vendors.name}</Badge>
                      </TableCell>
                      <TableCell>{formatNumber(plant.capacity_kw, 2, "kW")}</TableCell>
                      <TableCell>
                        {plant.current_power_kw !== null ? (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {formatNumber(plant.current_power_kw, 2, "kW")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {plant.location?.address ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-4 w-4" />
                            <span className="truncate max-w-[200px]">
                              {plant.location.address}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          {plant.daily_energy_kwh !== null && (
                            <div>Daily: {formatNumber(plant.daily_energy_kwh, 2, "kWh")}</div>
                          )}
                          {plant.monthly_energy_mwh !== null && (
                            <div>Monthly: {formatNumber(plant.monthly_energy_mwh, 2, "MWh")}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/plants/${plant.id}`}>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3">
            {activePlants.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No plants assigned to this work order
              </div>
            ) : (
              activePlants.map((plant) => (
                <Card key={plant.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-base flex-1">{plant.name}</h3>
                      <Badge variant="outline">{plant.vendors.name}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Capacity</p>
                        <p className="font-medium">{formatNumber(plant.capacity_kw, 2, "kW")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Current Power</p>
                        <p className="font-medium">
                          {plant.current_power_kw !== null ? (
                            <span className="text-green-600 dark:text-green-400">
                              {formatNumber(plant.current_power_kw, 2, "kW")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {plant.location?.address && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground break-words">{plant.location.address}</span>
                      </div>
                    )}
                    <div className="space-y-1 text-xs border-t pt-3">
                      {plant.daily_energy_kwh !== null && (
                        <div>Daily: {formatNumber(plant.daily_energy_kwh, 2, "kWh")}</div>
                      )}
                      {plant.monthly_energy_mwh !== null && (
                        <div>Monthly: {formatNumber(plant.monthly_energy_mwh, 2, "MWh")}</div>
                      )}
                    </div>
                    <Link href={`/plants/${plant.id}`}>
                      <Button variant="ghost" size="sm" className="w-full">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View Plant
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal for WMS Device Assignment */}
      {isSuperAdmin && (
        <WorkOrderModal
          open={editModalOpen}
          onOpenChange={(open) => {
            setEditModalOpen(open)
            if (!open) {
              // Refresh work order data when modal closes
              fetchWorkOrder()
            }
          }}
          workOrderId={workOrder?.id}
          organizationName={organization?.name}
        />
      )}
    </div>
  )
}

