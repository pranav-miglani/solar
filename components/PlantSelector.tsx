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
  isActive?: boolean
}

interface PlantSelectorProps {
  orgIds: number[]
  selectedPlantIds: number[]
  onSelectionChange: (plantIds: number[]) => void
  assignedEngineer?: string
}

export function PlantSelector({
  orgIds,
  selectedPlantIds,
  onSelectionChange,
  assignedEngineer,
}: PlantSelectorProps) {
  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const [activePlantIds, setActivePlantIds] = useState<number[]>([])

  useEffect(() => {
    async function fetchPlants() {
      if (orgIds.length === 0) {
        setPlants([])
        setLoading(false)
        return
      }

      const supabase = createClient()

      // Fetch plants for selected orgs
      const { data: plantsData, error: plantsError } = await supabase
        .from("plants")
        .select("*")
        .in("org_id", orgIds)

      if (plantsError) {
        console.error("Error fetching plants:", plantsError)
        setLoading(false)
        return
      }

      // Fetch active work order plants to disable them
      const { data: activeWOP, error: activeError } = await supabase
        .from("work_order_plants")
        .select("plant_id")
        .eq("is_active", true)

      if (activeError) {
        console.error("Error fetching active work orders:", activeError)
      } else {
        setActivePlantIds(activeWOP?.map((p) => p.plant_id) || [])
      }

      setPlants(plantsData || [])
      setLoading(false)
    }

    fetchPlants()
  }, [orgIds])

  const handleToggle = (plantId: number) => {
    if (activePlantIds.includes(plantId)) {
      return // Don't allow selection of active plants
    }

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
          const isActive = activePlantIds.includes(plant.id)
          const isSelected = selectedPlantIds.includes(plant.id)

          return (
            <div
              key={plant.id}
              className={`flex items-center space-x-2 p-2 rounded border ${
                isActive ? "opacity-50 cursor-not-allowed bg-muted" : "cursor-pointer hover:bg-muted"
              }`}
              onClick={() => !isActive && handleToggle(plant.id)}
            >
              <Checkbox
                id={`plant-${plant.id}`}
                checked={isSelected}
                disabled={isActive}
                onCheckedChange={() => handleToggle(plant.id)}
              />
              <Label
                htmlFor={`plant-${plant.id}`}
                className="flex-1 cursor-pointer"
              >
                <div className="font-medium">{plant.name}</div>
                <div className="text-sm text-muted-foreground">
                  {plant.capacity_kw} kW
                  {isActive && " (Active in another work order)"}
                </div>
              </Label>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

