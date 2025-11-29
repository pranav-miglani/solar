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
import { Sun, Moon } from "lucide-react"

interface TelemetryData {
  ts: string
  generation_power_kw?: number
  power_kw?: number
  plant_id?: number
}

interface TelemetryChartProps {
  data: TelemetryData[]
  title?: string
  statistics?: {
    dailyGenerationKwh?: number
    fullPowerHoursDay?: number
  }
  showAreaFill?: boolean
}

export function TelemetryChart({ 
  data, 
  title = "Telemetry (24h)",
  statistics,
  showAreaFill = true,
}: TelemetryChartProps) {
  // Generate X-axis ticks for 24-hour range (every 3 hours)
  const xAxisTicks = useMemo(() => {
    const ticks: string[] = []
    for (let i = 0; i <= 24; i += 3) {
      ticks.push(`${i.toString().padStart(2, "0")}:00`)
    }
    return ticks
  }, [])

  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return []
    }

    // Process data points - use power_kw or generation_power_kw
    return data
      .map((point) => {
        const timestamp = new Date(point.ts)
        const power = Number(point.power_kw ?? point.generation_power_kw ?? 0)
        
        return {
          time: format(timestamp, "HH:mm"),
          fullTime: format(timestamp, "yyyy-MM-dd HH:mm:ss"),
          timestamp: timestamp.getTime(),
          power: Math.round(power * 100) / 100,
          hour: timestamp.getHours(),
        }
      })
      .sort((a, b) => a.timestamp - b.timestamp)
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

  // Custom tooltip to show timestamp and power
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const powerValue = payload[0].value
      const powerDisplay = (powerValue !== null && powerValue !== undefined && typeof powerValue === 'number')
        ? powerValue.toFixed(2)
        : '0.00'
      
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold mb-1">{data.fullTime}</p>
          <p className="text-sm">
            <span className="font-medium text-blue-600 dark:text-blue-400">Solar Power:</span>{" "}
            {powerDisplay} kW
          </p>
        </div>
      )
    }
    return null
  }

  // Determine if hour is daytime (6 AM to 6 PM)
  const isDaytime = (hour: number) => hour >= 6 && hour < 18

  return (
    <Card className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-50/80 via-gray-50/80 to-zinc-50/80 dark:from-slate-950/50 dark:via-gray-950/50 dark:to-zinc-950/50 border-2 border-slate-200/50 dark:border-slate-800/50 p-6 hover:shadow-2xl transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10 opacity-50" />
      <div className="relative">
        <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          {title}
        </h3>
        
        {/* Statistics */}
        {statistics && (
          <div className="flex gap-6 mb-4 text-sm">
            {statistics.dailyGenerationKwh !== undefined && 
             statistics.dailyGenerationKwh !== null && 
             typeof statistics.dailyGenerationKwh === 'number' && (
              <div>
                <span className="text-muted-foreground">Daily Production: </span>
                <span className="font-semibold">{statistics.dailyGenerationKwh.toFixed(1)} kWh</span>
              </div>
            )}
            {statistics.fullPowerHoursDay !== undefined && 
             statistics.fullPowerHoursDay !== null && 
             typeof statistics.fullPowerHoursDay === 'number' && (
              <div>
                <span className="text-muted-foreground">Peak Hours Today: </span>
                <span className="font-semibold">{statistics.fullPowerHoursDay.toFixed(2)} h</span>
              </div>
            )}
          </div>
        )}

        <ResponsiveContainer width="100%" height={300}>
          {showAreaFill ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="time"
                tick={{ fill: "currentColor", fontSize: 12 }}
                className="text-xs"
                ticks={xAxisTicks}
                interval={0}
              />
              <YAxis
                tick={{ fill: "currentColor", fontSize: 12 }}
                className="text-xs"
                label={{ value: "kW", angle: -90, position: "insideLeft", style: { textAnchor: "middle" } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="power"
                stroke="#3b82f6"
                strokeWidth={3}
                fill="url(#colorGradient)"
                name="Solar Power"
                dot={false}
                activeDot={{ r: 6, fill: "#3b82f6" }}
              />
            </AreaChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="time"
                tick={{ fill: "currentColor", fontSize: 12 }}
                className="text-xs"
                ticks={xAxisTicks}
                interval={0}
              />
              <YAxis
                tick={{ fill: "currentColor", fontSize: 12 }}
                className="text-xs"
                label={{ value: "kW", angle: -90, position: "insideLeft", style: { textAnchor: "middle" } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="power"
                stroke="url(#colorGradient)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: "#3b82f6" }}
                name="Solar Power"
              />
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.3} />
                </linearGradient>
              </defs>
            </LineChart>
          )}
        </ResponsiveContainer>

        {/* Day/Night Indicators */}
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Moon className="h-3 w-3" />
            <span>Night</span>
          </div>
          <div className="flex items-center gap-1">
            <Sun className="h-3 w-3" />
            <span>Day</span>
          </div>
        </div>
      </div>
    </Card>
  )
}
