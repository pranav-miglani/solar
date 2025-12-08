"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2 } from "lucide-react"

interface Plant {
  id: number
  org_id: number
  vendor_id: number
  vendor_plant_id: string
  plant_name: string | null
  organizations?: {
    id: number
    name: string
  }
  vendors?: {
    id: number
    name: string
    vendor_type: string
  }
}

interface AnalyticsPlantsListProps {
  vendorId?: number
}

export function AnalyticsPlantsList({ vendorId }: AnalyticsPlantsListProps) {
  const router = useRouter()
  const [plants, setPlants] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPlants()
  }, [vendorId])

  async function fetchPlants() {
    try {
      setLoading(true)
      const url = vendorId
        ? `/api/analytics/plants?vendorId=${vendorId}`
        : "/api/analytics/plants"
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setPlants(data.plants || [])
      }
    } catch (error) {
      console.error("Failed to fetch plants:", error)
    } finally {
      setLoading(false)
    }
  }

  // Group plants by org -> vendor
  const groupedPlants = new Map<number, Map<number, Plant[]>>()
  for (const plant of plants) {
    if (!groupedPlants.has(plant.org_id)) {
      groupedPlants.set(plant.org_id, new Map())
    }
    const orgMap = groupedPlants.get(plant.org_id)!
    if (!orgMap.has(plant.vendor_id)) {
      orgMap.set(plant.vendor_id, [])
    }
    orgMap.get(plant.vendor_id)!.push(plant)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          {Array.from(groupedPlants.entries()).map(([orgId, vendorMap]) => {
            const firstPlant = Array.from(vendorMap.values())[0]?.[0]
            const orgName = firstPlant?.organizations?.name || `Org ${orgId}`
            return (
              <div key={orgId} className="space-y-4">
                <h2 className="text-xl font-semibold">{orgName}</h2>
                {Array.from(vendorMap.entries()).map(([vendorId, vendorPlants]) => {
                  const vendorName = vendorPlants[0]?.vendors?.name || `Vendor ${vendorId}`
                  const vendorType = vendorPlants[0]?.vendors?.vendor_type || "UNKNOWN"
                  return (
                    <div key={vendorId} className="ml-4 space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-medium">{vendorName}</h3>
                        <Badge variant="outline">{vendorType}</Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ml-4">
                        {vendorPlants.map((plant) => (
                          <Card
                            key={plant.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => router.push(`/analytics/plants/${plant.id}`)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                <div>
                                  <div className="font-medium">{plant.plant_name || `Plant ${plant.id}`}</div>
                                  <div className="text-sm text-muted-foreground">{plant.vendor_plant_id}</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {plants.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No plants found
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

