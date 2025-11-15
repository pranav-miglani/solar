"use client"

import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { TrendingUp, AlertTriangle, FileText, Zap } from "lucide-react"

interface Metric {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  change?: string
}

interface DashboardMetricsProps {
  metrics: {
    totalPlants?: number
    totalAlerts?: number
    activeAlerts?: number
    totalWorkOrders?: number
    totalGeneration24h?: number
  }
}

export function DashboardMetrics({ metrics }: DashboardMetricsProps) {
  const metricItems: Metric[] = [
    {
      label: "Total Plants",
      value: metrics.totalPlants ?? 0,
      icon: Zap,
    },
    {
      label: "Active Alerts",
      value: metrics.activeAlerts ?? metrics.totalAlerts ?? 0,
      icon: AlertTriangle,
    },
    {
      label: "Work Orders",
      value: metrics.totalWorkOrders ?? 0,
      icon: FileText,
    },
    {
      label: "24h Generation",
      value: metrics.totalGeneration24h
        ? `${(metrics.totalGeneration24h / 1000).toFixed(1)} MWh`
        : "0 MWh",
      icon: TrendingUp,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metricItems.map((metric, index) => {
        const Icon = metric.icon
        return (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="glass-card hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {metric.label}
                  </p>
                  <p className="text-2xl font-bold mt-1">{metric.value}</p>
                </div>
                <Icon className="h-8 w-8 text-primary opacity-50" />
              </div>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

