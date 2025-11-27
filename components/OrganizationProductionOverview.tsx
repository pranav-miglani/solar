"use client"

import { useEffect, useState } from "react"
import { ProductionOverview } from "@/components/ProductionOverview"
import { Card, CardContent } from "@/components/ui/card"
import { Building2, Zap } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

interface OrganizationProductionOverviewProps {
  orgId: number
  organizationName?: string
  accountType: string
}

export function OrganizationProductionOverview({
  orgId,
  organizationName,
  accountType,
}: OrganizationProductionOverviewProps) {
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const response = await fetch(`/api/orgs/${orgId}/production`)
        if (!response.ok) {
          throw new Error("Failed to fetch organization metrics")
        }
        const data = await response.json()
        setMetrics(data)
        setError(null)
      } catch (err) {
        console.error("Error fetching organization metrics:", err)
        setError(err instanceof Error ? err.message : "Failed to load metrics")
      } finally {
        setLoading(false)
      }
    }

    if (orgId) {
      fetchMetrics()
    }
  }, [orgId])

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-sm text-muted-foreground">Loading metrics...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !metrics) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center py-12 text-muted-foreground">
            {error || "No metrics available"}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Convert dailyEnergyKwh to MWh for display
  const dailyEnergyMwh = metrics.aggregated?.dailyEnergyKwh
    ? metrics.aggregated.dailyEnergyKwh / 1000
    : 0

  const productionMetrics = {
    installedCapacityKw: metrics.aggregated?.installedCapacityKw || 0,
    currentPowerKw: metrics.aggregated?.currentPowerKw || 0,
    dailyEnergyMwh: dailyEnergyMwh,
    monthlyEnergyMwh: metrics.aggregated?.monthlyEnergyMwh || 0,
    yearlyEnergyMwh: metrics.aggregated?.yearlyEnergyMwh || 0,
    totalEnergyMwh: metrics.aggregated?.totalEnergyMwh || 0,
    averagePerformanceRatio: metrics.aggregated?.averagePerformanceRatio || 0,
  }

  return (
    <div className="space-y-4">
      {/* Organization Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-2 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">
                  Organization
                </div>
                <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                  {organizationName || `Org #${orgId}`}
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-3">
                <Building2 className="h-full w-full text-white" />
              </div>
            </div>
            <Link href={`/orgs/${orgId}/plants`}>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4 border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Organization Plants
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border-2 border-green-200 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-green-600 dark:text-green-400 mb-1">
                  Total Plants
                </div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {metrics.totalPlants || 0}
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 p-3">
                <Zap className="h-full w-full text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 border-2 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-1">
                  Total Capacity
                </div>
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {productionMetrics.installedCapacityKw.toFixed(1)} kW
                </div>
              </div>
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 p-3">
                <Zap className="h-full w-full text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Production Overview */}
      <ProductionOverview
        metrics={productionMetrics}
        title="Organization Production Overview"
        hidePerformanceRatio={accountType === "GOVT"}
      />
    </div>
  )
}

