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
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div>
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) =>
            setFormData({ ...formData, title: e.target.value })
          }
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          rows={4}
        />
      </div>

      <div>
        <Label htmlFor="organization">Organization *</Label>
        <Select
          value={selectedOrgId?.toString() || ""}
          onValueChange={(value) => {
            setSelectedOrgId(parseInt(value))
            setSelectedPlantIds([]) // Reset plant selection when org changes
          }}
        >
          <SelectTrigger id="organization">
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

      <div className="flex space-x-4">
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Work Order"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

