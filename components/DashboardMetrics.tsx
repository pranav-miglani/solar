"use client"

import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { TrendingUp, AlertTriangle, FileText, Zap } from "lucide-react"

interface Metric {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  change?: string
  gradient?: string
  bgGradient?: string
  borderColor?: string
}

interface DashboardMetricsProps {
  metrics: {
    totalPlants?: number
    unmappedPlants?: number
    mappedPlants?: number
    totalAlerts?: number
    activeAlerts?: number
    totalWorkOrders?: number
    totalEnergyMwh?: number
  }
  // Optional account type so we can tweak which cards appear per role (e.g. hide alerts for GOVT)
  accountType?: string
}

export function DashboardMetrics({ metrics, accountType }: DashboardMetricsProps) {
  const totalPlants = metrics.totalPlants ?? 0
  const unmappedPlants = metrics.unmappedPlants ?? 0
  const mappedPlants = metrics.mappedPlants ?? 0
  const mappedPercentage = totalPlants > 0 ? (mappedPlants / totalPlants) * 100 : 0

  // NOTE on alert counting semantics:
  // - The "Active Alerts" card now shows ONLY active alerts for every role.
  // - The dashboard API is responsible for populating `metrics.activeAlerts`
  //   as the count of alerts where status = 'ACTIVE' (no total alerts metric
  //   is exposed on the dashboard anymore).
  const metricItems: Metric[] = [
    {
      label: "Total Plants",
      value: accountType === "GOVT"
        ? mappedPlants // For GOVT users, show only mapped plants count (no unmapped)
        : totalPlants > 0 
          ? `${totalPlants} (${unmappedPlants})`
          : 0,
      icon: Zap,
      gradient: "from-blue-500 via-blue-600 to-indigo-600",
      bgGradient: "from-blue-50/80 to-indigo-50/80 dark:from-blue-950/50 dark:to-indigo-950/50",
      borderColor: "border-blue-200 dark:border-blue-800",
    },
    {
      label: "Active Alerts",
      value: metrics.activeAlerts ?? 0,
      icon: AlertTriangle,
      gradient: "from-amber-500 via-orange-500 to-red-500",
      bgGradient: "from-amber-50/80 to-red-50/80 dark:from-amber-950/50 dark:to-red-950/50",
      borderColor: "border-amber-200 dark:border-amber-800",
    },
    {
      label: "Work Orders",
      value: metrics.totalWorkOrders ?? 0,
      icon: FileText,
      gradient: "from-purple-500 via-purple-600 to-pink-600",
      bgGradient: "from-purple-50/80 to-pink-50/80 dark:from-purple-950/50 dark:to-pink-950/50",
      borderColor: "border-purple-200 dark:border-purple-800",
    },
    {
      label: "Total Energy Generation",
      value: metrics.totalEnergyMwh
        ? `${metrics.totalEnergyMwh.toFixed(1)} MWh`
        : "0 MWh",
      icon: TrendingUp,
      gradient: "from-emerald-500 via-green-500 to-teal-500",
      bgGradient: "from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/50 dark:to-teal-950/50",
      borderColor: "border-emerald-200 dark:border-emerald-800",
    },
  ]

  // GOVT users should not see the Active Alerts card on the dashboard.
  const visibleMetricItems =
    accountType === "GOVT"
      ? metricItems.filter((m) => m.label !== "Active Alerts")
      : metricItems

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {visibleMetricItems.map((metric, index) => {
        const Icon = metric.icon
        return (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: index * 0.1, type: "spring", stiffness: 100 }}
            whileHover={{ scale: 1.02, y: -2 }}
          >
            <Card className={`relative overflow-hidden bg-gradient-to-br ${metric.bgGradient || 'from-background to-muted/50'} border-2 ${metric.borderColor || 'border-border'} hover:shadow-2xl transition-all duration-300 group`}>
              {/* Animated gradient overlay on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${metric.gradient || 'from-primary to-primary/60'} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
              
              <div className="relative p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      {metric.label}
                    </p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                      {metric.value}
                    </p>
                  </div>
                  <div className={`relative h-12 w-12 rounded-xl bg-gradient-to-br ${metric.gradient || 'from-primary to-primary/60'} p-2.5 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110`}>
                    {metric.label === "Total Plants" && totalPlants > 0 && accountType !== "GOVT" ? (
                      <>
                        {/* Background icon (unmapped portion - always visible) */}
                        <Zap className="absolute inset-0 h-full w-full text-white opacity-30 p-2.5" />
                        {/* Filled icon (mapped portion - revealed from bottom) */}
                        <Zap 
                          className="absolute inset-0 h-full w-full text-white fill-white p-2.5"
                          style={{
                            maskImage: `linear-gradient(to top, black ${mappedPercentage}%, transparent ${mappedPercentage}%)`,
                            WebkitMaskImage: `linear-gradient(to top, black ${mappedPercentage}%, transparent ${mappedPercentage}%)`,
                          }}
                        />
                      </>
                    ) : (
                      <Icon className="h-full w-full text-white" />
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

