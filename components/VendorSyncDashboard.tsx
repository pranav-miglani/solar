"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Factory,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Building2,
  Activity,
  Play,
  AlertTriangle,
  PauseCircle,
  Power,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"

interface Vendor {
  id: number
  name: string
  vendor_type: string
  is_active: boolean
  last_synced_at: string | null
  created_at: string
  organizations: {
    id: number
    name: string
    auto_sync_enabled: boolean | null
    sync_interval_minutes: number | null
  } | null
}

export function VendorSyncDashboard() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [syncing, setSyncing] = useState(false)
  const [cronStatus, setCronStatus] = useState<{
    inRestrictedWindow: boolean
    currentTimeIST: string
    nextSyncTime: string
    restrictedWindowStart: string
    restrictedWindowEnd: string
  } | null>(null)

  useEffect(() => {
    fetchVendorSyncStatus()
    calculateCronStatus()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchVendorSyncStatus()
      calculateCronStatus()
    }, 30000)
    
    // Update cron status every minute to show current time
    const timeInterval = setInterval(() => {
      calculateCronStatus()
    }, 60000)

    return () => {
      clearInterval(interval)
      clearInterval(timeInterval)
    }
  }, [])

  async function fetchVendorSyncStatus() {
    try {
      const response = await fetch("/api/vendors/sync-status")
      if (response.ok) {
        const data = await response.json()
        setVendors(data.vendors || [])
        setLastRefresh(new Date())
        
        // Calculate cron status
        calculateCronStatus()
      }
    } catch (error) {
      console.error("Error fetching vendor sync status:", error)
    } finally {
      setLoading(false)
    }
  }

  function calculateCronStatus() {
    const now = new Date()
    const kolkataTime24 = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now)
    
    const kolkataTime12 = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(now)
    
    const currentHour = parseInt(kolkataTime24.find((p) => p.type === "hour")?.value || "0")
    const currentMinute = parseInt(kolkataTime24.find((p) => p.type === "minute")?.value || "0")
    const currentTimeMinutes = currentHour * 60 + currentMinute
    
    // Format in 12-hour format
    const hour12 = kolkataTime12.find((p) => p.type === "hour")?.value || "12"
    const minute12 = kolkataTime12.find((p) => p.type === "minute")?.value || "00"
    const dayPeriod = kolkataTime12.find((p) => p.type === "dayPeriod")?.value || "AM"
    const currentTimeIST = `${hour12}:${minute12} ${dayPeriod}`
    
    // Restricted window: 7 PM (19:00) to 6 AM (06:00) IST
    // Keep internal calculation in 24-hour format
    const syncWindowStart24 = "19:00"
    const syncWindowEnd24 = "06:00"
    const [startHour, startMin] = syncWindowStart24.split(":").map(Number)
    const [endHour, endMin] = syncWindowEnd24.split(":").map(Number)
    const startTimeMinutes = startHour * 60 + startMin
    const endTimeMinutes = endHour * 60 + endMin
    
    // Display format in 12-hour format
    const syncWindowStart = "7:00 PM"
    const syncWindowEnd = "6:00 AM"
    
    // Check if in restricted window
    let inRestrictedWindow = false
    if (startTimeMinutes > endTimeMinutes) {
      // Window spans midnight
      inRestrictedWindow = currentTimeMinutes >= startTimeMinutes || currentTimeMinutes < endTimeMinutes
    } else {
      // Normal window
      inRestrictedWindow = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes
    }
    
    // Calculate next sync time in 12-hour format
    let nextSyncTime = ""
    if (inRestrictedWindow) {
      // If we're in restricted window, next sync is at 6 AM (06:00) IST
      if (currentTimeMinutes >= startTimeMinutes) {
        // We're after 7 PM, next sync is tomorrow at 6 AM
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(6, 0, 0, 0)
        const nextKolkataTime = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        }).formatToParts(tomorrow)
        const nextHour12 = nextKolkataTime.find((p) => p.type === "hour")?.value || "6"
        const nextMin12 = nextKolkataTime.find((p) => p.type === "minute")?.value || "00"
        const nextDayPeriod = nextKolkataTime.find((p) => p.type === "dayPeriod")?.value || "AM"
        nextSyncTime = `${nextHour12}:${nextMin12} ${nextDayPeriod} IST (tomorrow)`
      } else {
        // We're before 6 AM, next sync is today at 6 AM
        nextSyncTime = "6:00 AM IST (today)"
      }
    } else {
      // Not in restricted window, next sync is at next 15-minute interval
      const nextInterval = Math.ceil(currentMinute / 15) * 15
      let nextHour = currentHour
      if (nextInterval >= 60) {
        nextHour = (currentHour + 1) % 24
      }
      
      // Convert to 12-hour format
      const nextTime = new Date(now)
      if (nextInterval >= 60) {
        nextTime.setHours(nextHour, 0, 0, 0)
      } else {
        nextTime.setHours(currentHour, nextInterval, 0, 0)
      }
      
      const nextKolkataTime = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).formatToParts(nextTime)
      const nextHour12 = nextKolkataTime.find((p) => p.type === "hour")?.value || "12"
      const nextMin12 = nextKolkataTime.find((p) => p.type === "minute")?.value || "00"
      const nextDayPeriod = nextKolkataTime.find((p) => p.type === "dayPeriod")?.value || "AM"
      nextSyncTime = `${nextHour12}:${nextMin12} ${nextDayPeriod} IST`
    }
    
    setCronStatus({
      inRestrictedWindow,
      currentTimeIST,
      nextSyncTime,
      restrictedWindowStart: syncWindowStart,
      restrictedWindowEnd: syncWindowEnd,
    })
  }

  async function triggerManualSync() {
    setSyncing(true)
    try {
      const response = await fetch("/api/cron/sync-plants", {
        method: "POST",
      })
      const data = await response.json()
      if (response.ok) {
        alert(`Sync completed successfully!\n\nTotal vendors: ${data.summary?.totalVendors || 0}\nSuccessful: ${data.summary?.successful || 0}\nFailed: ${data.summary?.failed || 0}\nPlants synced: ${data.summary?.totalPlantsSynced || 0}`)
        // Refresh status after sync
        setTimeout(() => fetchVendorSyncStatus(), 2000)
      } else {
        alert(`Sync failed: ${data.error || "Unknown error"}`)
      }
    } catch (error: any) {
      alert(`Error triggering sync: ${error.message}`)
    } finally {
      setSyncing(false)
    }
  }

  const getSyncStatusBadge = (vendor: Vendor) => {
    if (!vendor.is_active) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
          <XCircle className="h-3 w-3" />
          Inactive
        </Badge>
      )
    }

    if (!vendor.last_synced_at) {
      return (
        <Badge variant="outline" className="flex items-center gap-1 w-fit">
          <Clock className="h-3 w-3" />
          Never Synced
        </Badge>
      )
    }

    const lastSync = new Date(vendor.last_synced_at)
    const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60)

    if (hoursSinceSync < 1) {
      return (
        <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30 flex items-center gap-1 w-fit">
          <CheckCircle2 className="h-3 w-3" />
          Synced Recently
        </Badge>
      )
    } else if (hoursSinceSync < 24) {
      return (
        <Badge variant="default" className="flex items-center gap-1 w-fit">
          <Activity className="h-3 w-3" />
          Synced Today
        </Badge>
      )
    } else {
      return (
        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
          <Clock className="h-3 w-3" />
          Stale
        </Badge>
      )
    }
  }

  const getLastSyncText = (lastSyncedAt: string | null) => {
    if (!lastSyncedAt) {
      return "Never"
    }

    const lastSync = new Date(lastSyncedAt)
    const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60)

    if (hoursSinceSync < 1) {
      return `${Math.round((Date.now() - lastSync.getTime()) / (1000 * 60))} minutes ago`
    } else if (hoursSinceSync < 24) {
      return `${Math.round(hoursSinceSync)} hours ago`
    } else {
      return formatDistanceToNow(lastSync, { addSuffix: true })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading vendor sync status...</p>
        </div>
      </div>
    )
  }

  const activeVendors = vendors.filter((v) => v.is_active)
  const syncedRecently = vendors.filter(
    (v) =>
      v.is_active &&
      v.last_synced_at &&
      (Date.now() - new Date(v.last_synced_at).getTime()) / (1000 * 60 * 60) < 1
  )
  const neverSynced = vendors.filter((v) => v.is_active && !v.last_synced_at)

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  Total Vendors
                </p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {vendors.length}
                </p>
              </div>
              <Factory className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  Active Vendors
                </p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {activeVendors.length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                  Synced Recently
                </p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {syncedRecently.length}
                </p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                  Never Synced
                </p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {neverSynced.length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cron Status Alert */}
      {cronStatus && (
        <Card className={`shadow-lg border-l-4 ${
          cronStatus.inRestrictedWindow 
            ? "bg-amber-50/50 dark:bg-amber-950/20 border-l-amber-500 dark:border-l-amber-400" 
            : "bg-green-50/50 dark:bg-green-950/20 border-l-green-500 dark:border-l-green-400"
        }`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              {cronStatus.inRestrictedWindow ? (
                <PauseCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              ) : (
                <Power className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={`font-semibold ${
                    cronStatus.inRestrictedWindow 
                      ? "text-amber-900 dark:text-amber-100" 
                      : "text-green-900 dark:text-green-100"
                  }`}>
                    Auto-Sync Status
                  </h3>
                  <Badge 
                    variant="outline" 
                    className={
                      cronStatus.inRestrictedWindow
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700"
                        : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700"
                    }
                  >
                    {cronStatus.inRestrictedWindow ? "Paused" : "Active"}
                  </Badge>
                </div>
                {cronStatus.inRestrictedWindow ? (
                  <div className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
                    <p>
                      Auto-sync is <strong>paused</strong> during restricted hours ({cronStatus.restrictedWindowStart} - {cronStatus.restrictedWindowEnd} IST).
                    </p>
                    <p>
                      Current time: <strong>{cronStatus.currentTimeIST} IST</strong> | Next auto-sync: <strong>{cronStatus.nextSyncTime}</strong>
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                      💡 You can still trigger manual sync using the "Trigger Sync Now" button below.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 text-sm text-green-800 dark:text-green-200">
                    <p>
                      Auto-sync is <strong>active</strong> and running every 15 minutes.
                    </p>
                    <p>
                      Current time: <strong>{cronStatus.currentTimeIST} IST</strong> | Next sync: <strong>{cronStatus.nextSyncTime}</strong>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vendor Sync Table */}
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl md:text-2xl">Vendor Sync Status</CardTitle>
          <div className="flex items-center gap-3">
            <Button
              onClick={triggerManualSync}
              disabled={syncing}
              size="sm"
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              {syncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Trigger Sync Now
                </>
              )}
            </Button>
            <button
              onClick={fetchVendorSyncStatus}
              className="p-2 hover:bg-muted rounded-md transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <span className="text-xs text-muted-foreground">
              Last updated: {format(lastRefresh, "HH:mm:ss")}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop Table View */}
          <div className="hidden lg:block rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Vendor Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Auto-Sync</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Synced</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No vendors found
                    </TableCell>
                  </TableRow>
                ) : (
                  vendors.map((vendor, index) => {
                    // Check if vendor requires manual sync (auto-sync disabled)
                    const requiresManualSync = !vendor.organizations?.auto_sync_enabled
                    
                    return (
                    <TableRow
                      key={vendor.id}
                      className={`hover:bg-muted/50 ${
                        requiresManualSync 
                          ? "bg-amber-50/50 dark:bg-amber-950/20 border-l-4 border-l-amber-500 dark:border-l-amber-400" 
                          : ""
                      }`}
                      style={{
                        animationDelay: `${index * 50}ms`,
                      }}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 p-2">
                            <Factory className="h-full w-full text-white" />
                          </div>
                          <div className="flex items-center gap-2">
                            <span>{vendor.name}</span>
                            {requiresManualSync && (
                              <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 flex items-center gap-1 text-xs">
                                <AlertTriangle className="h-3 w-3" />
                                Manual Only
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{vendor.vendor_type}</Badge>
                      </TableCell>
                      <TableCell>
                        {vendor.organizations ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{vendor.organizations.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {vendor.organizations ? (
                          vendor.organizations.auto_sync_enabled ? (
                            <Badge variant="default" className="flex items-center gap-1 w-fit">
                              <CheckCircle2 className="h-3 w-3" />
                              Enabled ({vendor.organizations.sync_interval_minutes || 15}m)
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="flex items-center gap-1 w-fit bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                              <XCircle className="h-3 w-3" />
                              Disabled
                            </Badge>
                          )
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>{getSyncStatusBadge(vendor)}</TableCell>
                      <TableCell>
                        {vendor.last_synced_at ? (
                          <div className="space-y-1">
                            <div className="text-sm font-medium">
                              {getLastSyncText(vendor.last_synced_at)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(vendor.last_synced_at), "PPp")}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                    </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3">
            {vendors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No vendors found
              </div>
            ) : (
              vendors.map((vendor) => {
                // Check if vendor requires manual sync (auto-sync disabled)
                const requiresManualSync = !vendor.organizations?.auto_sync_enabled
                
                return (
                <Card 
                  key={vendor.id} 
                  className={`p-4 ${
                    requiresManualSync 
                      ? "bg-amber-50/50 dark:bg-amber-950/20 border-l-4 border-l-amber-500 dark:border-l-amber-400" 
                      : ""
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 p-2.5">
                          <Factory className="h-full w-full text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-base">{vendor.name}</h3>
                            {requiresManualSync && (
                              <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 flex items-center gap-1 text-xs">
                                <AlertTriangle className="h-3 w-3" />
                                Manual Only
                              </Badge>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs mt-1">
                            {vendor.vendor_type}
                          </Badge>
                        </div>
                      </div>
                      {getSyncStatusBadge(vendor)}
                    </div>
                    {vendor.organizations && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Organization:</span>
                        <span className="font-medium">{vendor.organizations.name}</span>
                      </div>
                    )}
                    <div className="space-y-2 text-sm border-t pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Auto-Sync:</span>
                        {vendor.organizations ? (
                          vendor.organizations.auto_sync_enabled ? (
                            <Badge variant="default" className="text-xs">
                              Enabled ({vendor.organizations.sync_interval_minutes || 15}m)
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                              Disabled
                            </Badge>
                          )
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Last Synced:</span>
                        {vendor.last_synced_at ? (
                          <div className="text-right">
                            <div className="font-medium">
                              {getLastSyncText(vendor.last_synced_at)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(vendor.last_synced_at), "PPp")}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

