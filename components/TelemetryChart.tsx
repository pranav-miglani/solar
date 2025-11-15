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
      <Card className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-50/80 via-gray-50/80 to-zinc-50/80 dark:from-slate-950/50 dark:via-gray-950/50 dark:to-zinc-950/50 border-2 border-slate-200/50 dark:border-slate-800/50 p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10 opacity-50" />
        <div className="relative">
          <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {title}
          </h3>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No telemetry data available
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-50/80 via-gray-50/80 to-zinc-50/80 dark:from-slate-950/50 dark:via-gray-950/50 dark:to-zinc-950/50 border-2 border-slate-200/50 dark:border-slate-800/50 p-6 hover:shadow-2xl transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10 opacity-50" />
      <div className="relative">
        <h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          {title}
        </h3>
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
              stroke="url(#colorGradient)"
              strokeWidth={3}
            dot={false}
              activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
            name="Generation (kW)"
          />
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              </linearGradient>
            </defs>
        </LineChart>
      </ResponsiveContainer>
      </div>
    </Card>
  )
}
