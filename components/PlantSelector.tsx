"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

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

  useEffect(() => {
    async function fetchPlants() {
      if (orgIds.length === 0) {
        setPlants([])
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        // Fetch only unassigned plants (not in any active work order)
        const orgIdsParam = orgIds.join(",")
        const response = await fetch(`/api/plants/unassigned?orgIds=${orgIdsParam}`)
        
        if (!response.ok) {
          throw new Error("Failed to fetch unassigned plants")
        }

        const data = await response.json()
        setPlants(data.plants || [])
      } catch (error) {
        console.error("Error fetching unassigned plants:", error)
        setPlants([])
      } finally {
        setLoading(false)
      }
    }

    fetchPlants()
  }, [orgIds])

  const handleToggle = (plantId: number) => {
    const newSelection = selectedPlantIds.includes(plantId)
      ? selectedPlantIds.filter((id) => id !== plantId)
      : [...selectedPlantIds, plantId]

    onSelectionChange(newSelection)
  }

  if (loading) {
    return <div>Loading plants...</div>
  }

  if (plants.length === 0) {
    return <div className="text-muted-foreground">No plants available for selected organizations.</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Plants</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-96 overflow-y-auto">
        {plants.map((plant) => {
          const isSelected = selectedPlantIds.includes(plant.id)

          return (
            <div
              key={plant.id}
              className="flex items-center space-x-2 p-2 rounded border cursor-pointer hover:bg-muted"
              onClick={() => handleToggle(plant.id)}
            >
              <Checkbox
                id={`plant-${plant.id}`}
                checked={isSelected}
                onCheckedChange={() => handleToggle(plant.id)}
              />
              <Label
                htmlFor={`plant-${plant.id}`}
                className="flex-1 cursor-pointer"
              >
                <div className="font-medium">{plant.name}</div>
                <div className="text-sm text-muted-foreground">
                  {plant.capacity_kw} kW
                  {plant.vendors && ` • ${plant.vendors.name} (${plant.vendors.vendor_type})`}
                </div>
              </Label>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

