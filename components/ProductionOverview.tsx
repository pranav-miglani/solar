"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ProductionMetrics {
  installedCapacityKw?: number | null
  currentPowerKw?: number | null
  dailyEnergyMwh?: number | null
  monthlyEnergyMwh?: number | null
  yearlyEnergyMwh?: number | null
  totalEnergyMwh?: number | null
}

interface ProductionOverviewProps {
  metrics: ProductionMetrics
  lastUpdated?: string
  title?: string
}

export function ProductionOverview({
  metrics,
  lastUpdated,
  title = "Production Overview",
}: ProductionOverviewProps) {
  const formatValue = (
    value?: number | null,
    fractionDigits = 3,
    fallback = "0.000"
  ) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return fallback
    }
    return Number(value).toFixed(fractionDigits)
  }

  // Calculate current power percentage of installed capacity
  const currentPowerPercentage =
    (metrics.installedCapacityKw || 0) > 0 && metrics.currentPowerKw !== null && metrics.currentPowerKw !== undefined
      ? formatValue(
          ((metrics.currentPowerKw || 0) /
            (metrics.installedCapacityKw || 1)) *
            100
        )
      : "0.000"

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-bold text-blue-600">
            {title}
          </CardTitle>
          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Updated: {new Date(lastUpdated).toLocaleString()}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <div className="text-sm text-blue-600 font-medium">
                Current Power
              </div>
              <div className="text-2xl font-bold text-blue-700 mt-1">
                {formatValue(metrics.currentPowerKw)} kW
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4">
              <div className="text-sm text-green-600 font-medium">
                Installed Capacity
              </div>
              <div className="text-2xl font-bold text-green-700 mt-1">
                {formatValue(metrics.installedCapacityKw)} KWp
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Energy Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <div className="text-sm text-blue-600 font-medium">
                Daily Energy
              </div>
              <div className="text-xl font-bold text-blue-700 mt-1">
                {formatValue(metrics.dailyEnergyMwh)} MWh
              </div>
            </CardContent>
          </Card>

          <Card className="bg-pink-50 border-pink-200">
            <CardContent className="pt-4">
              <div className="text-sm text-pink-600 font-medium">
                Monthly Energy
              </div>
              <div className="text-xl font-bold text-pink-700 mt-1">
                {formatValue(metrics.monthlyEnergyMwh)} MWh
              </div>
            </CardContent>
          </Card>

          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="pt-4">
              <div className="text-sm text-yellow-600 font-medium">
                Yearly Energy
              </div>
              <div className="text-xl font-bold text-yellow-700 mt-1">
                {formatValue(metrics.yearlyEnergyMwh)} MWh
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4">
              <div className="text-sm text-green-600 font-medium">
                Total Energy
              </div>
              <div className="text-xl font-bold text-green-700 mt-1">
                {formatValue(metrics.totalEnergyMwh)} MWh
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}

