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
import { createClient } from "@/lib/supabase/client"

interface Org {
  id: number
  name: string
}

interface User {
  id: string
  email: string
}

export function CreateWorkOrderForm() {
  const router = useRouter()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [engineers, setEngineers] = useState<User[]>([])
  const [selectedOrgIds, setSelectedOrgIds] = useState<number[]>([])
  const [selectedPlantIds, setSelectedPlantIds] = useState<number[]>([])
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH",
    assignedEngineer: "",
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchOrgs()
    fetchEngineers()
  }, [])

  async function fetchOrgs() {
    try {
      const response = await fetch("/api/user-orgs/my-orgs")
      const data = await response.json()
      if (data.orgs) {
        setOrgs(data.orgs)
      }
    } catch (error) {
      console.error("Error fetching orgs:", error)
    }
  }

  async function fetchEngineers() {
    const response = await fetch("/api/users")
    const data = await response.json()
    const engineers = data.users?.filter(
      (u: any) => u.role === "ENGINEER"
    ) || []
    setEngineers(engineers)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch("/api/workorders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          orgIds: selectedOrgIds,
          plantIds: selectedPlantIds,
          assignedEngineer: formData.assignedEngineer || null,
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
        <Label htmlFor="priority">Priority</Label>
        <Select
          value={formData.priority}
          onValueChange={(value: "LOW" | "MEDIUM" | "HIGH") =>
            setFormData({ ...formData, priority: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Organizations *</Label>
        <div className="space-y-2 mt-2">
          {orgs.map((org) => (
            <div key={org.id} className="flex items-center space-x-2">
              <input
                type="checkbox"
                id={`org-${org.id}`}
                checked={selectedOrgIds.includes(org.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedOrgIds([...selectedOrgIds, org.id])
                  } else {
                    setSelectedOrgIds(
                      selectedOrgIds.filter((id) => id !== org.id)
                    )
                  }
                }}
              />
              <Label htmlFor={`org-${org.id}`} className="cursor-pointer">
                {org.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {selectedOrgIds.length > 0 && (
        <PlantSelector
          orgIds={selectedOrgIds}
          selectedPlantIds={selectedPlantIds}
          onSelectionChange={setSelectedPlantIds}
          assignedEngineer={formData.assignedEngineer}
        />
      )}

      {selectedPlantIds.length > 0 && (
        <div>
          <Label htmlFor="assignedEngineer">Assign Engineer</Label>
          <Select
            value={formData.assignedEngineer}
            onValueChange={(value) =>
              setFormData({ ...formData, assignedEngineer: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select engineer (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {engineers.map((engineer) => (
                <SelectItem key={engineer.id} value={engineer.id}>
                  {engineer.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

