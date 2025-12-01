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
import type { AccountType } from "@/lib/rbac"

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
  plant_sync_mode?: 'LIST_PLANTS' | 'PER_PLANT'
  per_plant_sync_interval_minutes?: number
  plant_list_sync_morning_ist?: string | null
  plant_list_sync_evening_ist?: string | null
  organizations?: {
    id: number
    name: string
    auto_sync_enabled?: boolean
    sync_interval_minutes?: number
  }
}

interface VendorsTableProps {
  accountType: AccountType
}

/**
 * Admin/vendor maintenance table: handles CRUD for vendors, manual sync triggers,
 * and organization-level auto-sync settings.
 *
 * GOVT accounts are allowed **read-only** access: they can see the vendor list
 * but cannot add/edit/delete or trigger sync actions.
 */
export function VendorsTable({ accountType }: VendorsTableProps) {
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
  const [alertsSyncProgress, setAlertsSyncProgress] = useState<{
    current: number
    total: number
  } | null>(null)
  const [syncSettingsDialogOpen, setSyncSettingsDialogOpen] = useState(false)
  const [selectedOrgForSync, setSelectedOrgForSync] = useState<{ id: number, name: string } | null>(null)
  const [selectedVendorForSyncId, setSelectedVendorForSyncId] = useState<number | null>(null)
  const [syncSettings, setSyncSettings] = useState<{
    enabled: boolean
    interval: number
    plant_sync_mode: 'LIST_PLANTS' | 'PER_PLANT'
    per_plant_sync_interval_minutes: number
    plant_list_sync_morning_ist: string
    plant_list_sync_evening_ist: string
  }>({
    enabled: true,
    interval: 15,
    plant_sync_mode: 'LIST_PLANTS',
    per_plant_sync_interval_minutes: 15,
    plant_list_sync_morning_ist: "06:00",
    plant_list_sync_evening_ist: "23:00",
  })
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
    // SolarDM fields
    email: "",
    passwordRSA: "",
    // ShineMonitor fields
    user_name: "",
    pass_hash: "",
    company_key: "",
    // PVBlink fields
    password: "",
    // Foxesscloud fields
    passwordMD5: "",
    is_active: true,
    // Plant sync configuration
    plant_sync_mode: "LIST_PLANTS" as 'LIST_PLANTS' | 'PER_PLANT',
    per_plant_sync_interval_minutes: 15,
    plant_list_sync_morning_ist: "06:00",
    plant_list_sync_evening_ist: "23:00",
  })

  useEffect(() => {
    fetchVendors()
  }, [])

  // Load vendors + org metadata for display. Keeps local state in sync after every mutation.
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
  
  // Populate the auto-sync dialog from whichever vendor currently holds org-level settings.
  function openSyncSettingsDialog(orgId: number, orgName: string) {
    // Find the org's current sync settings from vendors
    const vendor = vendors.find((v) => v.organizations?.id === orgId)

    if (vendor?.organizations) {
      const inferredMode: 'LIST_PLANTS' | 'PER_PLANT' =
        (vendor.plant_sync_mode as 'LIST_PLANTS' | 'PER_PLANT' | undefined) ??
        (vendor.vendor_type === "SOLARMAN" || vendor.vendor_type === "SHINEMONITOR"
          ? "LIST_PLANTS"
          : "PER_PLANT")

      setSyncSettings({
        enabled: vendor.organizations.auto_sync_enabled ?? true,
        interval: vendor.organizations.sync_interval_minutes ?? 15,
        plant_sync_mode: inferredMode,
        per_plant_sync_interval_minutes: vendor.per_plant_sync_interval_minutes ?? 15,
        plant_list_sync_morning_ist: vendor.plant_list_sync_morning_ist || "06:00",
        plant_list_sync_evening_ist: vendor.plant_list_sync_evening_ist || "23:00",
      })
      setSelectedVendorForSyncId(vendor.id)
    } else {
      setSyncSettings({
        enabled: true,
        interval: 15,
        plant_sync_mode: "LIST_PLANTS",
        per_plant_sync_interval_minutes: 15,
        plant_list_sync_morning_ist: "06:00",
        plant_list_sync_evening_ist: "23:00",
      })
      setSelectedVendorForSyncId(null)
    }
    setSelectedOrgForSync({ id: orgId, name: orgName })
    setSyncSettingsDialogOpen(true)
  }
  
  // Persist updated auto-sync toggles/intervals back to the org via API.
  async function saveSyncSettings() {
    if (!selectedOrgForSync) return
    
    try {
      // First, update organization-level auto-sync settings.
      const orgResponse = await fetch(`/api/orgs/${selectedOrgForSync.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auto_sync_enabled: syncSettings.enabled,
          sync_interval_minutes: syncSettings.interval,
        }),
      })

      if (!orgResponse.ok) {
        const error = await orgResponse.json()
        alert(error.error || "Failed to update organization sync settings")
        return
      }

      // Next, if we have a vendor associated with this org, persist the plant sync strategy
      // settings onto that vendor record so all sync controls live behind this dialog.
      if (selectedVendorForSyncId != null) {
        const vendor = vendors.find((v) => v.id === selectedVendorForSyncId)

        if (vendor) {
          const vendorResponse = await fetch(`/api/vendors/${vendor.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: vendor.name,
              credentials: vendor.credentials,
              is_active: vendor.is_active,
              org_id: vendor.org_id,
              plant_sync_mode: syncSettings.plant_sync_mode,
              per_plant_sync_interval_minutes: syncSettings.per_plant_sync_interval_minutes,
              plant_list_sync_morning_ist: syncSettings.plant_list_sync_morning_ist,
              plant_list_sync_evening_ist: syncSettings.plant_list_sync_evening_ist,
            }),
          })

          if (!vendorResponse.ok) {
            const error = await vendorResponse.json()
            alert(error.error || "Failed to update vendor plant sync settings")
            return
          }
        }
      }

      setSyncSettingsDialogOpen(false)
      setSelectedOrgForSync(null)
      setSelectedVendorForSyncId(null)
      // Refresh vendors to get updated org + vendor data
      fetchVendors()
    } catch (error: any) {
      alert(`Error updating sync settings: ${error.message}`)
    }
  }

  // Open the create/edit dialog, pre-filling credentials when editing.
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
        // SolarDM fields
        email: vendor.credentials.email || "",
        passwordRSA: vendor.credentials.passwordRSA || "",
        // ShineMonitor fields
        user_name: vendor.credentials.user_name || "",
        pass_hash: vendor.credentials.pass_hash || "",
        company_key: vendor.credentials.company_key || "",
        // PVBlink fields
        password: vendor.credentials.password || "",
        // Foxesscloud fields
        passwordMD5: vendor.credentials.passwordMD5 || "",
        is_active: vendor.is_active,
        // Plant sync configuration
        plant_sync_mode:
          (vendor.plant_sync_mode as 'LIST_PLANTS' | 'PER_PLANT') ||
          (vendor.vendor_type === "SOLARMAN" || vendor.vendor_type === "SHINEMONITOR"
            ? "LIST_PLANTS"
            : "PER_PLANT"),
        per_plant_sync_interval_minutes:
          vendor.per_plant_sync_interval_minutes ?? 15,
        plant_list_sync_morning_ist:
          vendor.plant_list_sync_morning_ist || "06:00",
        plant_list_sync_evening_ist:
          vendor.plant_list_sync_evening_ist || "23:00",
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
        // SolarDM fields
        email: "",
        passwordRSA: "",
        // ShineMonitor fields
        user_name: "",
        pass_hash: "",
        company_key: "",
        // PVBlink fields
        password: "",
        // Foxesscloud fields
        passwordMD5: "",
        is_active: true,
         // Plant sync configuration (defaults for new vendor)
        plant_sync_mode: "LIST_PLANTS",
        per_plant_sync_interval_minutes: 15,
        plant_list_sync_morning_ist: "06:00",
        plant_list_sync_evening_ist: "23:00",
      })
    }
    setDialogOpen(true)
  }

  // Create or update a vendor record using the form payload (credentials live in JSON).
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.org_id) {
      alert("Please select an organization")
      return
    }

    // Build credentials based on vendor type
    const credentials: any = {}
    
    if (formData.vendor_type === "SOLARDM") {
      // SolarDM only requires email and passwordRSA
      credentials.email = formData.email
      credentials.passwordRSA = formData.passwordRSA
    } else if (formData.vendor_type === "SHINEMONITOR") {
      // ShineMonitor only requires user_name, pass_hash, and company_key
      credentials.user_name = formData.user_name
      credentials.pass_hash = formData.pass_hash
      credentials.company_key = formData.company_key
    } else if (formData.vendor_type === "PVBLINK") {
      // PVBlink only requires email and password
      credentials.email = formData.email
      credentials.password = formData.password
    } else if (formData.vendor_type === "FOXESSCLOUD") {
      // Foxesscloud only requires username and passwordMD5
      credentials.username = formData.username
      credentials.passwordMD5 = formData.passwordMD5
    } else {
      // Solarman and other vendors
      credentials.appId = formData.appId
      credentials.appSecret = formData.appSecret
      credentials.username = formData.username
      credentials.passwordSha256 = formData.passwordSha256

      if (formData.solarmanOrgId && formData.solarmanOrgId.trim() !== "") {
        const orgIdNum = parseInt(formData.solarmanOrgId)
        if (!isNaN(orgIdNum)) {
          credentials.orgId = orgIdNum
        }
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
        plant_sync_mode: formData.plant_sync_mode,
        per_plant_sync_interval_minutes: formData.per_plant_sync_interval_minutes,
        plant_list_sync_morning_ist: formData.plant_list_sync_morning_ist,
        plant_list_sync_evening_ist: formData.plant_list_sync_evening_ist,
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

  // Remove a vendor and refresh table once the backend confirms deletion.
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

  // Full sync action used by "Plants" button: first plants, then alerts. Tracks progress for UI.
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

  // Alert-only sync (separate button) so admins can re-run the alert cron independently.
  async function handleSyncAlerts(vendorId: number) {
    setSyncingAlertsVendorId(vendorId)
    setAlertsSyncProgress({ current: 0, total: 0 })
    try {
      const response = await fetch(`/api/vendors/${vendorId}/sync-alerts`, {
        method: "POST",
      })
      const data = await response.json()

      if (response.ok) {
        setAlertsSyncProgress({ current: data.synced || 0, total: data.total || data.synced || 0 })
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
      setTimeout(() => setAlertsSyncProgress(null), 800)
    }
  }

  const isReadOnlyGovt = accountType === "GOVT"

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
        {!isReadOnlyGovt && (
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
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
                    <SelectItem value="SOLARDM">SolarDM</SelectItem>
                    <SelectItem value="SHINEMONITOR">ShineMonitor</SelectItem>
                    <SelectItem value="PVBLINK">PV Blink</SelectItem>
                    <SelectItem value="FOXESSCLOUD">PV Hub[Foxesscloud]</SelectItem>
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
              
              {/* SolarDM Fields - Only email and passwordRSA */}
              {formData.vendor_type === "SOLARDM" ? (
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
                  </div>
                  <div>
                    <Label htmlFor="passwordRSA">Password (RSA Encrypted) *</Label>
                    <Input
                      id="passwordRSA"
                      type="password"
                      value={formData.passwordRSA}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          passwordRSA: e.target.value,
                        })
                      }
                      required
                      className="mt-1"
                      placeholder="RSA encrypted password"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      RSA encrypted password for SolarDM authentication
                    </p>
                  </div>
                </>
              ) : formData.vendor_type === "SHINEMONITOR" ? (
                <>
                  {/* ShineMonitor Fields - Only user_name, pass_hash, and company_key */}
                  <div>
                    <Label htmlFor="user_name">User Name *</Label>
                    <Input
                      id="user_name"
                      value={formData.user_name}
                      onChange={(e) =>
                        setFormData({ ...formData, user_name: e.target.value })
                      }
                      required
                      className="mt-1"
                      placeholder="KRPC"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pass_hash">Password (SHA1 Hash) *</Label>
                    <Input
                      id="pass_hash"
                      type="password"
                      value={formData.pass_hash}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pass_hash: e.target.value,
                        })
                      }
                      required
                      className="mt-1"
                      placeholder="SHA1 hashed password"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      SHA1 hashed password for ShineMonitor authentication
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="company_key">Company Key *</Label>
                    <Input
                      id="company_key"
                      value={formData.company_key}
                      onChange={(e) =>
                        setFormData({ ...formData, company_key: e.target.value })
                      }
                      required
                      className="mt-1"
                      placeholder="bnrl_frRFjEz8Mkn"
                    />
                  </div>
                </>
              ) : formData.vendor_type === "PVBLINK" ? (
                <>
                  {/* PVBlink Fields - Only email and password */}
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
                      placeholder="vendor@example.com"
                    />
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
                      placeholder="Password"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Password for PVBlink authentication
                    </p>
                  </div>
                </>
              ) : formData.vendor_type === "FOXESSCLOUD" ? (
                <>
                  {/* Foxesscloud Fields - Only username and passwordMD5 */}
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
                      placeholder="Enter username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="passwordMD5">Password (MD5) *</Label>
                    <Input
                      id="passwordMD5"
                      type="password"
                      value={formData.passwordMD5}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          passwordMD5: e.target.value,
                        })
                      }
                      required
                      className="mt-1"
                      placeholder="MD5 hashed password"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      MD5 hashed password for Foxesscloud authentication
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Solarman and other vendor fields */}
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
                </>
              )}

      {/* Telemetry Sync Strategy */}
              <div className="mt-4 space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">
                      Telemetry Sync Strategy
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Controls how the 15‑minute (or configured) cron loads plants and telemetry for this vendor.
                      In list mode, all plants are loaded and their telemetry is refreshed on every auto‑sync tick.
                      In individual‑plant mode, telemetry is loaded from individual plants while the heavy plant list sync
                      runs only at the configured morning and evening times.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                        Mode
                      </Label>
                    <div className="flex flex-col gap-2 text-xs">
                      <Button
                        type="button"
                        variant={formData.plant_sync_mode === "LIST_PLANTS" ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            plant_sync_mode: "LIST_PLANTS",
                          }))
                        }
                        className="justify-start"
                      >
                        Sync via plant list (listPlants)
                      </Button>
                      <Button
                        type="button"
                        variant={formData.plant_sync_mode === "PER_PLANT" ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            plant_sync_mode: "PER_PLANT",
                          }))
                        }
                        className="justify-start"
                      >
                        Sync via individual plants
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Vendor Sync Timing (defaults, override allowed)
                    </Label>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-28 text-muted-foreground">
                          Per‑plant interval
                        </span>
                        <Input
                          type="number"
                          min={5}
                          max={1440}
                          value={formData.per_plant_sync_interval_minutes}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              per_plant_sync_interval_minutes: Number(e.target.value) || 15,
                            }))
                          }
                          className="h-8 w-24"
                        />
                        <span className="text-muted-foreground">minutes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-28 text-muted-foreground">
                          Morning listPlants
                        </span>
                        <Input
                          type="time"
                          value={formData.plant_list_sync_morning_ist}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              plant_list_sync_morning_ist: e.target.value,
                            }))
                          }
                          className="h-8 w-28"
                        />
                        <span className="text-muted-foreground text-[11px]">
                          Default 06:00 IST
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-28 text-muted-foreground">
                          Evening listPlants
                        </span>
                        <Input
                          type="time"
                          value={formData.plant_list_sync_evening_ist}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              plant_list_sync_evening_ist: e.target.value,
                            }))
                          }
                          className="h-8 w-28"
                        />
                        <span className="text-muted-foreground text-[11px]">
                          Default 23:00 IST
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Super Admin can override these defaults per vendor. During sync, the backend
                  checks whether this vendor should be synced via <span className="font-semibold">plant list</span>
                  or <span className="font-semibold">individual plants</span>. For individual‑plant vendors,
                  the plant list is refreshed around the configured morning and evening times.
                </p>
              </div>
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
        )}
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
                {!isReadOnlyGovt && (
                  <TableHead className="font-bold text-base text-right">
                    Actions
                  </TableHead>
                )}
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
                      {!isReadOnlyGovt && (
                        <p className="text-sm text-muted-foreground">
                          Click &quot;Add Vendor&quot; to create your first vendor integration
                        </p>
                      )}
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
                    {!isReadOnlyGovt && (
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
                            className="transition-all duration-200 hover:scale-110 bg-gradient-to-r from-amber-500/90 to-rose-500/90 text-white shadow-md hover:shadow-lg disabled:opacity-60"
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
                    )}
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
              {!isReadOnlyGovt && (
                <p className="text-sm text-muted-foreground">
                  Click &quot;Add Vendor&quot; to create your first vendor integration
                </p>
              )}
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
                  {!isReadOnlyGovt && (
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
                        variant="default"
                        size="sm"
                        onClick={() => handleSyncAlerts(vendor.id)}
                        disabled={syncingAlertsVendorId === vendor.id}
                        className="w-full bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white disabled:opacity-60"
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
                  )}
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
      {syncingAlertsVendorId && alertsSyncProgress && (
        <Card className="p-4 border-2 bg-gradient-to-br from-amber-50/60 via-orange-50/60 to-rose-50/60 dark:from-amber-950/20 dark:via-orange-950/20 dark:to-rose-950/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
              <span className="text-sm font-semibold">Syncing alerts...</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {alertsSyncProgress.total > 0
                ? `${alertsSyncProgress.current} / ${alertsSyncProgress.total}`
                : "Fetching alerts..."}
            </span>
          </div>
          {alertsSyncProgress.total > 0 ? (
            <Progress
              value={(alertsSyncProgress.current / alertsSyncProgress.total) * 100}
              className="h-2"
            />
          ) : (
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-rose-500 animate-pulse"
                style={{ width: "50%" }}
              />
            </div>
          )}
        </Card>
      )}

      {/* Sync Settings Dialog */}
      <Dialog open={syncSettingsDialogOpen} onOpenChange={setSyncSettingsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              Auto-Sync Settings
            </DialogTitle>
          </DialogHeader>
          {selectedOrgForSync && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b">
                <Building2 className="h-5 w-5 text-primary" />
                <span className="font-semibold text-base">{selectedOrgForSync.name}</span>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Left column: org-level auto-sync + mode selection */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
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
                      <Label htmlFor="sync-interval" className="text-xs font-semibold text-muted-foreground">
                        Sync Interval (minutes)
                      </Label>
                      <div className="flex items-center gap-2">
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
                          className="h-9 w-24"
                        />
                        <span className="text-xs text-muted-foreground">
                          For 15 min: :00, :15, :30, :45
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Sync runs at fixed clock times based on this interval.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2 pt-2">
                    <Label className="text-[11px] font-semibold text-muted-foreground">
                      Mode
                    </Label>
                    <div className="flex flex-col gap-2 text-xs">
                      <Button
                        type="button"
                        variant={syncSettings.plant_sync_mode === "LIST_PLANTS" ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setSyncSettings((prev) => ({
                            ...prev,
                            plant_sync_mode: "LIST_PLANTS",
                          }))
                        }
                        className="justify-start whitespace-normal text-left"
                      >
                        Sync via plant list (listPlants)
                      </Button>
                      <Button
                        type="button"
                        variant={syncSettings.plant_sync_mode === "PER_PLANT" ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setSyncSettings((prev) => ({
                            ...prev,
                            plant_sync_mode: "PER_PLANT",
                          }))
                        }
                        className="justify-start whitespace-normal text-left"
                      >
                        Sync via individual plants
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Right column: vendor-level telemetry sync strategy */}
                <div className="space-y-3 rounded-md border bg-muted/40 px-4 py-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">
                      Telemetry Sync Strategy
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Controls how the 15‑minute (or configured) cron loads plants and telemetry for this vendor.
                      In list mode, all plants are loaded and their telemetry is refreshed on every auto‑sync tick.
                      In individual‑plant mode, telemetry is loaded from individual plants while the heavy plant list sync
                      runs only at the configured morning and evening times.
                    </p>
                  </div>

                  {syncSettings.plant_sync_mode === "PER_PLANT" ? (
                    <div className="space-y-2 text-xs">
                      <Label className="text-[11px] font-semibold text-muted-foreground">
                        Vendor Sync Timing
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Only applied when mode is <span className="font-semibold">Sync via individual plants</span>.
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-32 text-muted-foreground">
                            Per‑plant interval
                          </span>
                          <Input
                            type="number"
                            min={5}
                            max={1440}
                            value={syncSettings.per_plant_sync_interval_minutes}
                            onChange={(e) =>
                              setSyncSettings((prev) => ({
                                ...prev,
                                per_plant_sync_interval_minutes: Number(e.target.value) || syncSettings.interval,
                              }))
                            }
                            className="h-8 w-20"
                          />
                          <span className="text-muted-foreground">min</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-32 text-muted-foreground">
                            Morning listPlants
                          </span>
                          <Input
                            type="time"
                            value={syncSettings.plant_list_sync_morning_ist}
                            onChange={(e) =>
                              setSyncSettings((prev) => ({
                                ...prev,
                                plant_list_sync_morning_ist: e.target.value,
                              }))
                            }
                            className="h-8 w-28"
                          />
                          <span className="text-muted-foreground text-[11px]">
                            Default 06:00 IST
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-32 text-muted-foreground">
                            Evening listPlants
                          </span>
                          <Input
                            type="time"
                            value={syncSettings.plant_list_sync_evening_ist}
                            onChange={(e) =>
                              setSyncSettings((prev) => ({
                                ...prev,
                                plant_list_sync_evening_ist: e.target.value,
                              }))
                            }
                            className="h-8 w-28"
                          />
                          <span className="text-muted-foreground text-[11px]">
                            Default 23:00 IST
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      <p>
                        For <span className="font-semibold">plant list</span> mode, the vendor
                        uses the organization&#39;s auto-sync interval on the left; no additional
                        vendor timing is required.
                      </p>
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground">
                    During sync, the backend checks whether this vendor should be synced via <span className="font-semibold">plant list</span>
                    or <span className="font-semibold">individual plants</span>. For individual‑plant vendors,
                    the plant list is refreshed around the configured morning and evening times.
                  </p>
                </div>
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
