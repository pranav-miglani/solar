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
}

export function PlantSelector({
  orgIds,
  selectedPlantIds,
  onSelectionChange,
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
      if (fetchedOrgIdsRef.current === orgIdsKey && plantsFetched) {
        return
      }

      setLoading(true)

      try {
        // Fetch only unassigned plants (not in any active work order)
        const response = await fetch(`/api/plants/unassigned?orgIds=${orgIdsKey}`)
        
        if (!response.ok) {
          throw new Error("Failed to fetch unassigned plants")
        }

        const data = await response.json()
        setPlants(data.plants || [])
        setPlantsFetched(true)
        fetchedOrgIdsRef.current = orgIdsKey
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
  }, [orgIdsKey])

  // Filter plants based on search query
  const filteredPlants = useMemo(() => {
    if (!searchQuery.trim()) {
      return plants
    }
    const query = searchQuery.toLowerCase()
    return plants.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.vendor_plant_id.toLowerCase().includes(query)
    )
  }, [plants, searchQuery])

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
    <Card className="shadow-lg border-2">
      <CardHeader className="border-b bg-gradient-to-r from-muted/50 to-muted/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">Select Plants</CardTitle>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-primary">{selectedPlantIds.length}</span> selected
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Search Bar */}
        <div className="p-4 border-b bg-background/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search plants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 transition-all duration-200 focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Plants List */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-2">
          {filteredPlants.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchQuery ? "No plants found matching your search" : "No plants available"}
            </div>
          ) : (
            filteredPlants.map((plant) => {
              const isSelected = selectedPlantIds.includes(plant.id)

              return (
                <div
                  key={plant.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-all duration-200",
                    "hover:bg-primary/5 hover:border-primary/30 hover:shadow-sm",
                    isSelected && "bg-primary/10 border-primary/50 shadow-sm"
                  )}
                >
                  <Checkbox
                    id={`plant-${plant.id}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      // Directly update state without calling handleToggle to avoid loops
                      if (checked) {
                        if (!selectedPlantIds.includes(plant.id)) {
                          onSelectionChange([...selectedPlantIds, plant.id])
                        }
                      } else {
                        onSelectionChange(selectedPlantIds.filter((id) => id !== plant.id))
                      }
                    }}
                    className="transition-all duration-200"
                  />
                  <Label
                    htmlFor={`plant-${plant.id}`}
                    className="flex-1 cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault()
                      // Toggle when clicking label
                      if (isSelected) {
                        onSelectionChange(selectedPlantIds.filter((id) => id !== plant.id))
                      } else {
                        onSelectionChange([...selectedPlantIds, plant.id])
                      }
                    }}
                  >
                    <div className="font-medium text-sm">{plant.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {plant.capacity_kw} kW
                      {plant.vendors && ` • ${plant.vendors.name} (${plant.vendors.vendor_type})`}
                    </div>
                  </Label>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}

