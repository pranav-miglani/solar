"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/DashboardSidebar"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useUser } from "@/context/UserContext"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CloudSun, Factory, MapPin, Cpu, RefreshCw, Plus } from "lucide-react"
import Link from "next/link"

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

interface WmsSite {
  id: number
  wms_vendor_id: number
  org_id: number
  vendor_site_id: string
  site_name: string
  address?: string
  location?: string
  status?: string
}

interface WmsDevice {
  id: number
  wms_site_id: number
  vendor_device_id: string
  device_name?: string
}

export default function WmsPage() {
  const router = useRouter()
  const { account, loading, error } = useUser()
  const [vendors, setVendors] = useState<WmsVendor[]>([])
  const [sites, setSites] = useState<WmsSite[]>([])
  const [devices, setDevices] = useState<WmsDevice[]>([])
  const [loadingVendors, setLoadingVendors] = useState(true)
  const [loadingSites, setLoadingSites] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<number | null>(null)

  useEffect(() => {
    if (loading) return

    if (error || !account) {
      router.push("/auth/login")
      return
    }

    fetchVendors()
  }, [account, loading, error, router])

  async function fetchVendors() {
    try {
      setLoadingVendors(true)
      const response = await fetch("/api/wms-vendors")
      const data = await response.json()
      if (data.vendors) {
        setVendors(data.vendors)
      }
    } catch (error) {
      console.error("Error fetching WMS vendors:", error)
    } finally {
      setLoadingVendors(false)
    }
  }

  async function fetchSites(vendorId: number) {
    try {
      setLoadingSites(true)
      // TODO: Create API endpoint for sites
      // For now, we'll just show vendors
      setSelectedVendor(vendorId)
    } catch (error) {
      console.error("Error fetching sites:", error)
    } finally {
      setLoadingSites(false)
    }
  }

  if (loading || loadingVendors) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading WMS...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="flex">
        <DashboardSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <CloudSun className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Weather Monitoring System</h1>
              </div>
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">WMS Vendors</h2>
                <p className="text-sm text-muted-foreground">
                  Manage weather monitoring system vendors and their sites
                </p>
              </div>
              {(account?.accountType === "SUPERADMIN" || account?.accountType === "DEVELOPER") && (
                <Button onClick={() => router.push("/superadmin/wms-vendors")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add WMS Vendor
                </Button>
              )}
            </div>

            {vendors.length === 0 ? (
              <Card className="p-8 text-center">
                <CloudSun className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No WMS Vendors</h3>
                <p className="text-muted-foreground mb-4">
                  Get started by adding a weather monitoring system vendor.
                </p>
                {(account?.accountType === "SUPERADMIN" || account?.accountType === "DEVELOPER") && (
                  <Button onClick={() => router.push("/superadmin/wms-vendors")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add WMS Vendor
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {vendors.map((vendor) => (
                  <Card key={vendor.id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Factory className="h-5 w-5 text-primary" />
                        <div>
                          <h3 className="font-semibold">{vendor.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {vendor.organizations?.name || `Org ID: ${vendor.org_id}`}
                          </p>
                        </div>
                      </div>
                      <Badge variant={vendor.is_active ? "default" : "secondary"}>
                        {vendor.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Vendor Type:</span>
                        <Badge variant="outline">{vendor.vendor_type}</Badge>
                      </div>
                      {vendor.last_sites_synced_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Last Sites Sync:</span>
                          <span className="text-xs">
                            {new Date(vendor.last_sites_synced_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {vendor.last_insolation_synced_at && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Last Insolation Sync:</span>
                          <span className="text-xs">
                            {new Date(vendor.last_insolation_synced_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => fetchSites(vendor.id)}
                      >
                        <MapPin className="h-4 w-4 mr-2" />
                        View Sites
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/wms/vendor/${vendor.id}`)}
                      >
                        Details
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

