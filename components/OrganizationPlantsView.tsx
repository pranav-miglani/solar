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
  Building2,
  Zap,
  MapPin,
  Calendar,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"
import Link from "next/link"

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
  vendors: {
    id: number
    name: string
    vendor_type: string
  }
  activeWorkOrders: Array<{
    id: number
    title: string
    description: string | null
    priority: string
    created_at: string
    created_by_account: {
      id: string
      email: string
    }
  }>
}

interface Organization {
  id: number
  name: string
}

interface OrganizationPlantsData {
  organization: Organization
  plants: Plant[]
  totalPlants: number
}

export function OrganizationPlantsView({ orgId }: { orgId: string }) {
  const [data, setData] = useState<OrganizationPlantsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [orgId])

  async function fetchData() {
    try {
      setLoading(true)
      const response = await fetch(`/api/orgs/${orgId}/plants`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch organization plants")
      }

      const result = await response.json()
      setData(result)
    } catch (err: any) {
      setError(err.message || "Failed to load data")
    } finally {
      setLoading(false)
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

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { organization, plants, totalPlants } = data

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            {organization.name}
          </h1>
          <p className="text-muted-foreground mt-2">
            {totalPlants} {totalPlants === 1 ? "Plant" : "Plants"} Total
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Total Plants
                </p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {totalPlants}
                </p>
              </div>
              <Zap className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  Total Capacity
                </p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {plants
                    .reduce((sum, p) => sum + (p.capacity_kw || 0), 0)
                    .toFixed(1)}{" "}
                  kW
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
                  Plants in Work Orders
                </p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {plants.filter((p) => p.activeWorkOrders.length > 0).length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                  Available Plants
                </p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {plants.filter((p) => p.activeWorkOrders.length === 0).length}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plants Table */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Plants & Work Orders</CardTitle>
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
                  <TableHead>Work Orders</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No plants found for this organization
                    </TableCell>
                  </TableRow>
                ) : (
                  plants.map((plant) => (
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
                        {plant.activeWorkOrders.length > 0 ? (
                          <div className="space-y-1">
                            {plant.activeWorkOrders.map((wo) => (
                              <Link
                                key={wo.id}
                                href={`/workorders/${wo.id}`}
                                className="block"
                              >
                                <Badge
                                  variant={
                                    wo.priority === "HIGH"
                                      ? "destructive"
                                      : wo.priority === "MEDIUM"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="cursor-pointer hover:opacity-80"
                                >
                                  {wo.title}
                                </Badge>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            No Work Order
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link href={`/workorders?plantId=${plant.id}`}>
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

