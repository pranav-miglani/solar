"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
import { Loader2, Trash2, AlertTriangle, Factory, Building2, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface DisabledPlant {
  id: number
  plant_id: number
  org_id: number
  vendor_id: number
  vendor_plant_id: string
  name: string
  capacity_kw: number
  location: any
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
  disabled_at: string
  days_since_refresh: number
  organizations: {
    id: number
    name: string
  }
  vendors: {
    id: number
    name: string
    vendor_type: string
  }
  hasWorkOrder: boolean
}

export function DisabledPlantsTable() {
  const [plants, setPlants] = useState<DisabledPlant[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingPlantId, setDeletingPlantId] = useState<number | null>(null)

  useEffect(() => {
    fetchDisabledPlants()
  }, [])

  async function fetchDisabledPlants() {
    try {
      const response = await fetch("/api/disabled-plants")
      const data = await response.json()
      setPlants(data.plants || [])
    } catch (error) {
      console.error("Error fetching disabled plants:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(plantId: number) {
    setDeletingPlantId(plantId)
    try {
      const response = await fetch(`/api/disabled-plants/${plantId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        // Remove from list
        setPlants(plants.filter((p) => p.id !== plantId))
      } else {
        const error = await response.json()
        alert(error.error || "Failed to delete plant")
      }
    } catch (error: any) {
      alert(`Error deleting plant: ${error.message}`)
    } finally {
      setDeletingPlantId(null)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleString()
  }

  const formatNumber = (value: number | null, decimals: number = 2) => {
    if (value === null || value === undefined) return "N/A"
    return Number(value).toFixed(decimals)
  }

  if (loading) {
    return (
      <Card className="p-12">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="p-6 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 border-orange-200 dark:border-orange-800">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          <div>
            <h3 className="font-semibold text-orange-900 dark:text-orange-100">
              {plants.length} Disabled Plant{plants.length !== 1 ? "s" : ""}
            </h3>
            <p className="text-sm text-orange-700 dark:text-orange-300">
              Plants that haven&apos;t been refreshed in 15+ days
            </p>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="border rounded-lg overflow-hidden shadow-sm bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gradient-to-r from-muted/50 to-muted/30 border-b-2">
              <TableRow className="hover:bg-muted/50">
                <TableHead className="font-bold text-base">Plant Name</TableHead>
                <TableHead className="font-bold text-base">Organization</TableHead>
                <TableHead className="font-bold text-base">Vendor</TableHead>
                <TableHead className="font-bold text-base">Capacity</TableHead>
                <TableHead className="font-bold text-base">Days Since Refresh</TableHead>
                <TableHead className="font-bold text-base">Disabled At</TableHead>
                <TableHead className="font-bold text-base">Status</TableHead>
                <TableHead className="font-bold text-base text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <Factory className="h-12 w-12 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground font-medium">
                        No disabled plants found
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Plants are automatically disabled after 15 days of inactivity
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                plants.map((plant, index) => (
                  <TableRow
                    key={plant.id}
                    className="border-b hover:bg-gradient-to-r hover:from-primary/5 hover:to-primary/10 transition-all duration-200 animate-in"
                    style={{
                      animationDelay: `${index * 50}ms`
                    }}
                  >
                    <TableCell className="font-semibold text-base py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 p-2.5">
                          <Factory className="h-full w-full text-white" />
                        </div>
                        <div>
                          <div className="font-semibold">{plant.name}</div>
                          <div className="text-xs text-muted-foreground">
                            ID: {plant.vendor_plant_id}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{plant.organizations?.name || "N/A"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{plant.vendors?.name || "N/A"}</Badge>
                    </TableCell>
                    <TableCell>
                      {formatNumber(plant.capacity_kw)} kW
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">
                        {plant.days_since_refresh} days
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(plant.disabled_at)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {plant.hasWorkOrder ? (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          Has Work Order
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          No Work Order
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {plant.hasWorkOrder ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled
                          className="opacity-50 cursor-not-allowed"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete Disabled
                        </Button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={deletingPlantId === plant.id}
                            >
                              {deletingPlantId === plant.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Disabled Plant</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete &quot;{plant.name}&quot;? This action
                                cannot be undone. The plant record and all associated data will
                                be permanently removed.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(plant.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}

