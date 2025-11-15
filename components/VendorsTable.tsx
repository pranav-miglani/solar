"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Loader2 } from "lucide-react"

interface Organization {
  id: number
  name: string
}

interface Vendor {
  id: number
  name: string
  vendor_type: string
  api_base_url: string
  credentials: Record<string, any>
  is_active: boolean
  org_id?: number
  organizations?: {
    id: number
    name: string
  }
}

export function VendorsTable() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [syncingVendorId, setSyncingVendorId] = useState<number | null>(null)
  const [syncProgress, setSyncProgress] = useState<{
    current: number
    total: number
  } | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    vendor_type: "SOLARMAN",
    api_base_url: "",
    org_id: "",
    appId: "",
    appSecret: "",
    username: "",
    passwordSha256: "",
    solarmanOrgId: "", // Optional Solarman orgId (not our organization ID)
    is_active: true,
  })

  useEffect(() => {
    fetchVendors()
    fetchOrgs()
  }, [])

  async function fetchOrgs() {
    try {
      const response = await fetch("/api/orgs")
      const data = await response.json()
      setOrgs(data.orgs || [])
    } catch (error) {
      console.error("Error fetching orgs:", error)
    }
  }

  async function fetchVendors() {
    const response = await fetch("/api/vendors")
    const data = await response.json()
    setVendors(data.vendors || [])
    setLoading(false)
  }

  function openDialog(vendor?: Vendor) {
    if (vendor) {
      setEditingVendor(vendor)
      setFormData({
        name: vendor.name,
        vendor_type: vendor.vendor_type || "SOLARMAN",
        api_base_url: vendor.api_base_url,
        org_id: vendor.org_id?.toString() || "",
        appId: vendor.credentials.appId || "",
        appSecret: vendor.credentials.appSecret || "",
        username: vendor.credentials.username || "",
        passwordSha256: vendor.credentials.passwordSha256 || "",
        solarmanOrgId: vendor.credentials.orgId?.toString() || "",
        is_active: vendor.is_active,
      })
    } else {
      setEditingVendor(null)
      setFormData({
        name: "",
        vendor_type: "SOLARMAN",
        api_base_url: "",
        org_id: "",
        appId: "",
        appSecret: "",
        username: "",
        passwordSha256: "",
        solarmanOrgId: "",
        is_active: true,
      })
    }
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.org_id) {
      alert("Please select an organization")
      return
    }

    const credentials: any = {
      appId: formData.appId,
      appSecret: formData.appSecret,
      username: formData.username,
      passwordSha256: formData.passwordSha256,
    }

    // Add Solarman orgId if provided (for org-scoped login)
    if (formData.solarmanOrgId && formData.solarmanOrgId.trim() !== "") {
      const orgIdNum = parseInt(formData.solarmanOrgId)
      if (!isNaN(orgIdNum)) {
        credentials.orgId = orgIdNum
      }
    }

    const url = editingVendor
      ? `/api/vendors/${editingVendor.id}`
      : "/api/vendors"
    const method = editingVendor ? "PUT" : "POST"

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.name,
        vendor_type: formData.vendor_type,
        api_base_url: formData.api_base_url,
        org_id: parseInt(formData.org_id),
        credentials,
        is_active: formData.is_active,
      }),
    })

    if (response.ok) {
      setDialogOpen(false)
      fetchVendors()
    } else {
      const error = await response.json()
      alert(error.error || "Failed to save vendor")
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this vendor?")) return

    const response = await fetch(`/api/vendors/${id}`, {
      method: "DELETE",
    })

    if (response.ok) {
      fetchVendors()
    } else {
      const error = await response.json()
      alert(error.error || "Failed to delete vendor")
    }
  }

  async function handleSyncPlants(vendorId: number) {
    if (!confirm("This will fetch all plants from the vendor and sync them to the database. Continue?")) {
      return
    }
    console.log("Syncing plants for vendor:", vendorId);
    setSyncingVendorId(vendorId)
    setSyncProgress({ current: 0, total: 0 })

    try {
      const response = await fetch(`/api/vendors/${vendorId}/sync-plants`, {
        method: "POST",
      })

      const data = await response.json()

      if (response.ok) {
        setSyncProgress({ current: data.synced, total: data.total })
        setTimeout(() => {
          alert(`Successfully synced ${data.synced} plants (${data.created} created, ${data.updated} updated)`)
          setSyncingVendorId(null)
          setSyncProgress(null)
        }, 500)
      } else {
        alert(data.error || "Failed to sync plants")
        setSyncingVendorId(null)
        setSyncProgress(null)
      }
    } catch (error: any) {
      alert(`Error syncing plants: ${error.message}`)
      setSyncingVendorId(null)
      setSyncProgress(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading vendors...</span>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>Add Vendor</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingVendor ? "Edit Vendor" : "Add Vendor"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="vendor_type">Vendor Type *</Label>
                <Select
                  value={formData.vendor_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, vendor_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SOLARMAN">Solarman</SelectItem>
                    <SelectItem value="SUNGROW">Sungrow</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="org_id">Organization *</Label>
                {orgs.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-2 border rounded">
                    No organizations available. Please create an organization first.
                  </div>
                ) : (
                  <Select
                    value={formData.org_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, org_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgs.map((org) => (
                        <SelectItem key={org.id} value={org.id.toString()}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div>
                <Label htmlFor="api_base_url">API Base URL *</Label>
                <Input
                  id="api_base_url"
                  value={formData.api_base_url}
                  onChange={(e) =>
                    setFormData({ ...formData, api_base_url: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="appId">App ID *</Label>
                <Input
                  id="appId"
                  value={formData.appId}
                  onChange={(e) =>
                    setFormData({ ...formData, appId: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="appSecret">App Secret *</Label>
                <Input
                  id="appSecret"
                  type="password"
                  value={formData.appSecret}
                  onChange={(e) =>
                    setFormData({ ...formData, appSecret: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="passwordSha256">Password (SHA256) *</Label>
                <Input
                  id="passwordSha256"
                  type="password"
                  value={formData.passwordSha256}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      passwordSha256: e.target.value,
                    })
                  }
                  required
                />
              </div>
              {formData.vendor_type === "SOLARMAN" && (
                <div>
                  <Label htmlFor="solarmanOrgId">
                    Solarman Org ID (Optional)
                  </Label>
                  <Input
                    id="solarmanOrgId"
                    type="number"
                    value={formData.solarmanOrgId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        solarmanOrgId: e.target.value,
                      })
                    }
                    placeholder="For org-scoped login (not your organization ID)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Optional: Solarman internal orgId for org-scoped authentication
                  </p>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>API URL</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendors.map((vendor) => (
            <TableRow key={vendor.id}>
              <TableCell>{vendor.name}</TableCell>
              <TableCell>{vendor.vendor_type}</TableCell>
              <TableCell>
                {vendor.organizations?.name || "N/A"}
              </TableCell>
              <TableCell className="font-mono text-sm">
                {vendor.api_base_url}
              </TableCell>
              <TableCell>
                {vendor.is_active ? (
                  <span className="text-green-600">Active</span>
                ) : (
                  <span className="text-gray-400">Inactive</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDialog(vendor)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleSyncPlants(vendor.id)}
                    disabled={syncingVendorId === vendor.id || !vendor.org_id}
                  >
                    {syncingVendorId === vendor.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      "Sync Plants"
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(vendor.id)}
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {vendors.length === 0 && !loading && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No vendors found. Click "Add Vendor" to create one.</p>
        </div>
      )}

      {syncingVendorId && syncProgress && (
        <div className="mt-4 p-4 border rounded-lg bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Syncing plants...</span>
            <span className="text-sm text-muted-foreground">
              {syncProgress.total > 0 
                ? `${syncProgress.current} / ${syncProgress.total}`
                : "Fetching plants..."}
            </span>
          </div>
          {syncProgress.total > 0 ? (
            <Progress
              value={syncProgress.current}
              max={syncProgress.total}
              className="h-2"
            />
          ) : (
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary animate-pulse" style={{ width: "50%" }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
