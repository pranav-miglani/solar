"use client"

import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { useEffect, useState } from "react"

interface EfficiencyData {
  work_order_id: number
  plant_id: number
  recorded_at: string
  actual_gen: number
  expected_gen: number
  pr: number
  efficiency_pct: number
  category: string
  plants: {
    id: number
    name: string
  }
}

interface EfficiencySummaryProps {
  orgId: number
}

export function EfficiencySummary({ orgId }: EfficiencySummaryProps) {
  const [efficiencyData, setEfficiencyData] = useState<EfficiencyData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch efficiency data for all work orders with plants in this org
    fetch("/api/workorders")
      .then((res) => res.json())
      .then((data) => {
        const workOrders = data.workOrders || []
        // Get efficiency for each work order
        const efficiencyPromises = workOrders.map((wo: any) =>
          fetch(`/api/workorders/${wo.id}/efficiency`)
            .then((res) => res.json())
            .then((eff) => eff.efficiency || [])
            .catch(() => [])
        )

        Promise.all(efficiencyPromises).then((allEfficiency) => {
          const flattened = allEfficiency.flat()
          // Filter by org plants (in a real scenario, you'd filter server-side)
          setEfficiencyData(flattened)
          setLoading(false)
        })
      })
      .catch(() => {
        setLoading(false)
      })
  }, [orgId])

  if (loading) {
    return (
      <Card className="glass-card">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">
            Loading efficiency data...
          </p>
        </div>
      </Card>
    )
  }

  if (efficiencyData.length === 0) {
    return (
      <Card className="glass-card">
        <h3 className="text-lg font-semibold mb-4">Efficiency Summary</h3>
        <p className="text-muted-foreground text-sm">
          No efficiency data available yet.
        </p>
      </Card>
    )
  }

  // Calculate averages
  const avgEfficiency =
    efficiencyData.reduce((sum, d) => sum + d.efficiency_pct, 0) /
    efficiencyData.length

  const healthyCount = efficiencyData.filter(
    (d) => d.category === "Healthy"
  ).length
  const suboptimalCount = efficiencyData.filter(
    (d) => d.category === "Suboptimal"
  ).length
  const criticalCount = efficiencyData.filter(
    (d) => d.category === "Critical"
  ).length

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Healthy":
        return "bg-green-500/20 text-green-700 dark:text-green-400"
      case "Suboptimal":
        return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
      case "Critical":
        return "bg-red-500/20 text-red-700 dark:text-red-400"
      default:
        return "bg-gray-500/20 text-gray-700 dark:text-gray-400"
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="glass-card">
        <h3 className="text-lg font-semibold mb-4">Efficiency Summary</h3>

        {/* Average Efficiency */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Average Efficiency
            </span>
            <span className="text-2xl font-bold">{avgEfficiency.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${Math.min(avgEfficiency, 100)}%` }}
            />
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {healthyCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Healthy</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {suboptimalCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Suboptimal
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {criticalCount}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Critical</div>
          </div>
        </div>

        {/* Recent Efficiency Records */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Recent Records</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {efficiencyData.slice(0, 5).map((record, idx) => (
              <motion.div
                key={`${record.work_order_id}-${record.plant_id}-${idx}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between p-2 rounded bg-muted/50"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {record.plants?.name || `Plant ${record.plant_id}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {record.efficiency_pct.toFixed(1)}% PR: {record.pr.toFixed(3)}
                  </div>
                </div>
                <Badge className={getCategoryColor(record.category)}>
                  {record.category}
                </Badge>
              </motion.div>
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

