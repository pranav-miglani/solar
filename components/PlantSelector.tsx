"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface Plant {
  id: number
  name: string
  capacity_kw: number
  vendor_plant_id: string
  vendor_id?: number
  vendors?: {
    id: number
    name: string
    vendor_type: string
  }
  isActive?: boolean
}

interface PlantSelectorProps {
  orgIds: number[]
  selectedPlantIds: number[]
  onSelectionChange: (plantIds: number[]) => void
  includeSelectedInList?: boolean // If true, fetch all plants including selected ones (for edit mode)
}

export function PlantSelector({
  orgIds,
  selectedPlantIds,
  onSelectionChange,
  includeSelectedInList = false,
}: PlantSelectorProps) {
  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [plantsFetched, setPlantsFetched] = useState(false)
  const fetchedOrgIdsRef = useRef<string>("")

  // Create a stable string key for orgIds to prevent unnecessary re-fetches
  const orgIdsKey = useMemo(() => {
    if (orgIds.length === 0) return ""
    return [...orgIds].sort().join(",")
  }, [orgIds])

  useEffect(() => {
    async function fetchPlants() {
      if (orgIds.length === 0) {
        setPlants([])
        setLoading(false)
        setPlantsFetched(false)
        fetchedOrgIdsRef.current = ""
        return
      }

      // Only fetch if we haven't fetched for these orgIds yet
      // In edit mode, we need to refetch when selectedPlantIds change
      const cacheKey = includeSelectedInList 
        ? `${orgIdsKey}-${selectedPlantIds.sort().join(',')}`
        : orgIdsKey
      
      if (fetchedOrgIdsRef.current === cacheKey && plantsFetched) {
        return
      }

      setLoading(true)

      try {
        // Fetch unassigned plants first
        const unassignedResponse = await fetch(`/api/plants/unassigned?orgIds=${orgIdsKey}`)
        
        if (!unassignedResponse.ok) {
          throw new Error("Failed to fetch unassigned plants")
        }

        const unassignedData = await unassignedResponse.json()
        let fetchedPlants = unassignedData.plants || []
        
        // If includeSelectedInList is true (edit mode), we need to also fetch selected plants
        // that are currently assigned to this work order
        if (includeSelectedInList && selectedPlantIds.length > 0) {
          try {
            // Fetch all plants for the org to get selected ones
            const allPlantsResponse = await fetch(`/api/orgs/${orgIds[0]}/plants`)
            if (allPlantsResponse.ok) {
              const allPlantsData = await allPlantsResponse.json()
              const allPlants = allPlantsData.plants || []
              
              console.log('[PlantSelector] Fetched all plants:', allPlants.length)
              console.log('[PlantSelector] Looking for selected plant IDs:', selectedPlantIds)
              
              // Get selected plants that are in the work order
              // Map to ensure we have the right structure (vendors might be nested differently)
              const selectedPlants = allPlants
                .filter((p: any) => {
                  const isSelected = selectedPlantIds.includes(p.id)
                  if (isSelected) {
                    console.log('[PlantSelector] Found selected plant:', p.id, p.name)
                  }
                  return isSelected
                })
                .map((p: any) => {
                  // Handle vendors structure - it might be an object or array
                  let vendors = p.vendors
                  if (Array.isArray(vendors) && vendors.length > 0) {
                    vendors = vendors[0]
                  } else if (!vendors && p.vendor_id) {
                    vendors = { id: p.vendor_id, name: 'Unknown', vendor_type: 'OTHER' }
                  }
                  
                  return {
                    id: p.id,
                    name: p.name,
                    capacity_kw: p.capacity_kw,
                    vendor_plant_id: p.vendor_plant_id,
                    vendor_id: p.vendor_id,
                    vendors: vendors,
                    isActive: p.isActive,
                  }
                })
              
              console.log('[PlantSelector] Mapped selected plants:', selectedPlants.length)
              
              // Merge selected plants with unassigned plants, avoiding duplicates
              // Put selected plants first to ensure they appear at the top
              const fetchedPlantIds = new Set(fetchedPlants.map((p: Plant) => p.id))
              const newSelectedPlants: Plant[] = []
              selectedPlants.forEach((plant: Plant) => {
                if (!fetchedPlantIds.has(plant.id)) {
                  newSelectedPlants.push(plant)
                } else {
                  console.log('[PlantSelector] Selected plant already in fetched list:', plant.id)
                }
              })
              // Prepend selected plants to the beginning of the array
              fetchedPlants = [...newSelectedPlants, ...fetchedPlants]
              console.log('[PlantSelector] Final plant count:', fetchedPlants.length, 'Selected:', newSelectedPlants.length)
            } else {
              console.error('[PlantSelector] Failed to fetch all plants:', allPlantsResponse.status)
            }
          } catch (error) {
            console.error('[PlantSelector] Error fetching selected plants:', error)
          }
        }
        
        setPlants(fetchedPlants)
        setPlantsFetched(true)
        fetchedOrgIdsRef.current = cacheKey
      } catch (error) {
        console.error("Error fetching unassigned plants:", error)
        setPlants([])
        setPlantsFetched(false)
      } finally {
        setLoading(false)
      }
    }

    fetchPlants()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgIdsKey, includeSelectedInList, includeSelectedInList ? selectedPlantIds.join(',') : ''])

  // Separate selected and unselected plants, then filter by search
  const { selectedPlants, unselectedPlants } = useMemo(() => {
    const selected: Plant[] = []
    const unselected: Plant[] = []
    
    plants.forEach((plant) => {
      if (selectedPlantIds.includes(plant.id)) {
        selected.push(plant)
      } else {
        unselected.push(plant)
      }
    })
    
    return { selectedPlants: selected, unselectedPlants: unselected }
  }, [plants, selectedPlantIds])

  // Filter plants based on search query
  const filteredSelected = useMemo(() => {
    if (!searchQuery.trim()) {
      return selectedPlants
    }
    const query = searchQuery.toLowerCase()
    return selectedPlants.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.vendor_plant_id.toLowerCase().includes(query)
    )
  }, [selectedPlants, searchQuery])

  const filteredUnselected = useMemo(() => {
    if (!searchQuery.trim()) {
      return unselectedPlants
    }
    const query = searchQuery.toLowerCase()
    return unselectedPlants.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.vendor_plant_id.toLowerCase().includes(query)
    )
  }, [unselectedPlants, searchQuery])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select Plants</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (plants.length === 0 && !loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select Plants</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No plants available for selected organizations.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-lg border-2 border-border w-full">
      <CardHeader className="border-b border-border bg-gradient-to-r from-muted/50 to-muted/30 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="text-base md:text-lg font-bold">Select Plants</CardTitle>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-primary">{selectedPlantIds.length}</span> selected
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Search Bar */}
        <div className="p-3 md:p-4 border-b border-border bg-background/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search plants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 transition-all duration-200 focus:ring-2 focus:ring-primary/20 text-sm md:text-base"
            />
          </div>
        </div>

        {/* Plants List */}
        <div className="max-h-64 md:max-h-96 overflow-y-auto p-3 md:p-4 space-y-2">
          {filteredSelected.length === 0 && filteredUnselected.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery ? "No plants found matching your search" : "No plants available"}
            </div>
          ) : (
            <>
              {/* Selected Plants Section */}
              {filteredSelected.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-semibold text-primary mb-2 px-1 uppercase tracking-wide">
                    Selected Plants ({filteredSelected.length})
                  </div>
                  <div className="space-y-2">
                    {filteredSelected.map((plant) => (
                      <div
                        key={plant.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 cursor-pointer",
                          "bg-primary/10 border-primary/50 dark:border-primary/60 shadow-sm",
                          "hover:bg-primary/15 hover:border-primary/60 dark:hover:border-primary/70"
                        )}
                        onClick={() => {
                          onSelectionChange(selectedPlantIds.filter((id) => id !== plant.id))
                        }}
                      >
                        <Checkbox
                          id={`plant-selected-${plant.id}`}
                          checked={true}
                          onCheckedChange={(checked) => {
                            if (!checked) {
                              onSelectionChange(selectedPlantIds.filter((id) => id !== plant.id))
                            }
                          }}
                          className="transition-all duration-200"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Label
                          htmlFor={`plant-selected-${plant.id}`}
                          className="flex-1 cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault()
                            onSelectionChange(selectedPlantIds.filter((id) => id !== plant.id))
                          }}
                        >
                          <div className="font-medium text-sm">{plant.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {plant.capacity_kw} kW
                            {plant.vendors && ` • ${plant.vendors.name} (${plant.vendors.vendor_type})`}
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Available Plants Section */}
              {filteredUnselected.length > 0 && (
                <div>
                  {filteredSelected.length > 0 && (
                    <div className="text-xs font-semibold text-muted-foreground mb-2 px-1 uppercase tracking-wide">
                      Available Plants ({filteredUnselected.length})
                    </div>
                  )}
                  <div className="space-y-2">
                    {filteredUnselected.map((plant) => (
                      <div
                        key={plant.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border border-border transition-all duration-200 cursor-pointer",
                          "hover:bg-primary/5 hover:border-primary/30 dark:hover:border-primary/40 hover:shadow-sm"
                        )}
                        onClick={() => {
                          onSelectionChange([...selectedPlantIds, plant.id])
                        }}
                      >
                        <Checkbox
                          id={`plant-${plant.id}`}
                          checked={false}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              onSelectionChange([...selectedPlantIds, plant.id])
                            }
                          }}
                          className="transition-all duration-200"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Label
                          htmlFor={`plant-${plant.id}`}
                          className="flex-1 cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault()
                            onSelectionChange([...selectedPlantIds, plant.id])
                          }}
                        >
                          <div className="font-medium text-sm">{plant.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {plant.capacity_kw} kW
                            {plant.vendors && ` • ${plant.vendors.name} (${plant.vendors.vendor_type})`}
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

