"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading vendor details...</div>
        </div>
      </div>
    )
  }

  if (error || !vendor) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-6">
          <div className="text-center">
            <p className="text-destructive mb-4">{error || "Vendor not found"}</p>
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={() => router.push("/wms")} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CloudSun className="h-8 w-8 text-primary" />
              {vendor.name}
            </h1>
            <p className="text-muted-foreground mt-1">WMS Vendor Details</p>
          </div>
        </div>
        <Button
          onClick={handleSyncSites}
          disabled={syncing || refreshing}
          variant="outline"
          className="min-w-[120px]"
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vendor Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="outline" className="text-lg">
              {vendor.vendor_type || "N/A"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Organization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {vendor.organizations?.name || (vendor.org_id ? `Org ID: ${vendor.org_id}` : "No Organization")}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={vendor.is_active ? "default" : "secondary"}>
              {vendor.is_active ? "Active" : "Inactive"}
            </Badge>
          </CardContent>
        </Card>

        <Card className={refreshing ? "opacity-75 transition-opacity" : ""}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Sites
              {refreshing && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{refreshing ? "..." : sitesCount}</div>
            <Link
              href={`/wms/vendors/${vendorId}/sites`}
              className="text-sm text-primary hover:underline flex items-center gap-1 mt-2"
            >
              View Sites <ExternalLink className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card className={refreshing ? "opacity-75 transition-opacity" : ""}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Devices
              {refreshing && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{refreshing ? "..." : devicesCount}</div>
          </CardContent>
        </Card>

        <Card className={refreshing ? "opacity-75 transition-opacity" : ""}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Last Sites Sync
              {refreshing && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
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

        <Card className={refreshing ? "opacity-75 transition-opacity" : ""}>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Last Insolation Sync
              {refreshing && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
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
      </div>
    </div>
  )
}

