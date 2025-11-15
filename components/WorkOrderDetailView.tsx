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
} from "lucide-react"
import Link from "next/link"
import { ProductionOverview } from "@/components/ProductionOverview"

interface Plant {
  id: number
  name: string
  capacity_kw: number
  current_power_kw: number | null
  daily_energy_mwh: number | null
  monthly_energy_mwh: number | null
  yearly_energy_mwh: number | null
  total_energy_mwh: number | null
  performance_ratio: number | null
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
  work_order_plants: Array<{
    id: number
    is_active: boolean
    added_at: string
    plants: Plant
  }>
}

export function WorkOrderDetailView({ workOrderId }: { workOrderId: string }) {
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productionData, setProductionData] = useState<any>(null)

  useEffect(() => {
    fetchWorkOrder()
    fetchProductionData()
  }, [workOrderId])

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

  // Calculate aggregated metrics
  const aggregatedMetrics = {
    installedCapacityKw: activePlants.reduce((sum, p) => sum + (p.capacity_kw || 0), 0),
    currentPowerKw: activePlants.reduce((sum, p) => sum + (p.current_power_kw || 0), 0),
    dailyEnergyMwh: activePlants.reduce((sum, p) => sum + (p.daily_energy_mwh || 0), 0),
    monthlyEnergyMwh: activePlants.reduce((sum, p) => sum + (p.monthly_energy_mwh || 0), 0),
    yearlyEnergyMwh: activePlants.reduce((sum, p) => sum + (p.yearly_energy_mwh || 0), 0),
    totalEnergyMwh: activePlants.reduce((sum, p) => sum + (p.total_energy_mwh || 0), 0),
    averagePerformanceRatio: activePlants
      .filter((p) => p.performance_ratio !== null)
      .reduce((sum, p, _, arr) => sum + (p.performance_ratio || 0) / arr.length, 0),
  }

  const lastUpdateTime = activePlants
    .map((p) => p.last_update_time)
    .filter(Boolean)
    .sort()
    .reverse()[0] || null

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/workorders">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <ClipboardList className="h-8 w-8 text-primary" />
            {workOrder.title}
          </h1>
          <p className="text-muted-foreground mt-2">
            Created {new Date(workOrder.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Organization & Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            {organization && (
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
                  {aggregatedMetrics.installedCapacityKw.toFixed(1)} kW
                </p>
              </div>
              <Zap className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Production Overview */}
      {productionData && (
        <ProductionOverview
          metrics={productionData.aggregated}
          lastUpdated={lastUpdateTime}
          title="Work Order Production Overview"
        />
      )}

      {/* Description */}
      {workOrder.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{workOrder.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Plants Table */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Plants & Stations</CardTitle>
          <p className="text-sm text-muted-foreground">
            {activePlants.length} {activePlants.length === 1 ? "plant" : "plants"} in this work order
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
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
                      <TableCell>{plant.capacity_kw.toFixed(2)} kW</TableCell>
                      <TableCell>
                        {plant.current_power_kw !== null ? (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {plant.current_power_kw.toFixed(2)} kW
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
                          {plant.daily_energy_mwh !== null && (
                            <div>Daily: {plant.daily_energy_mwh.toFixed(2)} MWh</div>
                          )}
                          {plant.monthly_energy_mwh !== null && (
                            <div>Monthly: {plant.monthly_energy_mwh.toFixed(2)} MWh</div>
                          )}
                          {plant.performance_ratio !== null && (
                            <div>PR: {(plant.performance_ratio * 100).toFixed(2)}%</div>
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
        </CardContent>
      </Card>
    </div>
  )
}

