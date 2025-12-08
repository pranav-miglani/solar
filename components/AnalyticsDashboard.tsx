"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, ChevronDown, ChevronRight, Settings, Zap, Building2, AlertCircle, CheckCircle2, XCircle } from "lucide-react"

interface Organization {
  id: number
  name: string
  config: any
  config_hash: string
  config_ready: boolean
  config_last_run_at: string | null
  config_last_status: string | null
  config_last_error: string | null
}

interface Vendor {
  id: number
  name: string
  vendor_type: string
  org_id: number
  config: any
  config_hash: string
  config_ready: boolean
  analytics_ready: boolean
  analytics_last_synced_at: string | null
  config_last_run_at: string | null
  config_last_status: string | null
  config_last_error: string | null
  organizations?: {
    id: number
    name: string
  }
  lastRun?: {
    status: string
    error_message: string | null
    completed_at: string | null
  } | null
}

interface AnalyticsDashboardProps {
  accountType: "SUPERADMIN" | "DEVELOPER"
}

export function AnalyticsDashboard({ accountType }: AnalyticsDashboardProps) {
  const router = useRouter()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [expandedOrgs, setExpandedOrgs] = useState<Set<number>>(new Set())
  const [expandedVendors, setExpandedVendors] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [mirroring, setMirroring] = useState(false)
  const [snapshotting, setSnapshotting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)
      const [orgsRes, vendorsRes] = await Promise.all([
        fetch("/api/analytics/orgs"),
        fetch("/api/analytics/vendors"),
      ])

      if (orgsRes.ok) {
        const orgsData = await orgsRes.json()
        setOrgs(orgsData.orgs || [])
      }

      if (vendorsRes.ok) {
        const vendorsData = await vendorsRes.json()
        setVendors(vendorsData.vendors || [])
      }
    } catch (error) {
      console.error("Failed to fetch analytics data:", error)
      alert("Failed to load analytics data")
    } finally {
      setLoading(false)
    }
  }

  async function triggerMirror() {
    try {
      setMirroring(true)
      const response = await fetch("/api/cron/analytics/mirror-config", { method: "POST" })
      const data = await response.json()

      if (data.success) {
        alert(`Mirror complete: ${data.summary.orgsUpdated} orgs, ${data.summary.vendorsUpdated} vendors, ${data.summary.plantsUpdated} plants updated`)
        await fetchData()
      } else {
        alert(`Mirror failed: ${data.error}`)
      }
    } catch (error: any) {
      alert(`Mirror failed: ${error.message}`)
    } finally {
      setMirroring(false)
    }
  }

  async function triggerSnapshot() {
    try {
      setSnapshotting(true)
      const response = await fetch("/api/cron/analytics/snapshot-energy", { method: "POST" })
      const data = await response.json()

      if (data.success) {
        alert(`Snapshot complete: ${data.summary.rowsUpserted} readings updated`)
        await fetchData()
      } else {
        alert(`Snapshot failed: ${data.error}`)
      }
    } catch (error: any) {
      alert(`Snapshot failed: ${error.message}`)
    } finally {
      setSnapshotting(false)
    }
  }

  function toggleOrg(orgId: number) {
    const newExpanded = new Set(expandedOrgs)
    if (newExpanded.has(orgId)) {
      newExpanded.delete(orgId)
    } else {
      newExpanded.add(orgId)
    }
    setExpandedOrgs(newExpanded)
  }

  function toggleVendor(vendorId: number) {
    const newExpanded = new Set(expandedVendors)
    if (newExpanded.has(vendorId)) {
      newExpanded.delete(vendorId)
    } else {
      newExpanded.add(vendorId)
    }
    setExpandedVendors(newExpanded)
  }

  function getStatusBadge(status: string | null) {
    if (status === "success") {
      return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Success</Badge>
    } else if (status === "error") {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Error</Badge>
    }
    return <Badge variant="secondary">Unknown</Badge>
  }

  const orgsByVendor = new Map<number, Vendor[]>()
  for (const vendor of vendors) {
    if (!orgsByVendor.has(vendor.org_id)) {
      orgsByVendor.set(vendor.org_id, [])
    }
    orgsByVendor.get(vendor.org_id)!.push(vendor)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button
            onClick={triggerMirror}
            disabled={mirroring}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${mirroring ? "animate-spin" : ""}`} />
            {mirroring ? "Mirroring..." : "Mirror Config"}
          </Button>
          <Button
            onClick={triggerSnapshot}
            disabled={snapshotting}
            variant="outline"
          >
            <Zap className={`h-4 w-4 mr-2 ${snapshotting ? "animate-spin" : ""}`} />
            {snapshotting ? "Capturing..." : "Capture Snapshot"}
          </Button>
        </CardContent>
      </Card>

      {/* Organizations and Vendors */}
      <Card>
        <CardHeader>
          <CardTitle>Replicated Organizations & Vendors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {orgs.map((org) => {
              const orgVendors = orgsByVendor.get(org.id) || []
              const isExpanded = expandedOrgs.has(org.id)
              return (
                <div key={org.id} className="border rounded-lg">
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleOrg(org.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <Building2 className="h-5 w-5" />
                      <span className="font-semibold">{org.name}</span>
                      {getStatusBadge(org.config_last_status)}
                      {org.config_ready && <Badge variant="outline">Ready</Badge>}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        // Show config modal
                        alert(JSON.stringify(org.config, null, 2))
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                  {isExpanded && (
                    <div className="pl-8 pr-4 pb-4 space-y-2">
                      {orgVendors.map((vendor) => {
                        const isVendorExpanded = expandedVendors.has(vendor.id)
                        return (
                          <div key={vendor.id} className="border rounded-lg">
                            <div
                              className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleVendor(vendor.id)}
                            >
                              <div className="flex items-center gap-3">
                                {isVendorExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <span>{vendor.name}</span>
                                <Badge variant="outline">{vendor.vendor_type}</Badge>
                                {getStatusBadge(vendor.lastRun?.status || vendor.config_last_status)}
                                {vendor.analytics_ready && <Badge variant="outline">Analytics Ready</Badge>}
                                {vendor.analytics_last_synced_at && (
                                  <span className="text-xs text-muted-foreground">
                                    Last sync: {new Date(vendor.analytics_last_synced_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                                  </span>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  alert(JSON.stringify(vendor.config, null, 2))
                                }}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </div>
                            {isVendorExpanded && (
                              <div className="pl-8 pr-4 pb-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => router.push(`/analytics/plants?vendorId=${vendor.id}`)}
                                >
                                  View Plants
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

