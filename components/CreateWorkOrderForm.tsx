"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlantSelector } from "@/components/PlantSelector"

interface Org {
  id: number
  name: string
}

export function CreateWorkOrderForm() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  const [selectedPlantIds, setSelectedPlantIds] = useState<number[]>([])
  const [formData, setFormData] = useState({
    title: "",
    description: "",
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchOrgs()
  }, [])

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    if (!selectedOrgId) {
      alert("Please select an organization")
      setLoading(false)
      return
    }

    if (selectedPlantIds.length === 0) {
      alert("Please select at least one plant")
      setLoading(false)
      return
    }

    try {
      const response = await fetch("/api/workorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          plantIds: selectedPlantIds,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        router.push(`/workorders/${data.workOrder.id}`)
      } else {
        const error = await response.json()
        alert(error.error || "Failed to create work order")
      }
    } catch (error) {
      alert("Failed to create work order")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-card border rounded-lg shadow-sm p-6 md:p-8">
      <form onSubmit={handleSubmit} className="space-y-6 w-full">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm font-semibold">Title *</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            required
            placeholder="Enter work order title"
            className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-semibold">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            rows={4}
            placeholder="Enter work order description (optional)"
            className="transition-all duration-200 focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="organization" className="text-sm font-semibold">Organization *</Label>
          <Select
            value={selectedOrgId?.toString() || ""}
            onValueChange={(value) => {
              setSelectedOrgId(parseInt(value))
              setSelectedPlantIds([]) // Reset plant selection when org changes
            }}
          >
            <SelectTrigger id="organization" className="transition-all duration-200 focus:ring-2 focus:ring-primary/20">
              <SelectValue placeholder="Select an organization" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((org) => (
                <SelectItem key={org.id} value={org.id.toString()}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground mt-1">
            Work orders can only contain plants from a single organization
          </p>
        </div>

        {selectedOrgId && (
          <div className="space-y-2">
            <PlantSelector
              orgIds={[selectedOrgId]}
              selectedPlantIds={selectedPlantIds}
              onSelectionChange={setSelectedPlantIds}
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button 
            type="submit" 
            disabled={loading || selectedPlantIds.length === 0}
            className="w-full sm:w-auto transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creating...
              </span>
            ) : (
              "Create Work Order"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="w-full sm:w-auto transition-all duration-200 hover:scale-105"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

