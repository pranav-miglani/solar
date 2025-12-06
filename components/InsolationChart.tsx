"use client"

import { useMemo } from "react"
import {
  LineChart,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card } from "@/components/ui/card"
import { format } from "date-fns"
import { Sun } from "lucide-react"

interface InsolationData {
  reading_date: string
  insolation_value: number
  reading_count?: number
  metadata?: {
    min_irr?: number
    max_irr?: number
    hourly_readings?: Array<{
      hour: string
      irr: number
    }>
  }
}

interface InsolationChartProps {
  data: InsolationData[]
  title?: string
  statistics?: {
    averageInsolation?: number
    minInsolation?: number
    maxInsolation?: number
    totalDays?: number
  }
  showAreaFill?: boolean
  period?: "day" | "week" | "month" | "range"
}

export function InsolationChart({ 
  data, 
  title = "Insolation Data",
  statistics,
  showAreaFill = true,
  period = "range",
}: InsolationChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return []
    }

    return data
      .map((point) => {
        if (!point) return null
        const date = new Date(point.reading_date)
        const insolation = point.insolation_value ?? 0
        
        return {
          date: point.reading_date,
          dateLabel: format(date, "MMM dd"),
          insolation: Math.round(insolation * 100) / 100,
          timestamp: date.getTime(),
        }
      })
      .filter((point): point is NonNullable<typeof point> => point !== null)
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [data])

  if (chartData.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sun className="h-5 w-5 text-yellow-500" />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          No insolation data available
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sun className="h-5 w-5 text-yellow-500" />
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        {statistics && (
          <div className="flex gap-4 text-sm">
            {statistics.averageInsolation !== undefined && (
              <div>
                <span className="text-muted-foreground">Avg: </span>
                <span className="font-medium">{statistics.averageInsolation.toFixed(2)} kWh/m²</span>
              </div>
            )}
            {statistics.minInsolation !== undefined && (
              <div>
                <span className="text-muted-foreground">Min: </span>
                <span className="font-medium">{statistics.minInsolation.toFixed(2)} kWh/m²</span>
              </div>
            )}
            {statistics.maxInsolation !== undefined && (
              <div>
                <span className="text-muted-foreground">Max: </span>
                <span className="font-medium">{statistics.maxInsolation.toFixed(2)} kWh/m²</span>
              </div>
            )}
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={400}>
        {showAreaFill ? (
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              label={{ value: "Insolation (kWh/m²)", angle: -90, position: "insideLeft" }}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-lg">
                      <p className="font-medium">{data.date}</p>
                      <p className="text-sm text-muted-foreground">
                        Insolation: <span className="font-medium text-foreground">{data.insolation} kWh/m²</span>
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="insolation"
              stroke="#f59e0b"
              fill="#fbbf24"
              fillOpacity={0.6}
              strokeWidth={2}
              name="Insolation (kWh/m²)"
            />
          </AreaChart>
        ) : (
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="dateLabel"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              label={{ value: "Insolation (kWh/m²)", angle: -90, position: "insideLeft" }}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-lg">
                      <p className="font-medium">{data.date}</p>
                      <p className="text-sm text-muted-foreground">
                        Insolation: <span className="font-medium text-foreground">{data.insolation} kWh/m²</span>
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="insolation"
              stroke="#f59e0b"
              strokeWidth={2}
              name="Insolation (kWh/m²)"
            />
          </LineChart>
        )}
      </ResponsiveContainer>

      {statistics && statistics.totalDays !== undefined && (
        <div className="mt-4 text-sm text-muted-foreground text-center">
          Showing {statistics.totalDays} day{statistics.totalDays !== 1 ? "s" : ""} of data
        </div>
      )}
    </Card>
  )
}

