"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
import { Switch } from "@/components/ui/switch"
import { Loader2, Factory, Plus, Pencil, Trash2, RefreshCw, Building2, CheckCircle2, XCircle, Settings, Clock } from "lucide-react"

interface Organization {
  id: number
  name: string
}

interface Vendor {
  id: number
  name: string
  vendor_type: string
  // api_base_url removed - now stored in environment variables
  credentials: Record<string, any>
  is_active: boolean
  org_id?: number
  organizations?: {
    id: number
    name: string
    auto_sync_enabled?: boolean
    sync_interval_minutes?: number
  }
}

export function VendorsTable() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [syncingVendorId, setSyncingVendorId] = useState<number | null>(null)
  const [syncingAlertsVendorId, setSyncingAlertsVendorId] = useState<number | null>(null)
  const [deletingVendorId, setDeletingVendorId] = useState<number | null>(null)
  const [syncProgress, setSyncProgress] = useState<{
    current: number
    total: number
  } | null>(null)
  const [syncSettingsDialogOpen, setSyncSettingsDialogOpen] = useState(false)
  const [selectedOrgForSync, setSelectedOrgForSync] = useState<{ id: number, name: string } | null>(null)
  const [syncSettings, setSyncSettings] = useState<{ enabled: boolean, interval: number }>({ enabled: true, interval: 15 })
  const [formData, setFormData] = useState({
    name: "",
    vendor_type: "SOLARMAN",
    // api_base_url removed - now stored in environment variables
    org_id: "",
    appId: "",
    appSecret: "",
    username: "",
    passwordSha256: "",
    solarmanOrgId: "",
    is_active: true,
  })

  useEffect(() => {
    fetchVendors()
  }, [])

  async function fetchVendors() {
    try {
      const response = await fetch("/api/vendors")
      const data = await response.json()
      setVendors(data.vendors || [])
      setOrgs(data.orgs || [])
    } catch (error) {
      console.error("Error fetching vendors:", error)
    } finally {
      setLoading(false)
    }
  }
  
  function openSyncSettingsDialog(orgId: number, orgName: string) {
    // Find the org's current sync settings from vendors
    const vendor = vendors.find((v) => v.organizations?.id === orgId)
    if (vendor?.organizations) {
      setSyncSettings({
        enabled: vendor.organizations.auto_sync_enabled ?? true,
        interval: vendor.organizations.sync_interval_minutes ?? 15,
      })
    } else {
      setSyncSettings({ enabled: true, interval: 15 })
    }
    setSelectedOrgForSync({ id: orgId, name: orgName })
    setSyncSettingsDialogOpen(true)
  }
  
  async function saveSyncSettings() {
    if (!selectedOrgForSync) return
    
    try {
      const response = await fetch(`/api/orgs/${selectedOrgForSync.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auto_sync_enabled: syncSettings.enabled,
          sync_interval_minutes: syncSettings.interval,
        }),
      })

      if (response.ok) {
        setSyncSettingsDialogOpen(false)
        setSelectedOrgForSync(null)
        // Refresh vendors to get updated org data
        fetchVendors()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to update sync settings")
      }
    } catch (error: any) {
      alert(`Error updating sync settings: ${error.message}`)
    }
  }

  function openDialog(vendor?: Vendor) {
    if (vendor) {
      setEditingVendor(vendor)
      setFormData({
        name: vendor.name,
        vendor_type: vendor.vendor_type || "SOLARMAN",
        // api_base_url removed - now stored in environment variables
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
        // api_base_url removed - now stored in environment variables
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
          // api_base_url removed - now stored in environment variables
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
    const response = await fetch(`/api/vendors/${id}`, {
      method: "DELETE",
    })

    if (response.ok) {
      fetchVendors()
      setDeletingVendorId(null)
    } else {
      const error = await response.json()
      alert(error.error || "Failed to delete vendor")
    }
  }

  async function handleSyncPlants(vendorId: number) {
    setSyncingVendorId(vendorId)
    setSyncProgress({ current: 0, total: 0 })

    try {
      // Step 1: sync plants for this vendor
      const plantsResponse = await fetch(`/api/vendors/${vendorId}/sync-plants`, {
        method: "POST",
      })
      const plantsData = await plantsResponse.json()

      if (!plantsResponse.ok) {
        alert(plantsData.error || "Failed to sync plants")
        setSyncingVendorId(null)
        setSyncProgress(null)
        return
      }

      setSyncProgress({ current: plantsData.synced, total: plantsData.total })

      // Step 2: once plants are synced, trigger alert sync for the same vendor
      const alertsResponse = await fetch(`/api/vendors/${vendorId}/sync-alerts`, {
        method: "POST",
      })
      const alertsData = await alertsResponse.json()

      if (!alertsResponse.ok) {
        alert(
          `Plants synced (${plantsData.synced} plants, ${plantsData.created} created, ${plantsData.updated} updated), but alert sync failed: ${
            alertsData.error || "Unknown error"
          }`
        )
      } else {
        alert(
          `Successfully synced ${plantsData.synced} plants (${plantsData.created} created, ${plantsData.updated} updated)\n` +
            `and ${alertsData.synced} alerts (${alertsData.created} created, ${alertsData.updated} updated).`
        )
      }

      setSyncingVendorId(null)
      setSyncProgress(null)
    } catch (error: any) {
      alert(`Error syncing plants/alerts: ${error.message}`)
      setSyncingVendorId(null)
      setSyncProgress(null)
    }
  }

  async function handleSyncAlerts(vendorId: number) {
    setSyncingAlertsVendorId(vendorId)
    try {
      const response = await fetch(`/api/vendors/${vendorId}/sync-alerts`, {
        method: "POST",
      })
      const data = await response.json()

      if (response.ok) {
        alert(
          `Alert sync completed for vendor ${data.vendorName || vendorId}.\n` +
            `Alerts synced: ${data.synced} (${data.created} created, ${data.updated} updated).`
        )
      } else {
        alert(data.error || "Failed to sync alerts")
      }
    } catch (error: any) {
      alert(`Error syncing alerts: ${error.message}`)
    } finally {
      setSyncingAlertsVendorId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading vendors...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => openDialog()}
                className="w-full sm:w-auto transition-all duration-200 hover:scale-105 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg hover:shadow-xl"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Vendor
              </Button>
            </motion.div>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
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
                  className="mt-1"
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
                  <SelectTrigger className="mt-1">
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
                  <div className="text-sm text-muted-foreground p-2 border rounded mt-1">
                    No organizations available. Please create an organization first.
                  </div>
                ) : (
                  <Select
                    value={formData.org_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, org_id: value })
                    }
                  >
                    <SelectTrigger className="mt-1">
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
              {/* API Base URL removed from UI - configured via environment variables */}
              <div>
                <Label htmlFor="appId">App ID *</Label>
                <Input
                  id="appId"
                  value={formData.appId}
                  onChange={(e) =>
                    setFormData({ ...formData, appId: e.target.value })
                  }
                  required
                  className="mt-1"
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
                  className="mt-1"
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
                  className="mt-1"
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
                  className="mt-1"
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
                    className="mt-1"
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
                  className="h-4 w-4"
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                >
                  Save
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block border rounded-lg overflow-hidden shadow-sm bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gradient-to-r from-muted/50 to-muted/30 border-b-2">
              <TableRow className="hover:bg-muted/50">
                <TableHead className="font-bold text-base">Name</TableHead>
                <TableHead className="font-bold text-base">Type</TableHead>
                <TableHead className="font-bold text-base">Organization</TableHead>
                <TableHead className="font-bold text-base">Status</TableHead>
                <TableHead className="font-bold text-base text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <Factory className="h-12 w-12 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground font-medium">
                        No vendors found
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Click &quot;Add Vendor&quot; to create your first vendor integration
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                vendors.map((vendor, index) => (
                  <TableRow
                    key={vendor.id}
                    className="border-b hover:bg-gradient-to-r hover:from-primary/5 hover:to-primary/10 transition-all duration-200 animate-in"
                    style={{
                      animationDelay: `${index * 50}ms`
                    }}
                  >
                    <TableCell className="font-semibold text-base py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 p-2.5">
                          <Factory className="h-full w-full text-white" />
                        </div>
                        {vendor.name}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className="font-medium">
                        {vendor.vendor_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{vendor.organizations?.name || "N/A"}</span>
                      </div>
                    </TableCell>
                    {/* API Base URL column removed - configured via environment variables */}
                    <TableCell className="py-4">
                      {vendor.is_active ? (
                        <Badge className="bg-green-500 hover:bg-green-600 text-white">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDialog(vendor)}
                            className="transition-all duration-200 hover:scale-110 hover:bg-primary/10"
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </motion.div>
                        {vendor.organizations && (
                          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openSyncSettingsDialog(vendor.organizations!.id, vendor.organizations!.name)}
                              className="transition-all duration-200 hover:scale-110 hover:bg-primary/10"
                              title="Sync Settings"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        )}
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleSyncPlants(vendor.id)}
                            disabled={syncingVendorId === vendor.id || !vendor.org_id}
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
                          >
                            {syncingVendorId === vendor.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Syncing...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Plants
                              </>
                            )}
                          </Button>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSyncAlerts(vendor.id)}
                            disabled={syncingAlertsVendorId === vendor.id}
                            className="transition-all duration-200 hover:scale-110 hover:bg-primary/10"
                          >
                            {syncingAlertsVendorId === vendor.id ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Alerts...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Alerts
                              </>
                            )}
                          </Button>
                        </motion.div>
                        <AlertDialog open={deletingVendorId === vendor.id} onOpenChange={(open: boolean) => !open && setDeletingVendorId(null)}>
                          <AlertDialogTrigger asChild>
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeletingVendorId(vendor.id)}
                                className="transition-all duration-200 hover:scale-110 hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </motion.div>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete &quot;{vendor.name}&quot;? This action cannot be undone and will remove all associated plants.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(vendor.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {vendors.length === 0 ? (
          <Card className="p-8 text-center">
            <Factory className="h-12 w-12 text-muted-foreground opacity-50 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium mb-2">
              No vendors found
            </p>
            <p className="text-sm text-muted-foreground">
              Click &quot;Add Vendor&quot; to create your first vendor integration
            </p>
          </Card>
        ) : (
          vendors.map((vendor, index) => (
            <motion.div
              key={vendor.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="p-4 border-2 hover:shadow-lg transition-all duration-200">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 p-3 flex-shrink-0">
                        <Factory className="h-full w-full text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg truncate">{vendor.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {vendor.vendor_type}
                          </Badge>
                          {vendor.is_active ? (
                            <Badge className="bg-green-500 text-white text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <XCircle className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm border-t pt-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">Organization:</span>
                      <span className="font-medium">{vendor.organizations?.name || "N/A"}</span>
                    </div>
                    {/* API Base URL removed from mobile view - configured via environment variables */}
                  </div>
                  <div className="flex flex-col gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDialog(vendor)}
                      className="w-full"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleSyncPlants(vendor.id)}
                      disabled={syncingVendorId === vendor.id || !vendor.org_id}
                      className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white disabled:opacity-50"
                    >
                      {syncingVendorId === vendor.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Plants
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSyncAlerts(vendor.id)}
                      disabled={syncingAlertsVendorId === vendor.id}
                      className="w-full"
                    >
                      {syncingAlertsVendorId === vendor.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Alerts...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Alerts
                        </>
                      )}
                    </Button>
                    {vendor.organizations && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openSyncSettingsDialog(vendor.organizations!.id, vendor.organizations!.name)}
                        className="w-full"
                        title="Sync Settings"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Sync Settings
                      </Button>
                    )}
                    <AlertDialog open={deletingVendorId === vendor.id} onOpenChange={(open: boolean) => !open && setDeletingVendorId(null)}>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingVendorId(vendor.id)}
                          className="w-full hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete &quot;{vendor.name}&quot;? This action cannot be undone and will remove all associated plants.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(vendor.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Sync Progress */}
      {syncingVendorId && syncProgress && (
        <Card className="p-4 border-2 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-semibold">Syncing plants...</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {syncProgress.total > 0 
                ? `${syncProgress.current} / ${syncProgress.total}`
                : "Fetching plants..."}
            </span>
          </div>
          {syncProgress.total > 0 ? (
            <Progress
              value={(syncProgress.current / syncProgress.total) * 100}
              className="h-2"
            />
          ) : (
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary animate-pulse" style={{ width: "50%" }} />
            </div>
          )}
        </Card>
      )}

      {/* Sync Settings Dialog */}
      <Dialog open={syncSettingsDialogOpen} onOpenChange={setSyncSettingsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              Auto-Sync Settings
            </DialogTitle>
          </DialogHeader>
          {selectedOrgForSync && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Building2 className="h-5 w-5 text-primary" />
                <span className="font-semibold">{selectedOrgForSync.name}</span>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sync-enabled" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Enable Auto-Sync
                  </Label>
                  <Switch
                    id="sync-enabled"
                    checked={syncSettings.enabled}
                    onCheckedChange={(checked) => {
                      setSyncSettings((prev) => ({ ...prev, enabled: checked }))
                    }}
                  />
                </div>
                {syncSettings.enabled && (
                  <div className="space-y-2">
                    <Label htmlFor="sync-interval">Sync Interval (minutes)</Label>
                    <Input
                      id="sync-interval"
                      type="number"
                      min="1"
                      max="1440"
                      value={syncSettings.interval}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 15
                        setSyncSettings((prev) => ({
                          ...prev,
                          interval: Math.max(1, Math.min(1440, value)),
                        }))
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Sync runs at fixed clock times. For 15 min: :00, :15, :30, :45
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSyncSettingsDialogOpen(false)
                    setSelectedOrgForSync(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveSyncSettings}
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
