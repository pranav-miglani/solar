"use client"

import { useMemo } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card } from "@/components/ui/card"
import { format } from "date-fns"

interface TelemetryData {
  ts: string
  generation_power_kw: number
  plant_id?: number
}

interface TelemetryChartProps {
  data: TelemetryData[]
  title?: string
}

export function TelemetryChart({ data, title = "Telemetry (24h)" }: TelemetryChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return []
    }

    // Group by timestamp and aggregate
    const grouped = new Map<string, number>()

    for (const point of data) {
      const timestamp = new Date(point.ts)
      const key = format(timestamp, "HH:mm")
      const current = grouped.get(key) || 0
      grouped.set(key, current + (Number(point.generation_power_kw) || 0))
    }

    return Array.from(grouped.entries())
      .map(([time, power]) => ({
        time,
            power: Math.round(Number(power) * 100) / 100,
      }))
      .sort((a, b) => a.time.localeCompare(b.time))
  }, [data])

  if (chartData.length === 0) {
    return (
      <Card className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No telemetry data available
        </div>
      </Card>
    )
  }

  return (
    <Card className="glass-card p-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="time"
            tick={{ fill: "currentColor" }}
            className="text-xs"
          />
          <YAxis
            tick={{ fill: "currentColor" }}
            className="text-xs"
            label={{ value: "kW", angle: -90, position: "insideLeft" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="power"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            name="Generation (kW)"
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
}
