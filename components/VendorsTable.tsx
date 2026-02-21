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
  DialogDescription,
  DialogFooter,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Loader2, Factory, Plus, Pencil, Trash2, RefreshCw, Building2, CheckCircle2, XCircle, Settings, Clock, Zap, AlertCircle, Download, Upload } from "lucide-react"
import type { AccountType } from "@/lib/rbac"
import { logger } from "@/lib/context/loggerClient"

const VENDORS_LOG = "[Vendors]"

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
  plant_sync_time_ist?: string | null
  telemetry_sync_mode?: 'LIST_PLANTS' | 'PER_PLANT'
  telemetry_sync_interval?: number
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
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)
  const [syncSettings, setSyncSettings] = useState<{
    enabled: boolean
    plant_sync_mode: 'LIST_PLANTS' | 'PER_PLANT'
    per_plant_sync_interval_minutes: number
    plant_sync_time_ist: string
    telemetry_sync_mode: 'LIST_PLANTS' | 'PER_PLANT'
    telemetry_sync_interval: number
  }>({
    enabled: true,
    plant_sync_mode: 'LIST_PLANTS',
    per_plant_sync_interval_minutes: 15,
    plant_sync_time_ist: "02:00",
    telemetry_sync_mode: 'LIST_PLANTS',
    telemetry_sync_interval: 15,
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
    // FoxESS Cloud fields (API key only, no username/password)
    apiKey: "",
    is_active: true,
    // Plant sync configuration
    plant_sync_mode: "LIST_PLANTS" as 'LIST_PLANTS' | 'PER_PLANT',
    per_plant_sync_interval_minutes: 15,
    plant_sync_time_ist: "02:00",
  })

  useEffect(() => {
    logger.info(`${VENDORS_LOG} Vendors page loaded`, { accountType })
    fetchVendors()
  }, [])

  // Load vendors + org metadata for display. Keeps local state in sync after every mutation.
  async function fetchVendors() {
    logger.info(`${VENDORS_LOG} Fetching vendors and orgs...`)
    try {
      const response = await fetch("/api/vendors")
      const data = await response.json()
      const list = data.vendors || []
      const orgList = data.orgs || []
      setVendors(list)
      setOrgs(orgList)
      logger.info(`${VENDORS_LOG} Vendors loaded`, { vendorsCount: list.length, orgsCount: orgList.length })
    } catch (error) {
      logger.error(`${VENDORS_LOG} Error fetching vendors`, error)
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
        plant_sync_mode: inferredMode,
        per_plant_sync_interval_minutes: vendor.per_plant_sync_interval_minutes ?? 15,
        plant_sync_time_ist: vendor.plant_sync_time_ist || "02:00",
        telemetry_sync_mode: (vendor.telemetry_sync_mode as 'LIST_PLANTS' | 'PER_PLANT') || 'LIST_PLANTS',
        telemetry_sync_interval: vendor.telemetry_sync_interval ?? 15,
      })
      setSelectedVendorForSyncId(vendor.id)
    } else {
      setSyncSettings({
        enabled: true,
        plant_sync_mode: "LIST_PLANTS",
        per_plant_sync_interval_minutes: 15,
        plant_sync_time_ist: "02:00",
        telemetry_sync_mode: "LIST_PLANTS",
        telemetry_sync_interval: 15,
      })
      setSelectedVendorForSyncId(null)
    }
    setSelectedOrgForSync({ id: orgId, name: orgName })
    setSyncSettingsDialogOpen(true)
  }
  
  // Persist updated auto-sync toggles/intervals back to the org via API.
  async function saveSyncSettings() {
    if (!selectedOrgForSync) return

    logger.info(`${VENDORS_LOG} Saving sync settings`, { orgId: selectedOrgForSync.id, orgName: selectedOrgForSync.name, vendorId: selectedVendorForSyncId })
    try {
      // First, update organization-level auto-sync settings.
      // Note: sync_interval_minutes removed - telemetry sync uses vendor-level telemetry_sync_interval
      const orgResponse = await fetch(`/api/orgs/${selectedOrgForSync.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auto_sync_enabled: syncSettings.enabled,
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
              plant_sync_time_ist: syncSettings.plant_sync_time_ist,
              telemetry_sync_mode: syncSettings.telemetry_sync_mode,
              telemetry_sync_interval: syncSettings.telemetry_sync_interval,
            }),
          })

          if (!vendorResponse.ok) {
            const error = await vendorResponse.json()
            alert(error.error || "Failed to update vendor plant sync settings")
            return
          }
        }
      }

        logger.info(`${VENDORS_LOG} Sync settings saved`, { orgId: selectedOrgForSync.id, orgName: selectedOrgForSync.name })
        setSyncSettingsDialogOpen(false)
        setSelectedOrgForSync(null)
      setSelectedVendorForSyncId(null)
      // Refresh vendors to get updated org + vendor data
        fetchVendors()
    } catch (error: any) {
      logger.error(`${VENDORS_LOG} Save sync settings failed`, error)
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
        // FoxESS Cloud fields
        apiKey: vendor.credentials.apiKey || "",
        is_active: vendor.is_active,
        // Plant sync configuration
        plant_sync_mode:
          (vendor.plant_sync_mode as 'LIST_PLANTS' | 'PER_PLANT') ||
          (vendor.vendor_type === "SOLARMAN" || vendor.vendor_type === "SHINEMONITOR"
            ? "LIST_PLANTS"
            : "PER_PLANT"),
        per_plant_sync_interval_minutes:
          vendor.per_plant_sync_interval_minutes ?? 15,
        plant_sync_time_ist:
          vendor.plant_sync_time_ist || "02:00",
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
        // FoxESS Cloud fields
        apiKey: "",
        is_active: true,
         // Plant sync configuration (defaults for new vendor)
        plant_sync_mode: "LIST_PLANTS",
        per_plant_sync_interval_minutes: 15,
        plant_sync_time_ist: "02:00",
      })
    }
    if (editingVendor) {
      logger.info(`${VENDORS_LOG} Open edit vendor`, { vendorId: editingVendor.id, name: editingVendor.name, vendor_type: editingVendor.vendor_type })
    } else {
      logger.info(`${VENDORS_LOG} Open add vendor`)
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

    const isUpdate = !!editingVendor
    logger.info(`${VENDORS_LOG} ${isUpdate ? "Saving vendor (update)" : "Creating vendor"}`, {
      name: formData.name,
      vendor_type: formData.vendor_type,
      org_id: formData.org_id,
      vendorId: editingVendor?.id,
    })

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
      // FoxESS Cloud uses static API key only (no login/token)
      credentials.apiKey = formData.apiKey?.trim() || ""
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
        plant_sync_time_ist: formData.plant_sync_time_ist,
        telemetry_sync_mode: 'LIST_PLANTS', // Default to efficient mode
        telemetry_sync_interval: 15, // Default to 15 minutes
      }),
    })

    if (response.ok) {
      logger.info(`${VENDORS_LOG} ${isUpdate ? "Vendor updated" : "Vendor created"}`, { name: formData.name, vendor_type: formData.vendor_type })
      setDialogOpen(false)
      fetchVendors()
    } else {
      const error = await response.json()
      logger.error(`${VENDORS_LOG} Save vendor failed`, { status: response.status, error: error.error })
      alert(error.error || "Failed to save vendor")
    }
  }

  // Remove a vendor and refresh table once the backend confirms deletion.
  async function handleDelete(id: number) {
    const vendor = vendors.find((v) => v.id === id)
    logger.info(`${VENDORS_LOG} Deleting vendor`, { vendorId: id, name: vendor?.name })
    const response = await fetch(`/api/vendors/${id}`, {
      method: "DELETE",
    })

    if (response.ok) {
      logger.info(`${VENDORS_LOG} Vendor deleted`, { vendorId: id })
      fetchVendors()
      setDeletingVendorId(null)
    } else {
      const error = await response.json()
      logger.error(`${VENDORS_LOG} Delete vendor failed`, { vendorId: id, error: error.error })
      alert(error.error || "Failed to delete vendor")
    }
  }

  // Full sync action used by "Plants" button: first plants, then alerts. Tracks progress for UI.
  async function handleSyncPlants(vendorId: number) {
    const vendor = vendors.find((v) => v.id === vendorId)
    logger.info(`${VENDORS_LOG} Sync plants + alerts started`, { vendorId, name: vendor?.name })
    setSyncingVendorId(vendorId)
    setSyncProgress({ current: 0, total: 0 })

    try {
      // Step 1: sync plants for this vendor
      const plantsResponse = await fetch(`/api/vendors/${vendorId}/sync-plants`, {
        method: "POST",
      })
      const plantsData = await plantsResponse.json()

      if (!plantsResponse.ok) {
        logger.error(`${VENDORS_LOG} Sync plants failed`, { vendorId, error: plantsData.error })
        alert(plantsData.error || "Failed to sync plants")
        setSyncingVendorId(null)
        setSyncProgress(null)
        return
      }

      logger.info(`${VENDORS_LOG} Sync plants completed`, { vendorId, synced: plantsData.synced, created: plantsData.created, updated: plantsData.updated })
      setSyncProgress({ current: plantsData.synced, total: plantsData.total })

      // Step 2: once plants are synced, trigger alert sync for the same vendor
      const alertsResponse = await fetch(`/api/vendors/${vendorId}/sync-alerts`, {
        method: "POST",
      })
      const alertsData = await alertsResponse.json()

      if (!alertsResponse.ok) {
        logger.error(`${VENDORS_LOG} Sync alerts failed (after plants synced)`, { vendorId, error: alertsData.error })
        alert(
          `Plants synced (${plantsData.synced} plants, ${plantsData.created} created, ${plantsData.updated} updated), but alert sync failed: ${
            alertsData.error || "Unknown error"
          }`
        )
      } else {
        logger.info(`${VENDORS_LOG} Sync plants + alerts completed`, {
          vendorId,
          plants: { synced: plantsData.synced, created: plantsData.created, updated: plantsData.updated },
          alerts: { synced: alertsData.synced, created: alertsData.created, updated: alertsData.updated },
        })
        alert(
          `Successfully synced ${plantsData.synced} plants (${plantsData.created} created, ${plantsData.updated} updated)\n` +
            `and ${alertsData.synced} alerts (${alertsData.created} created, ${alertsData.updated} updated).`
        )
      }

      setSyncingVendorId(null)
      setSyncProgress(null)
    } catch (error: any) {
      logger.error(`${VENDORS_LOG} Sync plants/alerts error`, error)
      alert(`Error syncing plants/alerts: ${error.message}`)
      setSyncingVendorId(null)
      setSyncProgress(null)
    }
  }

  // Alert-only sync (separate button) so admins can re-run the alert cron independently.
  async function handleSyncAlerts(vendorId: number) {
    const vendor = vendors.find((v) => v.id === vendorId)
    logger.info(`${VENDORS_LOG} Sync alerts started`, { vendorId, name: vendor?.name })
    setSyncingAlertsVendorId(vendorId)
    setAlertsSyncProgress({ current: 0, total: 0 })
    try {
      const response = await fetch(`/api/vendors/${vendorId}/sync-alerts`, {
        method: "POST",
      })
      const data = await response.json()

      if (response.ok) {
        logger.info(`${VENDORS_LOG} Sync alerts completed`, { vendorId, synced: data.synced, created: data.created, updated: data.updated })
        setAlertsSyncProgress({ current: data.synced || 0, total: data.total || data.synced || 0 })
        alert(
          `Alert sync completed for vendor ${data.vendorName || vendorId}.\n` +
            `Alerts synced: ${data.synced} (${data.created} created, ${data.updated} updated).`
        )
      } else {
        logger.error(`${VENDORS_LOG} Sync alerts failed`, { vendorId, error: data.error })
        alert(data.error || "Failed to sync alerts")
      }
    } catch (error: any) {
      logger.error(`${VENDORS_LOG} Sync alerts error`, error)
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

  const isSuperAdmin = accountType === "SUPERADMIN" || accountType === "DEVELOPER"

  async function handleExport() {
    if (!isSuperAdmin) return
    logger.info(`${VENDORS_LOG} Exporting vendors...`)
    try {
      const response = await fetch("/api/vendors/export")
      
      if (!response.ok) {
        const error = await response.json()
        logger.error(`${VENDORS_LOG} Export vendors failed`, { error: error.error })
        alert(error.error || "Failed to export vendors")
        return
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = `vendors_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
      logger.info(`${VENDORS_LOG} Vendors exported`, { filename: link.download })
    } catch (error) {
      logger.error(`${VENDORS_LOG} Export vendors error`, error)
      alert("Failed to export vendors")
    }
  }

  async function handleImport() {
    if (!isSuperAdmin || !importFile) return

    logger.info(`${VENDORS_LOG} Importing vendors`, { filename: importFile.name })
    setImportLoading(true)
    setImportResult(null)
    
    try {
      const formData = new FormData()
      formData.append("file", importFile)

      const response = await fetch("/api/vendors/import", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        logger.error(`${VENDORS_LOG} Import vendors failed`, { error: data.error })
        alert(data.error || "Failed to import vendors")
        setImportLoading(false)
        return
      }

      setImportResult(data)
      setImportLoading(false)
      logger.info(`${VENDORS_LOG} Vendors import completed`, {
        totalProcessed: data.summary?.totalProcessed,
        totalCreated: data.summary?.totalCreated,
        totalUpdated: data.summary?.totalUpdated,
        errors: data.summary?.totalErrors,
      })
      // Refresh the list if any were processed
      if (data.summary?.totalCreated > 0) {
        fetchVendors()
      }
    } catch (error) {
      logger.error(`${VENDORS_LOG} Import vendors error`, error)
      alert("Failed to import vendors")
      setImportLoading(false)
    }
  }

  return (
    <TooltipProvider>
      <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
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
                  {/* FoxESS Cloud – API key only (no username/password) */}
                  <div>
                    <Label htmlFor="apiKey">API Key *</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={formData.apiKey}
                      onChange={(e) =>
                        setFormData({ ...formData, apiKey: e.target.value })
                      }
                      required
                      className="mt-1"
                      placeholder="e.g. 897255f1-42e2-427d-938a-e34a96274897"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      FoxESS Open API key from the vendor portal. Used with per-request signature; no login required.
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
          {isSuperAdmin && (
            <>
              <motion.div 
                whileHover={{ scale: 1.05 }} 
                whileTap={{ scale: 0.95 }}
                className="w-full sm:w-auto"
              >
                <Button 
                  onClick={handleExport}
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto transition-all duration-200"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Export Excel
                </Button>
              </motion.div>
              <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                <DialogTrigger asChild>
                  <motion.div 
                    whileHover={{ scale: 1.05 }} 
                    whileTap={{ scale: 0.95 }}
                    className="w-full sm:w-auto"
                  >
                    <Button 
                      size="lg"
                      variant="outline"
                      className="w-full sm:w-auto transition-all duration-200"
                    >
                      <Upload className="h-5 w-5 mr-2" />
                      Import Excel
                    </Button>
                  </motion.div>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Import Vendors from Excel</DialogTitle>
                    <DialogDescription>
                      Upload an Excel file to bulk import vendors. Required columns: Name, Vendor Type, Organization ID, Credentials (JSON).
                      <br />
                      <br />
                      <strong>Important:</strong>
                      <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                        <li>Only creates new vendors - does not update existing ones</li>
                        <li>Credentials must be valid JSON format</li>
                        <li>Vendor name + Organization ID combination must be unique</li>
                        <li>Organization ID must exist in the system</li>
                      </ul>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
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
                      <div className="bg-muted p-4 rounded-lg space-y-2">
                        <h4 className="font-semibold">Import Results:</h4>
                        <p>Total Processed: {importResult.summary.totalProcessed}</p>
                        <p className="text-green-600">Successfully Created: {importResult.summary.totalCreated}</p>
                        <p className="text-red-600">Errors: {importResult.summary.totalErrors}</p>
                        {importResult.results && importResult.results.length > 0 && (
                          <div className="mt-2 max-h-40 overflow-y-auto">
                            <p className="font-semibold text-sm">Details:</p>
                            {importResult.results.slice(0, 10).map((result: any, idx: number) => (
                              <p key={idx} className={`text-xs ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                                Row {result.rowNumber}: {result.success ? `Created (ID: ${result.vendorId})` : result.error}
                              </p>
                            ))}
                            {importResult.results.length > 10 && (
                              <p className="text-xs text-muted-foreground">... and {importResult.results.length - 10} more</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setImportDialogOpen(false)
                        setImportFile(null)
                        setImportResult(null)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={!importFile || importLoading}
                    >
                      {importLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        "Import"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
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
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleSyncPlants(vendor.id)}
                                  disabled={syncingVendorId === vendor.id || !vendor.org_id || !vendor.organizations?.auto_sync_enabled}
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
                              </span>
                            </TooltipTrigger>
                            {!vendor.organizations?.auto_sync_enabled && (
                              <TooltipContent>
                                <p>Sync is disabled for this organization. Enable sync in Sync Settings to proceed.</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </motion.div>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSyncAlerts(vendor.id)}
                                  disabled={syncingAlertsVendorId === vendor.id || !vendor.organizations?.auto_sync_enabled}
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
                              </span>
                            </TooltipTrigger>
                            {!vendor.organizations?.auto_sync_enabled && (
                              <TooltipContent>
                                <p>Sync is disabled for this organization. Enable sync in Sync Settings to proceed.</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="w-full">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleSyncPlants(vendor.id)}
                              disabled={syncingVendorId === vendor.id || !vendor.org_id || !vendor.organizations?.auto_sync_enabled}
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
                          </span>
                        </TooltipTrigger>
                        {!vendor.organizations?.auto_sync_enabled && (
                          <TooltipContent>
                            <p>Sync is disabled for this organization. Enable sync in Sync Settings to proceed.</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="w-full">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleSyncAlerts(vendor.id)}
                              disabled={syncingAlertsVendorId === vendor.id || !vendor.organizations?.auto_sync_enabled}
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
                          </span>
                        </TooltipTrigger>
                        {!vendor.organizations?.auto_sync_enabled && (
                          <TooltipContent>
                            <p>Sync is disabled for this organization. Enable sync in Sync Settings to proceed.</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
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
                {selectedVendorForSyncId && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <Factory className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {vendors.find((v) => v.id === selectedVendorForSyncId)?.name || "Vendor"}
                    </span>
                  </>
                )}
              </div>
              {/* Plant Sync Section */}
              <div className="space-y-3 rounded-md border bg-blue-50 dark:bg-blue-950/20 px-4 py-3">
                <div className="space-y-1">
                  <Label className="text-sm font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Plant Sync (Once Daily)
                  </Label>
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    Plant sync runs <strong>once daily</strong> at the configured time to fetch newly added plants from the vendor.
                    Manual/force sync is always available on request.
                  </p>
                </div>
                  <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-32 text-xs text-blue-800 dark:text-blue-200">
                      Plant Sync Time
                    </span>
                    <Input
                      type="time"
                      value={syncSettings.plant_sync_time_ist}
                      onChange={(e) =>
                        setSyncSettings((prev) => ({
                          ...prev,
                          plant_sync_time_ist: e.target.value,
                        }))
                      }
                      className="h-8 w-28"
                    />
                    <span className="text-xs text-blue-700 dark:text-blue-300">
                      IST (Default: 02:00)
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Telemetry Sync Section */}
              <div className="space-y-3 rounded-md border bg-purple-50 dark:bg-purple-950/20 px-4 py-3">
                <div className="space-y-1">
                  <Label className="text-sm font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Live Telemetry Sync
                  </Label>
                  <p className="text-xs text-purple-800 dark:text-purple-200">
                    Live telemetry (current power, daily/monthly/yearly energy, network status) is synced at regular intervals.
                    Choose how telemetry is fetched from the vendor.
                    </p>
                  </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-purple-800 dark:text-purple-200">
                      Telemetry Sync Mode
                    </Label>
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant={syncSettings.telemetry_sync_mode === "LIST_PLANTS" ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setSyncSettings((prev) => ({
                            ...prev,
                            telemetry_sync_mode: "LIST_PLANTS",
                          }))
                        }
                        className="justify-start whitespace-normal text-left text-xs"
                      >
                        Sync all plants (Efficient)
                        <span className="ml-2 text-[10px] opacity-70">Single API call gets all plants telemetry</span>
                      </Button>
                      <Button
                        type="button"
                        variant={syncSettings.telemetry_sync_mode === "PER_PLANT" ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setSyncSettings((prev) => ({
                            ...prev,
                            telemetry_sync_mode: "PER_PLANT",
                          }))
                        }
                        className="justify-start whitespace-normal text-left text-xs"
                      >
                        Sync per plant (Costly)
                        <span className="ml-2 text-[10px] opacity-70">Each plant requires individual API call</span>
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-purple-800 dark:text-purple-200">
                      Telemetry Sync Interval
                    </Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={syncSettings.telemetry_sync_interval.toString()}
                        onValueChange={(value) =>
                          setSyncSettings((prev) => ({
                            ...prev,
                            telemetry_sync_interval: parseInt(value),
                          }))
                        }
                      >
                        <SelectTrigger className="h-8 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="45">45 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-purple-700 dark:text-purple-300">
                        {syncSettings.telemetry_sync_interval === 15 && "Sync runs at :00, :15, :30, :45"}
                        {syncSettings.telemetry_sync_interval === 30 && "Sync runs at :00, :30"}
                        {syncSettings.telemetry_sync_interval === 45 && "Sync runs at :00, :45"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Restricted Time Window */}
              <div className="space-y-2 rounded-md border-2 border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-950/30 px-4 py-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-700 dark:text-yellow-300" />
                  <Label className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
                    Restricted Sync Window
                  </Label>
                </div>
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  <strong>8:00 PM - 5:00 AM IST:</strong> Telemetry sync operations are automatically skipped during this time window.
                  Plant sync is not restricted and can run at any time (including 2 AM).
                  This prevents unnecessary API calls during off-peak hours.
                </p>
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
    </TooltipProvider>
  )
}
