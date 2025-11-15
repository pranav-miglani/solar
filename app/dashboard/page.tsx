"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { DashboardSidebar } from "@/components/DashboardSidebar"
import { DashboardMetrics } from "@/components/DashboardMetrics"
import { TelemetryChart } from "@/components/TelemetryChart"
import { AlertsFeed } from "@/components/AlertsFeed"
import { EfficiencySummary } from "@/components/EfficiencySummary"
import { OrgBreakdown } from "@/components/OrgBreakdown"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Button } from "@/components/ui/button"
import {
  Building2,
  Factory,
  Plus,
  FileText,
  Download,
} from "lucide-react"
import Link from "next/link"

interface DashboardData {
  role: string
  metrics: {
    totalPlants?: number
    totalAlerts?: number
    activeAlerts?: number
    totalWorkOrders?: number
    totalGeneration24h?: number
  }
  widgets: {
    showOrganizations?: boolean
    showVendors?: boolean
    showPlants?: boolean
    showCreateWorkOrder?: boolean
    showTelemetryChart?: boolean
    showAlertsFeed?: boolean
    showWorkOrdersSummary?: boolean
    showOrgBreakdown?: boolean
    showExportCSV?: boolean
    showEfficiencySummary?: boolean
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  )
  const [telemetryData, setTelemetryData] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [accountType, setAccountType] = useState<string>("")
  const [orgId, setOrgId] = useState<number | null>(null)

  useEffect(() => {
    // Check authentication
    fetch("/api/me")
      .then((res) => {
        if (!res.ok) {
          router.push("/auth/login")
          return null
        }
        return res.json()
      })
      .then((data) => {
        if (data) {
          setAccountType(data.account.accountType)
          setOrgId(data.account.orgId)
          loadDashboard(data.account.accountType, data.account.orgId)
        }
      })
      .catch(() => {
        router.push("/auth/login")
      })
  }, [router])

  const loadDashboard = async (accountType: string, orgId: number | null) => {
    try {
      const [dashboardRes, telemetryRes, alertsRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch(
          accountType === "GOVT"
            ? "/api/telemetry/global"
            : accountType === "ORG" && orgId
            ? `/api/telemetry/org/${orgId}`
            : "/api/telemetry/global"
        ),
        fetch("/api/alerts"),
      ])

      const dashboard = await dashboardRes.json()
      const telemetry = await telemetryRes.json()
      const alertsData = await alertsRes.json()

      setDashboardData(dashboard)
      setTelemetryData(telemetry.data || [])
      setAlerts(alertsData.alerts || [])
    } catch (error) {
      console.error("Failed to load dashboard:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
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
      <DashboardSidebar accountType={accountType} />

      <div className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
        {/* Top Bar */}
        <div className="mb-6 md:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Welcome back, {role === "SUPERADMIN" ? "Super Admin" : role === "GOVT" ? "Government Agency" : "Organization"}
            </p>
          </div>
          <ThemeToggle />
        </div>

        {/* Metrics */}
        <div className="mb-8">
          <DashboardMetrics metrics={metrics} />
        </div>

        {/* Action Cards for SUPERADMIN */}
        {role === "SUPERADMIN" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          >
            {widgets.showOrganizations && (
              <Link href="/superadmin/orgs">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="glass-card cursor-pointer"
                >
                  <Building2 className="h-8 w-8 text-primary mb-2" />
                  <h3 className="font-semibold">Manage Organizations</h3>
                  <p className="text-sm text-muted-foreground">
                    View and manage all organizations
                  </p>
                </motion.div>
              </Link>
            )}

            {widgets.showVendors && (
              <Link href="/superadmin/vendors">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="glass-card cursor-pointer"
                >
                  <Factory className="h-8 w-8 text-primary mb-2" />
                  <h3 className="font-semibold">Manage Vendors</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure vendor integrations
                  </p>
                </motion.div>
              </Link>
            )}

            {widgets.showCreateWorkOrder && (
              <Link href="/workorders/create">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="glass-card cursor-pointer"
                >
                  <Plus className="h-8 w-8 text-primary mb-2" />
                  <h3 className="font-semibold">Create Work Order</h3>
                  <p className="text-sm text-muted-foreground">
                    Create a new work order
                  </p>
                </motion.div>
              </Link>
            )}

            <Link href="/workorders">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="glass-card cursor-pointer"
              >
                <FileText className="h-8 w-8 text-primary mb-2" />
                <h3 className="font-semibold">View Work Orders</h3>
                <p className="text-sm text-muted-foreground">
                  Browse all work orders
                </p>
              </motion.div>
            </Link>
          </motion.div>
        )}

        {/* Export CSV for GOVT */}
        {role === "GOVT" && widgets.showExportCSV && (
          <div className="mb-8">
            <Button
              className="glass"
              onClick={() => {
                window.location.href = "/api/export/csv"
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        )}

        {/* Org Breakdown for GOVT */}
        {role === "GOVT" && widgets.showOrgBreakdown && (
          <div className="mb-8">
            <OrgBreakdown />
          </div>
        )}

        {/* Efficiency Summary for ORG */}
        {role === "ORG" && widgets.showEfficiencySummary && orgId && (
          <div className="mb-8">
            <EfficiencySummary orgId={orgId} />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Telemetry Chart */}
          {widgets.showTelemetryChart && (
            <TelemetryChart
              data={telemetryData}
              title={
                role === "GOVT"
                  ? "Global Telemetry (24h)"
                  : role === "ORG"
                  ? "Organization Telemetry (24h)"
                  : "System Telemetry (24h)"
              }
            />
          )}

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
                <div className="glass-card p-6 cursor-pointer hover:shadow-xl transition-shadow">
                  <h3 className="text-lg font-semibold mb-4">
                    Recent Work Orders
                  </h3>
                  <p className="text-muted-foreground">
                    View all work orders →
                  </p>
                </div>
              </Link>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}

