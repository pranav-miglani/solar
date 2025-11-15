"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X, Circle, Search, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Org {
  id: number
  name: string
}

interface Plant {
  id: number
  name: string
  capacity_kw: number
  vendor_plant_id: string
  vendors?: {
    id: number
    name: string
    vendor_type: string
  }
  networkStatus?: string | null
  current_power_kw?: number | null
  metadata?: any
}

interface WorkOrderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workOrderId?: number
  organizationName?: string
}

export function WorkOrderModal({
  open,
  onOpenChange,
  workOrderId,
  organizationName,
}: WorkOrderModalProps) {
  const router = useRouter()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  const [availablePlants, setAvailablePlants] = useState<Plant[]>([])
  const [selectedPlants, setSelectedPlants] = useState<Plant[]>([])
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
  })
  const [loading, setLoading] = useState(false)
  const [fetchingPlants, setFetchingPlants] = useState(false)
  const [plantSearchQuery, setPlantSearchQuery] = useState("")
  const [plantsFetched, setPlantsFetched] = useState(false)

  const isEditMode = !!workOrderId

  useEffect(() => {
    if (open) {
      fetchOrgs()
      if (isEditMode) {
        fetchWorkOrder()
      }
    } else {
      // Reset form when modal closes
      setFormData({ title: "", description: "", location: "" })
      setSelectedOrgId(null)
      setSelectedPlants([])
      setAvailablePlants([])
      setPlantSearchQuery("")
      setPlantsFetched(false)
    }
  }, [open, workOrderId])

  async function fetchOrgs() {
    try {
      const response = await fetch("/api/orgs")
      const data = await response.json()
      if (data.orgs) {
        setOrgs(data.orgs)
      }
    } catch (error) {
      console.error("Error fetching orgs:", error)
    }
  }

  async function fetchWorkOrder() {
    if (!workOrderId) return

    try {
      const response = await fetch(`/api/workorders/${workOrderId}`)
      const data = await response.json()
      const wo = data.workOrder

      if (wo) {
        setFormData({
          title: wo.title || "",
          description: wo.description || "",
          location: wo.location || "",
        })

        // Get organization from first plant
        const firstPlant = wo.work_order_plants?.[0]?.plants
        if (firstPlant?.organizations) {
          setSelectedOrgId(firstPlant.organizations.id)
          
          // Set selected plants with networkStatus
          const plants = wo.work_order_plants
            ?.filter((wop: any) => wop.is_active)
            .map((wop: any) => {
              const plant = wop.plants
              return {
                ...plant,
                networkStatus:
                  plant.metadata?.networkStatus ||
                  plant.metadata?.network_status ||
                  plant.networkStatus ||
                  null,
              }
            }) || []
          setSelectedPlants(plants)
        }
      }
    } catch (error) {
      console.error("Error fetching work order:", error)
    }
  }

  // Fetch plants only once when org is selected (not on every render)
  useEffect(() => {
    async function fetchAvailablePlants() {
      if (!selectedOrgId || plantsFetched) {
        return
      }

      setFetchingPlants(true)
      try {
        const response = await fetch(`/api/plants/unassigned?orgIds=${selectedOrgId}`)
        const data = await response.json()
        // Extract networkStatus from metadata if present
        const plantsWithStatus = (data.plants || []).map((plant: any) => ({
          ...plant,
          networkStatus:
            plant.metadata?.networkStatus ||
            plant.metadata?.network_status ||
            plant.networkStatus ||
            null,
        }))
        setAvailablePlants(plantsWithStatus)
        setPlantsFetched(true)
      } catch (error) {
        console.error("Error fetching available plants:", error)
        setAvailablePlants([])
      } finally {
        setFetchingPlants(false)
      }
    }

    if (open && selectedOrgId && !plantsFetched) {
      fetchAvailablePlants()
    }
  }, [selectedOrgId, open, plantsFetched])

  function handleAddPlant(plant: Plant) {
    if (!selectedPlants.find((p) => p.id === plant.id)) {
      setSelectedPlants([...selectedPlants, plant])
    }
  }

  function handleRemovePlant(plantId: number) {
    setSelectedPlants(selectedPlants.filter((p) => p.id !== plantId))
  }

  function getPlantStatus(plant: Plant): "online" | "offline" {
    // Check networkStatus from metadata or if plant has current power
    // networkStatus can be "ONLINE", "OFFLINE", "ALL_OFFLINE", etc.
    const status = plant.networkStatus?.toUpperCase()
    if (
      status === "ONLINE" ||
      (plant.current_power_kw !== null && plant.current_power_kw > 0)
    ) {
      return "online"
    }
    return "offline"
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedOrgId) {
      alert("Please select an organization")
      return
    }

    if (selectedPlants.length === 0) {
      alert("Please select at least one plant")
      return
    }

    setLoading(true)

    try {
      const plantIds = selectedPlants.map((p) => p.id)
      const payload = {
        title: formData.title,
        description: formData.description,
        location: formData.location,
        plantIds,
      }

      const url = isEditMode
        ? `/api/workorders/${workOrderId}`
        : "/api/workorders"
      const method = isEditMode ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const data = await response.json()
        onOpenChange(false)
        if (isEditMode) {
          router.refresh()
        } else {
          router.push(`/workorders/${data.workOrder.id}`)
        }
      } else {
        const error = await response.json()
        alert(error.error || `Failed to ${isEditMode ? "update" : "create"} work order`)
      }
    } catch (error) {
      alert(`Failed to ${isEditMode ? "update" : "create"} work order`)
    } finally {
      setLoading(false)
    }
  }

  const selectedOrg = orgs.find((o) => o.id === selectedOrgId)
  const unassignedCount = availablePlants.length
  const selectedCount = selectedPlants.length

  // Filter available plants based on search query
  const filteredAvailablePlants = useMemo(() => {
    if (!plantSearchQuery.trim()) {
      return availablePlants.filter(
        (p) => !selectedPlants.find((sp) => sp.id === p.id)
      )
    }
    const query = plantSearchQuery.toLowerCase()
    return availablePlants.filter(
      (p) =>
        !selectedPlants.find((sp) => sp.id === p.id) &&
        (p.name.toLowerCase().includes(query) ||
          p.vendor_plant_id.toLowerCase().includes(query))
    )
  }, [availablePlants, selectedPlants, plantSearchQuery])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {isEditMode
              ? `Edit Workorder for ${organizationName || selectedOrg?.name || "Organization"}`
              : "Create Workorder"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-semibold">
              Workorder Title *
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
              placeholder="Enter workorder title"
              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organization" className="text-sm font-semibold">
              Organization *
            </Label>
            <Select
              value={selectedOrgId?.toString() || ""}
              onValueChange={(value) => {
                setSelectedOrgId(parseInt(value))
                setSelectedPlants([]) // Reset selection when org changes
                setPlantsFetched(false) // Allow fetching plants for new org
                setPlantSearchQuery("") // Reset search
              }}
              disabled={isEditMode}
            >
              <SelectTrigger 
                id="organization"
                className="transition-all duration-200 hover:border-primary/50"
              >
                <SelectValue placeholder="Select an organization" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((org) => (
                  <SelectItem 
                    key={org.id} 
                    value={org.id.toString()}
                    className="cursor-pointer transition-colors hover:bg-primary/10"
                  >
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedOrgId && (
            <div className="flex-1 flex flex-col min-h-0 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Select Plants</Label>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-primary">{selectedCount}</span> selected of{" "}
                  <span className="font-medium">{unassignedCount}</span> available
                </div>
              </div>

              {fetchingPlants ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  {/* Search and Available Plants List */}
                  {availablePlants.length > 0 && (
                    <div className="flex-1 flex flex-col min-h-0 border rounded-lg bg-muted/30">
                      <div className="p-3 border-b bg-background/50">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search plants..."
                            value={plantSearchQuery}
                            onChange={(e) => setPlantSearchQuery(e.target.value)}
                            className="pl-9 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {filteredAvailablePlants.length === 0 ? (
                          <div className="text-center text-muted-foreground py-8">
                            {plantSearchQuery
                              ? "No plants found matching your search"
                              : "All available plants have been selected"}
                          </div>
                        ) : (
                          filteredAvailablePlants.map((plant) => {
                            const status = getPlantStatus(plant)
                            const isSelected = selectedPlants.some((sp) => sp.id === plant.id)
                            
                            return (
                              <div
                                key={plant.id}
                                onClick={() => {
                                  if (!isSelected) {
                                    handleAddPlant(plant)
                                  } else {
                                    handleRemovePlant(plant.id)
                                  }
                                }}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200",
                                  "hover:bg-primary/5 hover:border-primary/30 hover:shadow-sm",
                                  isSelected && "bg-primary/10 border-primary/50 shadow-sm",
                                  "active:scale-[0.98]"
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-[80px]">
                                  <Circle
                                    className={cn(
                                      "h-3 w-3 transition-colors",
                                      status === "online"
                                        ? "fill-green-500 text-green-500"
                                        : "fill-red-500 text-red-500"
                                    )}
                                  />
                                  <Badge
                                    variant={
                                      status === "online" ? "default" : "destructive"
                                    }
                                    className="text-xs px-2 py-0.5"
                                  >
                                    {status}
                                  </Badge>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">
                                    {plant.vendor_plant_id} - {plant.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {plant.capacity_kw} kW
                                    {plant.vendors && ` • ${plant.vendors.name}`}
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="flex-shrink-0">
                                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center animate-in fade-in zoom-in duration-200">
                                      <Check className="h-3 w-3 text-primary-foreground" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {/* Selected Plants Summary */}
                  {selectedPlants.length > 0 && (
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-sm font-semibold">
                          Selected Plants ({selectedCount})
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPlants([])}
                          className="text-xs h-7"
                        >
                          Clear All
                        </Button>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-3 bg-muted/20">
                        {selectedPlants.map((plant) => {
                          const status = getPlantStatus(plant)
                          const plantIdentifier = `${plant.vendor_plant_id} - ${plant.name}`

                          return (
                            <div
                              key={plant.id}
                              className="flex items-center justify-between p-2 rounded-lg border bg-background hover:bg-muted/50 transition-all duration-200 group"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <Circle
                                    className={cn(
                                      "h-3 w-3 transition-colors",
                                      status === "online"
                                        ? "fill-green-500 text-green-500"
                                        : "fill-red-500 text-red-500"
                                    )}
                                  />
                                  <Badge
                                    variant={
                                      status === "online" ? "default" : "destructive"
                                    }
                                    className="text-xs"
                                  >
                                    {status}
                                  </Badge>
                                </div>
                                <span className="text-sm font-medium truncate">
                                  {plantIdentifier}
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemovePlant(plant.id)
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm font-semibold">
              Location
            </Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              placeholder="Enter location"
              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="transition-all duration-200 hover:scale-105"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || selectedPlants.length === 0}
              className="transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isEditMode ? "Updating..." : "Creating..."}
                </span>
              ) : (
                isEditMode ? "Update Workorder" : "Create Workorder"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

