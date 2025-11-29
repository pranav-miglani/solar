"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { DashboardSidebar } from "@/components/DashboardSidebar"
import { DashboardMetrics } from "@/components/DashboardMetrics"
// TelemetryChart removed - telemetry is now fetched on-demand from vendor APIs
import { AlertsFeed } from "@/components/AlertsFeed"
import { EfficiencySummary } from "@/components/EfficiencySummary"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useUser } from "@/context/UserContext"
import { Building2, Factory, Plus, FileText } from "lucide-react"
import Link from "next/link"

interface DashboardData {
  role: string
  metrics: {
    totalPlants?: number
    unmappedPlants?: number
    mappedPlants?: number
    totalAlerts?: number
    activeAlerts?: number
    totalWorkOrders?: number
    totalGeneration24h?: number
    totalEnergyMwh?: number
    // Additional energy metrics for GOVT users
    dailyEnergyMwh?: number
    monthlyEnergyMwh?: number
    yearlyEnergyMwh?: number
    currentPowerKw?: number
    installedCapacityKw?: number
  }
  widgets: {
    showOrganizations?: boolean
    showVendors?: boolean
    showPlants?: boolean
    showCreateWorkOrder?: boolean
    showTelemetryChart?: boolean
    showAlertsFeed?: boolean
    showWorkOrdersSummary?: boolean
    showEfficiencySummary?: boolean
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const { account, loading: userLoading, error: userError } = useUser()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  )
  const [telemetryData, setTelemetryData] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [organizationName, setOrganizationName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const hasLoadedRef = useRef(false)

  const accountType = account?.accountType || ""
  const orgId = account?.orgId || null
  const displayName = account?.displayName || null

  const loadDashboard = async (accountType: string, orgId: number | null) => {
    try {
      console.log("📊 [DASHBOARD] Loading dashboard data for:", { accountType, orgId })
      
      // For GOVT users, skip fetching alerts since they won't see the alerts feed
      const fetchPromises: Promise<Response>[] = [fetch("/api/dashboard")]
      if (accountType !== "GOVT") {
        fetchPromises.push(fetch("/api/alerts"))
      }
      
      const responses = await Promise.all(fetchPromises)
      const dashboard = await responses[0].json()
      
      // Only fetch alerts data if we made the request (non-GOVT users)
      let alertsData = { alerts: [] }
      if (accountType !== "GOVT" && responses.length > 1) {
        alertsData = await responses[1].json()
      }

      setDashboardData(dashboard)
      setTelemetryData([]) // Telemetry is now fetched on-demand from vendor APIs
      setAlerts(alertsData.alerts || [])
      
      // Fetch organization name for ORG users
      if (accountType === "ORG" && orgId) {
        try {
          const orgRes = await fetch(`/api/orgs/${orgId}`)
          if (orgRes.ok) {
            const orgData = await orgRes.json()
            if (orgData.org) {
              setOrganizationName(orgData.org.name)
            }
          }
        } catch (error) {
          console.error("Failed to fetch organization name:", error)
        }
      }
      
      console.log("✅ [DASHBOARD] Dashboard data loaded successfully")
    } catch (error) {
      console.error("❌ [DASHBOARD] Failed to load dashboard:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Wait for user context to load
    if (userLoading) {
      return
    }

    // Check for authentication error
    if (userError || !account) {
      console.log("❌ [DASHBOARD] Authentication failed, redirecting to login")
      router.push("/auth/login")
      return
    }

    // Prevent multiple loads
    if (hasLoadedRef.current) {
      console.log("⏸️ [DASHBOARD] Already loaded, skipping...")
      return
    }
    
    hasLoadedRef.current = true
    
    console.log("✅ [DASHBOARD] User context loaded:", {
      accountType: account.accountType,
      orgId: account.orgId,
      displayName: account.displayName,
    })
    
    loadDashboard(account.accountType, account.orgId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, userError, account, router])

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return null
  }

  const { role, metrics, widgets } = dashboardData

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardSidebar />

      <div className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
        {/* Top Bar */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 md:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Welcome back, <span className="font-semibold text-foreground">
                {displayName || (role === "SUPERADMIN" ? "Super Admin" : role === "GOVT" ? "Government Agency" : "Organization")}
              </span>
            </p>
          </div>
          <ThemeToggle />
        </motion.div>

        {/* Metrics */}
        <div className="mb-8">
          <DashboardMetrics metrics={metrics} accountType={accountType} />
        </div>

        {/* Action Cards for SUPERADMIN */}
        {role === "SUPERADMIN" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          >
            {widgets.showOrganizations && (
              <Link href="/superadmin/orgs">
                <motion.div
                  whileHover={{ scale: 1.03, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-50/80 via-indigo-50/80 to-purple-50/80 dark:from-blue-950/50 dark:via-indigo-950/50 dark:to-purple-950/50 border-2 border-blue-200/50 dark:border-blue-800/50 p-6 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-2xl transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-3 mb-4 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                      <Building2 className="h-full w-full text-white" />
                    </div>
                    <h3 className="font-bold text-lg mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      Manage Organizations
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      View and manage all organizations
                    </p>
                  </div>
                </motion.div>
              </Link>
            )}

            {widgets.showVendors && (
              <Link href="/superadmin/vendors">
                <motion.div
                  whileHover={{ scale: 1.03, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-50/80 via-amber-50/80 to-yellow-50/80 dark:from-orange-950/50 dark:via-amber-950/50 dark:to-yellow-950/50 border-2 border-orange-200/50 dark:border-orange-800/50 p-6 cursor-pointer hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-2xl transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 p-3 mb-4 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                      <Factory className="h-full w-full text-white" />
                    </div>
                    <h3 className="font-bold text-lg mb-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      Manage Vendors
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Configure vendor integrations
                    </p>
                  </div>
                </motion.div>
              </Link>
            )}

            {widgets.showCreateWorkOrder && (
              <Link href="/workorders/create">
                <motion.div
                  whileHover={{ scale: 1.03, y: -4 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50/80 via-green-50/80 to-teal-50/80 dark:from-emerald-950/50 dark:via-green-950/50 dark:to-teal-950/50 border-2 border-emerald-200/50 dark:border-emerald-800/50 p-6 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-2xl transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-3 mb-4 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                      <Plus className="h-full w-full text-white" />
                    </div>
                    <h3 className="font-bold text-lg mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      Create Work Order
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Create a new work order
                    </p>
                  </div>
                </motion.div>
              </Link>
            )}

            <Link href="/workorders">
              <motion.div
                whileHover={{ scale: 1.03, y: -4 }}
                whileTap={{ scale: 0.98 }}
                className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-50/80 via-pink-50/80 to-rose-50/80 dark:from-purple-950/50 dark:via-pink-950/50 dark:to-rose-950/50 border-2 border-purple-200/50 dark:border-purple-800/50 p-6 cursor-pointer hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-2xl transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 p-3 mb-4 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                    <FileText className="h-full w-full text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                    View Work Orders
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Browse all work orders
                  </p>
                </div>
              </motion.div>
            </Link>
          </motion.div>
        )}


        {/* Efficiency Summary for ORG */}
        {role === "ORG" && widgets.showEfficiencySummary && orgId && (
          <div className="mb-8">
            <EfficiencySummary orgId={orgId} />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Telemetry Chart - Removed: Telemetry DB has been removed, telemetry is now fetched on-demand from vendor APIs */}

          {/* Alerts Feed */}
          {widgets.showAlertsFeed && (
            <AlertsFeed alerts={alerts.slice(0, 10)} />
          )}
        </div>

        {/* Work Orders Summary */}
        {widgets.showWorkOrdersSummary && (
          <div className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Link href="/workorders">
                <motion.div
                  whileHover={{ scale: 1.01, y: -2 }}
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-50/80 via-gray-50/80 to-zinc-50/80 dark:from-slate-950/50 dark:via-gray-950/50 dark:to-zinc-950/50 border-2 border-slate-200/50 dark:border-slate-800/50 p-6 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-2xl transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">
                        Recent Work Orders
                      </h3>
                      <p className="text-muted-foreground">
                        View all work orders →
                      </p>
                    </div>
                    <FileText className="h-8 w-8 text-primary opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" />
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}

