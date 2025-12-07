"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Plus, Edit, Trash2, RefreshCw, CloudSun, Building2, Download, Upload } from "lucide-react"
import { motion } from "framer-motion"
import { Switch } from "@/components/ui/switch"

interface WmsVendor {
  id: number
  name: string
  vendor_type: string
  org_id: number
  is_active: boolean
  last_sites_synced_at: string | null
  last_insolation_synced_at: string | null
  organizations?: {
    id: number
    name: string
  }
}

interface Organization {
  id: number
  name: string
}

interface WmsVendorsTableProps {
  accountType: "SUPERADMIN" | "DEVELOPER" | "ORG" | "GOVT"
}

export function WmsVendorsTable({ accountType }: WmsVendorsTableProps) {
  const router = useRouter()
  const [vendors, setVendors] = useState<WmsVendor[]>([])
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<WmsVendor | null>(null)
  const [deletingVendorId, setDeletingVendorId] = useState<number | null>(null)
  const [syncingVendorId, setSyncingVendorId] = useState<number | null>(null)
  const [backfilling, setBackfilling] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  const [formData, setFormData] = useState({
    name: "",
    vendor_type: "INTELLO",
    org_id: "",
    // INTELLO credentials
    email: "",
    password_hash: "",
    // SCADA credentials
    loginId: "",
    password: "",
    userName: "",
    userType: "",
    // TRACKSO credentials
    tracksoEmail: "",
    tracksoPassword: "",
    is_active: true,
  })

  useEffect(() => {
    fetchVendors()
    fetchOrgs()
  }, [])

  async function fetchVendors() {
    try {
      setLoading(true)
      const response = await fetch("/api/wms-vendors")
      const data = await response.json()
      if (data.vendors) {
        setVendors(data.vendors)
      }
    } catch (error) {
      console.error("Error fetching WMS vendors:", error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchOrgs() {
    try {
      const response = await fetch("/api/orgs")
      const data = await response.json()
      // API returns { orgs: [...] } - same organizations used for plant vendors
      // Organizations are shared between plant vendors and WMS vendors
      setOrgs(data.orgs || [])
    } catch (error) {
      console.error("Error fetching organizations:", error)
    }
  }

  function openDialog(vendor?: WmsVendor) {
    if (vendor) {
      setEditingVendor(vendor)
      setFormData({
        name: vendor.name,
        vendor_type: vendor.vendor_type || "INTELLO",
        org_id: vendor.org_id?.toString() || "",
        email: "", // Credentials are not returned for security
        password_hash: "", // Credentials are not returned for security
        loginId: "",
        password: "",
        userName: "",
        userType: "",
        tracksoEmail: "",
        tracksoPassword: "",
        is_active: vendor.is_active,
      })
    } else {
      setEditingVendor(null)
      setFormData({
        name: "",
        vendor_type: "INTELLO",
        org_id: "",
        email: "",
        password_hash: "",
        loginId: "",
        password: "",
        userName: "",
        userType: "",
        tracksoEmail: "",
        tracksoPassword: "",
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

    // Build credentials based on vendor type
    let credentials: any = {}
    
    if (formData.vendor_type === "INTELLO") {
      if (!formData.email || !formData.password_hash) {
        alert("Please provide email and password hash for INTELLO")
        return
      }
      credentials = {
        email: formData.email,
        password_hash: formData.password_hash,
      }
    } else if (formData.vendor_type === "SCADA") {
      if (!formData.loginId || !formData.password || !formData.userName || !formData.userType) {
        alert("Please provide loginId, password, userName, and userType for SCADA")
        return
      }
      credentials = {
        loginId: formData.loginId,
        password: formData.password,
        userName: formData.userName,
        userType: formData.userType,
      }
    } else if (formData.vendor_type === "TRACKSO") {
      if (!formData.tracksoEmail || !formData.tracksoPassword) {
        alert("Please provide email and password for TRACKSO")
        return
      }
      credentials = {
        email: formData.tracksoEmail,
        password: formData.tracksoPassword,
      }
    } else {
      alert(`Unsupported vendor type: ${formData.vendor_type}`)
      return
    }

    const url = editingVendor
      ? `/api/wms-vendors/${editingVendor.id}`
      : "/api/wms-vendors"
    const method = editingVendor ? "PUT" : "POST"

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          vendor_type: formData.vendor_type,
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
        alert(error.error || "Failed to save WMS vendor")
      }
    } catch (error: any) {
      alert(`Error saving WMS vendor: ${error.message}`)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this WMS vendor?")) {
      return
    }

    try {
      const response = await fetch(`/api/wms-vendors/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchVendors()
        setDeletingVendorId(null)
      } else {
        const error = await response.json()
        alert(error.error || "Failed to delete WMS vendor")
      }
    } catch (error: any) {
      alert(`Error deleting WMS vendor: ${error.message}`)
    }
  }

  async function handleSyncSites(vendorId: number) {
    setSyncingVendorId(vendorId)
    try {
      const response = await fetch(`/api/wms-vendors/${vendorId}/sync-sites`, {
        method: "POST",
      })
      const data = await response.json()

      if (response.ok && data.success) {
        alert(
          `Site sync completed for ${data.result?.wmsVendorName || "WMS vendor"}.\n` +
          `Sites synced: ${data.result?.sitesSynced || 0} (${data.result?.sitesCreated || 0} created, ${data.result?.sitesUpdated || 0} updated)\n` +
          `Devices synced: ${data.result?.devicesSynced || 0} (${data.result?.devicesCreated || 0} created, ${data.result?.devicesUpdated || 0} updated)`
        )
        fetchVendors()
      } else {
        alert(data.error || "Failed to sync sites")
      }
    } catch (error: any) {
      alert(`Error syncing sites: ${error.message}`)
    } finally {
      setSyncingVendorId(null)
    }
  }

  async function handleSyncDevices(vendorId: number) {
    setSyncingVendorId(vendorId)
    try {
      const response = await fetch(`/api/wms-vendors/${vendorId}/sync-devices`, {
        method: "POST",
      })
      const data = await response.json()

      if (response.ok && data.success) {
        alert(
          `Insolation sync completed for ${data.result?.wmsVendorName || "WMS vendor"}.\n` +
          `Devices synced: ${data.result?.devicesSynced || 0}\n` +
          `Readings: ${data.result?.readingsCreated + data.result?.readingsUpdated || 0} (${data.result?.readingsCreated || 0} created, ${data.result?.readingsUpdated || 0} updated)`
        )
        fetchVendors()
      } else {
        alert(data.error || "Failed to sync insolation data")
      }
    } catch (error: any) {
      alert(`Error syncing insolation data: ${error.message}`)
    } finally {
      setSyncingVendorId(null)
    }
  }

  async function handleExport() {
    if (!canManage) return
    try {
      const response = await fetch("/api/wms-vendors/export")
      
      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Failed to export WMS vendors")
        return
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = `wms_vendors_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error("Error exporting WMS vendors:", error)
      alert("Failed to export WMS vendors")
    }
  }

  async function handleImport() {
    if (!canManage || !importFile) return
    
    setImportLoading(true)
    setImportResult(null)
    
    try {
      const formData = new FormData()
      formData.append("file", importFile)

      const response = await fetch("/api/wms-vendors/import", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || "Failed to import WMS vendors")
        setImportLoading(false)
        return
      }

      setImportResult(data)
      setImportLoading(false)
      
      // Refresh the list if any were processed
      if (data.summary && data.summary.successful > 0) {
        fetchVendors()
      }
    } catch (error) {
      console.error("Error importing WMS vendors:", error)
      alert("Failed to import WMS vendors")
      setImportLoading(false)
    }
  }

  async function handleBackfillInsolation() {
    if (!canManage) return
    
    const confirmed = confirm(
      "This will backfill insolation data for the last 100 days for all active WMS vendors.\n\n" +
      "This operation may take a long time. Continue?"
    )
    
    if (!confirmed) return

    setBackfilling(true)
    try {
      const response = await fetch("/api/cron/backfill-wms-insolation", {
        method: "GET",
      })
      const data = await response.json()

      if (response.ok && data.success) {
        alert(
          `Backfill completed successfully!\n\n` +
          `Vendors: ${data.summary?.successful || 0}/${data.summary?.totalVendors || 0} successful\n` +
          `Total readings: ${data.summary?.totalReadings || 0}`
        )
        fetchVendors() // Refresh to update last_insolation_synced_at
      } else {
        alert(data.error || "Failed to backfill insolation data")
      }
    } catch (error: any) {
      alert(`Error backfilling insolation: ${error.message}`)
    } finally {
      setBackfilling(false)
    }
  }

  const isReadOnly = accountType === "GOVT" || accountType === "ORG"
  const canManage = accountType === "SUPERADMIN" || accountType === "DEVELOPER"

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading WMS vendors...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {canManage && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={() => openDialog()}
                    className="w-full sm:w-auto transition-all duration-200 hover:scale-105 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white shadow-lg hover:shadow-xl"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add WMS Vendor
                  </Button>
                </motion.div>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    {editingVendor ? "Edit WMS Vendor" : "Add WMS Vendor"}
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
                      placeholder="e.g., Intello WMS - Production"
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
                        <SelectItem value="INTELLO">Intello</SelectItem>
                        <SelectItem value="SCADA">SCADA</SelectItem>
                        <SelectItem value="TRACKSO">TRACKSO</SelectItem>
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

                  {/* INTELLO Credentials */}
                  {formData.vendor_type === "INTELLO" && (
                    <>
                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          required
                          className="mt-1"
                          placeholder="gigasolarltd@gmail.com"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Email address used for Intello authentication
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="password_hash">Password (256 Hash) *</Label>
                        <Input
                          id="password_hash"
                          type="password"
                          value={formData.password_hash}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              password_hash: e.target.value,
                            })
                          }
                          required
                          className="mt-1"
                          placeholder="57645be3bd2f938cdbd5b26dc8b0d50c19fdbe9e81a9db4612a83a8e40ab1c18"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          SHA-256 hash of the password for Intello authentication
                        </p>
                      </div>
                    </>
                  )}

                  {/* SCADA Credentials */}
                  {formData.vendor_type === "SCADA" && (
                    <>
                      <div>
                        <Label htmlFor="loginId">Login ID *</Label>
                        <Input
                          id="loginId"
                          type="text"
                          value={formData.loginId}
                          onChange={(e) =>
                            setFormData({ ...formData, loginId: e.target.value })
                          }
                          required
                          className="mt-1"
                          placeholder="C10041"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Login ID for SCADA authentication
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="password">Password *</Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              password: e.target.value,
                            })
                          }
                          required
                          className="mt-1"
                          placeholder="drs@123"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Password for SCADA authentication
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="userName">User Name *</Label>
                        <Input
                          id="userName"
                          type="text"
                          value={formData.userName}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              userName: e.target.value,
                            })
                          }
                          required
                          className="mt-1"
                          placeholder="LOGICS"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          User name for SCADA authentication
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="userType">User Type *</Label>
                        <Input
                          id="userType"
                          type="text"
                          value={formData.userType}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              userType: e.target.value,
                            })
                          }
                          required
                          className="mt-1"
                          placeholder="SOLAR"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          User type for SCADA authentication (e.g., SOLAR)
                        </p>
                      </div>
                    </>
                  )}

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_active: checked })
                      }
                    />
                    <Label htmlFor="is_active" className="cursor-pointer">
                      Active
                    </Label>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingVendor ? "Update" : "Create"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {vendors.length === 0 ? (
        <Card className="p-8 text-center">
          <CloudSun className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No WMS Vendors</h3>
          <p className="text-muted-foreground mb-4">
            Get started by adding a weather monitoring system vendor.
          </p>
          {canManage && (
            <>
              <Button onClick={() => openDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add WMS Vendor
              </Button>
              <Button onClick={handleExport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={() => setImportDialogOpen(true)} variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button
                onClick={handleBackfillInsolation}
                variant="outline"
                disabled={backfilling}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${backfilling ? "animate-spin" : ""}`} />
                Backfill Insolation (100 days)
              </Button>
            </>
          )}
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Vendor Type</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Sites Sync</TableHead>
                <TableHead>Last Insolation Sync</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <CloudSun className="h-4 w-4 text-primary" />
                      {vendor.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{vendor.vendor_type}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {vendor.organizations?.name || `Org ID: ${vendor.org_id}`}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={vendor.is_active ? "default" : "secondary"}>
                      {vendor.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {vendor.last_sites_synced_at
                      ? new Date(vendor.last_sites_synced_at).toLocaleString()
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {vendor.last_insolation_synced_at
                      ? new Date(vendor.last_insolation_synced_at).toLocaleString()
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/wms/vendors/${vendor.id}/sites`)}
                      >
                        Sites
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/wms/vendors/${vendor.id}`)}
                      >
                        Details
                      </Button>
                      {canManage && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSyncSites(vendor.id)}
                            disabled={syncingVendorId === vendor.id}
                            title="Sync sites and devices metadata from vendor API"
                          >
                            <RefreshCw
                              className={`h-4 w-4 mr-1 ${
                                syncingVendorId === vendor.id ? "animate-spin" : ""
                              }`}
                            />
                            Sites
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSyncDevices(vendor.id)}
                            disabled={syncingVendorId === vendor.id}
                            title="Sync insolation data for all devices (per-device for INTELLO)"
                          >
                            <RefreshCw
                              className={`h-4 w-4 mr-1 ${
                                syncingVendorId === vendor.id ? "animate-spin" : ""
                              }`}
                            />
                            Devices
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDialog(vendor)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDeletingVendorId(vendor.id)
                              handleDelete(vendor.id)
                            }}
                            disabled={deletingVendorId === vendor.id}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Import Dialog */}
      {canManage && (
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import WMS Vendors</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="import-file">Select Excel File</Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="mt-1"
                />
              </div>
              {importResult && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Import Results</h4>
                  <p className="text-sm">
                    Total: {importResult.summary?.total || 0} | 
                    Successful: {importResult.summary?.successful || 0} | 
                    Failed: {importResult.summary?.failed || 0}
                  </p>
                  {importResult.results && importResult.results.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto">
                      {importResult.results.map((result: any, idx: number) => (
                        <div
                          key={idx}
                          className={`text-xs p-1 ${
                            result.success ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          Row {result.rowNumber}: {result.success ? "✓" : "✗"} {result.error || "Success"}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportDialogOpen(false)
                    setImportFile(null)
                    setImportResult(null)
                  }}
                >
                  Close
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!importFile || importLoading}
                >
                  {importLoading ? "Importing..." : "Import"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

