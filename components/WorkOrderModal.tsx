"use client"

import { useState, useEffect } from "react"
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
import { PlantSelector } from "@/components/PlantSelector"

interface Org {
  id: number
  name: string
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
  const [selectedPlantIds, setSelectedPlantIds] = useState<number[]>([])
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    location: "",
  })
  const [loading, setLoading] = useState(false)

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
      setSelectedPlantIds([])
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
          
          // Set selected plant IDs
          const plantIds = wo.work_order_plants
            ?.filter((wop: any) => wop.is_active)
            .map((wop: any) => wop.plants.id) || []
          setSelectedPlantIds(plantIds)
        }
      }
    } catch (error) {
      console.error("Error fetching work order:", error)
    }
  }


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedOrgId) {
      alert("Please select an organization")
      return
    }

    if (selectedPlantIds.length === 0) {
      alert("Please select at least one plant")
      return
    }

    setLoading(true)

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        location: formData.location,
        plantIds: selectedPlantIds,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col p-0 mx-4">
        <DialogHeader className="border-b pb-4 px-4 md:px-6 pt-4 md:pt-6 pr-12 md:pr-16">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <DialogTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent flex-1 min-w-0">
              <span className="block sm:inline">
                {isEditMode
                  ? `Edit Workorder for ${organizationName || selectedOrg?.name || "Organization"}`
                  : "Create Workorder"}
              </span>
            </DialogTitle>
            <div className="flex items-center gap-4 sm:mr-8">
              <Button 
                type="submit"
                form="workorder-form"
                disabled={loading || selectedPlantIds.length === 0}
                className="w-full sm:w-auto transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl text-sm sm:text-base"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {isEditMode ? (
                      <>
                        <span className="hidden sm:inline">Updating...</span>
                        <span className="sm:hidden">Updating</span>
                      </>
                    ) : (
                      "Creating..."
                    )}
                  </span>
                ) : (
                  <>
                    {isEditMode ? (
                      <>
                        <span className="hidden sm:inline">Update Workorder</span>
                        <span className="sm:hidden">Update</span>
                      </>
                    ) : (
                      "Create Workorder"
                    )}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <form id="workorder-form" onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-4 md:space-y-6 px-4 md:px-6 py-4">
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
              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20 bg-background"
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
                setSelectedPlantIds([]) // Reset selection when org changes
              }}
              disabled={isEditMode}
            >
              <SelectTrigger 
                id="organization"
                className="w-full transition-all duration-200 hover:border-primary/50 hover:shadow-sm bg-background text-foreground"
              >
                <SelectValue placeholder="Select an organization" />
              </SelectTrigger>
              <SelectContent 
                className="bg-background border-2 border-border shadow-xl z-[9999] max-h-[300px]"
                position="popper"
              >
                {orgs.map((org) => (
                  <SelectItem 
                    key={org.id} 
                    value={org.id.toString()}
                    className="cursor-pointer transition-all duration-150 hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary text-foreground font-medium"
                  >
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedOrgId && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <PlantSelector
                orgIds={[selectedOrgId]}
                selectedPlantIds={selectedPlantIds}
                onSelectionChange={setSelectedPlantIds}
                includeSelectedInList={isEditMode}
              />
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
              className="transition-all duration-200 focus:ring-2 focus:ring-primary/20 bg-background"
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t px-4 md:px-6 pb-4 md:pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="w-full sm:w-auto transition-all duration-200 hover:scale-105"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

