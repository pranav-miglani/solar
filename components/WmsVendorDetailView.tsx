"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Building2,
  CloudSun,
  ArrowLeft,
  RefreshCw,
  MapPin,
  Calendar,
  ExternalLink,
  Loader2,
  AlertCircle,
  Activity,
  Database,
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

interface WmsVendor {
  id: number
  name: string
  vendor_type: string
  org_id: number
  is_active: boolean
  last_sites_synced_at: string | null
  last_insolation_synced_at: string | null
  created_at: string
  organizations?: {
    id: number
    name: string
  }
}

export function WmsVendorDetailView({ vendorId }: { vendorId: string }) {
  const router = useRouter()
  const [vendor, setVendor] = useState<WmsVendor | null>(null)
  const [sitesCount, setSitesCount] = useState(0)
  const [devicesCount, setDevicesCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncingDevices, setSyncingDevices] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchVendorData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId])

  async function fetchVendorData(showRefreshing = false) {
    try {
      if (showRefreshing) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      const [vendorResponse, sitesResponse, devicesResponse] = await Promise.all([
        fetch(`/api/wms-vendors/${vendorId}`),
        fetch(`/api/wms-vendors/${vendorId}/sites`),
        fetch(`/api/wms-vendors/${vendorId}/devices`),
      ])

      if (!vendorResponse.ok) {
        throw new Error("Failed to fetch vendor data")
      }

      const vendorData = await vendorResponse.json()
      // API returns { vendor: {...} }, extract the vendor object
      const vendor = vendorData.vendor || vendorData
      setVendor(vendor)

      if (sitesResponse.ok) {
        const sitesData = await sitesResponse.json()
        setSitesCount(sitesData.count || 0)
      }

      if (devicesResponse.ok) {
        const devicesData = await devicesResponse.json()
        setDevicesCount(devicesData.count || 0)
      }
    } catch (err: any) {
      setError(err.message || "Failed to load vendor data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function handleSyncSites() {
    setSyncing(true)
    try {
      const response = await fetch(`/api/wms-vendors/${vendorId}/sync-sites`, {
        method: "POST",
      })
      const data = await response.json()

      if (response.ok && data.success) {
        // Refresh data immediately after successful sync
        await fetchVendorData(true)
        // Show success message
        alert(`Sites synced successfully: ${data.result?.sitesSynced || 0} sites, ${data.result?.devicesSynced || 0} devices`)
      } else {
        alert(data.error || "Failed to sync sites")
      }
    } catch (error: any) {
      alert(`Error syncing sites: ${error.message}`)
    } finally {
      setSyncing(false)
    }
  }

  async function handleSyncDevices() {
    setSyncingDevices(true)
    try {
      const response = await fetch(`/api/wms-vendors/${vendorId}/sync-devices`, {
        method: "POST",
      })
      const data = await response.json()

      if (response.ok && data.success) {
        // Refresh data immediately after successful sync
        await fetchVendorData(true)
        // Show success message
        alert(`Insolation data synced successfully for ${data.result?.devicesSynced || 0} devices`)
      } else {
        alert(data.error || "Failed to sync insolation data")
      }
    } catch (error: any) {
      alert(`Error syncing insolation data: ${error.message}`)
    } finally {
      setSyncingDevices(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-muted-foreground">Loading vendor details...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !vendor) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Card className="p-6">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-destructive text-lg font-medium">{error || "Vendor not found"}</p>
            <Button onClick={() => router.push("/wms")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to WMS
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <Button onClick={() => router.push("/wms")} variant="outline" size="sm" className="transition-all hover:scale-105">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <CloudSun className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              {vendor.name}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">WMS Vendor Details</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleSyncSites}
              disabled={syncing || refreshing}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto min-w-[120px] transition-all"
            >
              {syncing || refreshing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {syncing ? "Syncing..." : "Refreshing..."}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Sites
                </>
              )}
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleSyncDevices}
              disabled={syncingDevices || refreshing}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto min-w-[120px] transition-all"
              title="Sync insolation data for all devices (backfill last 100 days)"
            >
              {syncingDevices || refreshing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {syncingDevices ? "Syncing..." : "Refreshing..."}
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Sync Devices
                </>
              )}
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Vendor Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className="h-full transition-all hover:shadow-lg cursor-default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CloudSun className="h-4 w-4" />
                Vendor Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" className="text-base font-semibold px-3 py-1">
                {vendor.vendor_type || "N/A"}
              </Badge>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className="h-full transition-all hover:shadow-lg cursor-default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Organization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-medium text-base">
                  {vendor.organizations?.name || (vendor.org_id ? `Org ID: ${vendor.org_id}` : "No Organization")}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className="h-full transition-all hover:shadow-lg cursor-default">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={vendor.is_active ? "default" : "secondary"} className="text-sm font-medium px-3 py-1">
                {vendor.is_active ? "Active" : "Inactive"}
              </Badge>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className={`h-full transition-all hover:shadow-lg ${refreshing ? "opacity-75" : ""}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Sites
                {refreshing && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">{refreshing ? "..." : sitesCount}</div>
              <Link
                href={`/wms/vendors/${vendorId}/sites`}
                className="text-sm text-primary hover:text-primary/80 hover:underline flex items-center gap-1.5 mt-3 transition-all group"
              >
                View Sites <ExternalLink className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className={`h-full transition-all hover:shadow-lg ${refreshing ? "opacity-75" : ""}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Devices
                {refreshing && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{refreshing ? "..." : devicesCount}</div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.6 }}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className={`h-full transition-all hover:shadow-lg ${refreshing ? "opacity-75" : ""}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Last Sites Sync
                {refreshing && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm">
                  {refreshing ? (
                    <span className="text-muted-foreground italic">Updating...</span>
                  ) : vendor.last_sites_synced_at ? (
                    format(new Date(vendor.last_sites_synced_at), "PPp")
                  ) : (
                    "Never"
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.7 }}
          whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
        >
          <Card className={`h-full transition-all hover:shadow-lg ${refreshing ? "opacity-75" : ""}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Last Insolation Sync
                {refreshing && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm">
                  {refreshing ? (
                    <span className="text-muted-foreground italic">Updating...</span>
                  ) : vendor.last_insolation_synced_at ? (
                    format(new Date(vendor.last_insolation_synced_at), "PPp")
                  ) : (
                    "Never"
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}

