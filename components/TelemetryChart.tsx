"use client"

import { useMemo } from "react"
import {
  LineChart,
  Line,
  Area,
  AreaChart,
  BarChart,
  Bar,
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
  daily_generation_kwh?: number // For month view: daily generation in kWh
  day?: number // For month view: day of month
  monthly_generation_kwh?: number // For year view: monthly generation in kWh
  month?: number // For year view: month (1-12)
  yearly_generation_kwh?: number // For total view: yearly generation in kWh
  year?: number // For total view: year
}

interface TelemetryChartProps {
  data: TelemetryData[]
  title?: string
  statistics?: {
    dailyGenerationKwh?: number
    fullPowerHoursDay?: number
    monthlyGenerationKwh?: number
    fullPowerHoursMonth?: number
    yearlyGenerationKwh?: number
    fullPowerHoursYear?: number
    totalGenerationKwh?: number
    fullPowerHoursTotal?: number
    operatingTotalDays?: number
  }
  showAreaFill?: boolean
  period?: "day" | "month" | "year" | "total"
}

export function TelemetryChart({ 
  data, 
  title = "Telemetry (24h)",
  statistics,
  showAreaFill = true,
  period = "day",
}: TelemetryChartProps) {
  // Generate X-axis ticks for 24-hour range (every 3 hours) - only for day view
  const xAxisTicks = useMemo(() => {
    if (period !== "day") return []
    const ticks: string[] = []
    for (let i = 0; i <= 24; i += 3) {
      ticks.push(`${i.toString().padStart(2, "0")}:00`)
    }
    return ticks
  }, [period])

  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return []
    }

    if (period === "month") {
      // For month view: use daily generation values, sorted by day
      return data
        .map((point) => {
          if (!point) return null
          const day = point.day || 0
          const generationKwh = point.daily_generation_kwh ?? 0
          
          return {
            day,
            dayLabel: day.toString(),
            generation: Math.round(generationKwh * 100) / 100,
            timestamp: day,
          }
        })
        .filter((point): point is NonNullable<typeof point> => point !== null && point.day > 0) // Filter out invalid days
        .sort((a, b) => a.day - b.day)
    } else if (period === "year") {
      // For year view: use monthly generation values, sorted by month
      return data
        .map((point) => {
          if (!point) return null
          const month = point.month || 0
          const generationKwh = point.monthly_generation_kwh ?? 0
          
          return {
            month,
            monthLabel: month.toString(),
            generation: Math.round(generationKwh * 100) / 100,
            timestamp: month,
          }
        })
        .filter((point): point is NonNullable<typeof point> => point !== null && point.month > 0 && point.month <= 12) // Filter out invalid months
        .sort((a, b) => a.month - b.month)
    } else if (period === "total") {
      // For total view: use yearly generation values, sorted by year
      return data
        .map((point) => {
          if (!point) return null
          const year = point.year || 0
          const generationKwh = point.yearly_generation_kwh ?? 0
          
          return {
            year,
            yearLabel: year.toString(),
            generation: Math.round(generationKwh * 100) / 100,
            timestamp: year,
          }
        })
        .filter((point): point is NonNullable<typeof point> => point !== null && point.year > 0) // Filter out invalid years
        .sort((a, b) => a.year - b.year)
    } else {
      // For day view: process data points - use power_kw or generation_power_kw
      return data
        .map((point) => {
          if (!point || !point.ts) {
            return null
          }
          try {
            const timestamp = new Date(point.ts)
            if (isNaN(timestamp.getTime())) {
              return null
            }
            const power = Number(point.power_kw ?? point.generation_power_kw ?? 0)
            
            return {
              time: format(timestamp, "HH:mm"),
              fullTime: format(timestamp, "yyyy-MM-dd HH:mm:ss"),
              timestamp: timestamp.getTime(),
              power: Math.round(power * 100) / 100,
              hour: timestamp.getHours(),
            }
          } catch (error) {
            console.error("Error processing telemetry point:", error, point)
            return null
          }
        })
        .filter((point): point is NonNullable<typeof point> => point !== null)
        .sort((a, b) => a.timestamp - b.timestamp)
    }
  }, [data, period])

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
            {period === "day" && statistics.dailyGenerationKwh !== undefined && 
             statistics.dailyGenerationKwh !== null && 
             typeof statistics.dailyGenerationKwh === 'number' && (
              <div>
                <span className="text-muted-foreground">Daily Production: </span>
                <span className="font-semibold">{statistics.dailyGenerationKwh.toFixed(1)} kWh</span>
              </div>
            )}
            {period === "day" && statistics.fullPowerHoursDay !== undefined && 
             statistics.fullPowerHoursDay !== null && 
             typeof statistics.fullPowerHoursDay === 'number' && (
              <div>
                <span className="text-muted-foreground">Peak Hours Today: </span>
                <span className="font-semibold">{statistics.fullPowerHoursDay.toFixed(2)} h</span>
              </div>
            )}
            {period === "month" && statistics.monthlyGenerationKwh !== undefined && 
             statistics.monthlyGenerationKwh !== null && 
             typeof statistics.monthlyGenerationKwh === 'number' && (
              <div>
                <span className="text-muted-foreground">Monthly Production: </span>
                <span className="font-semibold">{statistics.monthlyGenerationKwh.toFixed(1)} kWh</span>
              </div>
            )}
            {period === "month" && statistics.fullPowerHoursMonth !== undefined && 
             statistics.fullPowerHoursMonth !== null && 
             typeof statistics.fullPowerHoursMonth === 'number' && (
              <div>
                <span className="text-muted-foreground">Peak Hours this Month: </span>
                <span className="font-semibold">{statistics.fullPowerHoursMonth.toFixed(2)} h</span>
              </div>
            )}
            {period === "year" && statistics.yearlyGenerationKwh !== undefined && 
             statistics.yearlyGenerationKwh !== null && 
             typeof statistics.yearlyGenerationKwh === 'number' && 
             !isNaN(statistics.yearlyGenerationKwh) && (
              <div>
                <span className="text-muted-foreground">Yearly Production: </span>
                <span className="font-semibold">{(statistics.yearlyGenerationKwh / 1000).toFixed(2)} MWh</span>
              </div>
            )}
            {period === "year" && statistics.fullPowerHoursYear !== undefined && 
             statistics.fullPowerHoursYear !== null && 
             typeof statistics.fullPowerHoursYear === 'number' && (
              <div>
                <span className="text-muted-foreground">Peak Hours this Year: </span>
                <span className="font-semibold">{statistics.fullPowerHoursYear.toFixed(2)} h</span>
              </div>
            )}
            {period === "total" && statistics.totalGenerationKwh !== undefined && 
             statistics.totalGenerationKwh !== null && 
             typeof statistics.totalGenerationKwh === 'number' && 
             !isNaN(statistics.totalGenerationKwh) && (
              <div>
                <span className="text-muted-foreground">Total Production: </span>
                <span className="font-semibold">{(statistics.totalGenerationKwh / 1000).toFixed(0)} MWh</span>
              </div>
            )}
            {period === "total" && statistics.fullPowerHoursTotal !== undefined && 
             statistics.fullPowerHoursTotal !== null && 
             typeof statistics.fullPowerHoursTotal === 'number' && (
              <div>
                <span className="text-muted-foreground">Total Peak Hours: </span>
                <span className="font-semibold">{statistics.fullPowerHoursTotal.toFixed(2)} h</span>
              </div>
            )}
          </div>
        )}

        <ResponsiveContainer width="100%" height={300}>
          {period === "month" ? (
            // Month view: Bar chart showing daily generation
            <BarChart data={chartData}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="dayLabel"
                tick={{ fill: "currentColor", fontSize: 12 }}
                className="text-xs"
                label={{ value: "Day of Month", position: "insideBottom", offset: -5 }}
              />
              <YAxis
                tick={{ fill: "currentColor", fontSize: 12 }}
                className="text-xs"
                label={{ value: "kWh", angle: -90, position: "insideLeft", style: { textAnchor: "middle" } }}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload
                    return (
                      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                        <p className="text-sm font-semibold mb-1">Day {data.day}</p>
                        <p className="text-sm">
                          <span className="font-medium text-blue-600 dark:text-blue-400">Generation: </span>
                          {typeof data.generation === 'number' ? data.generation.toFixed(2) : '0.00'} kWh
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend />
              <Bar
                dataKey="generation"
                fill="url(#barGradient)"
                name="Daily Generation"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          ) : period === "year" ? (
            // Year view: Bar chart showing monthly generation
            <BarChart data={chartData}>
              <defs>
                <linearGradient id="yearBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="monthLabel"
                tick={{ fill: "currentColor", fontSize: 12 }}
                className="text-xs"
                label={{ value: "Month", position: "insideBottom", offset: -5 }}
              />
              <YAxis
                tick={{ fill: "currentColor", fontSize: 12 }}
                className="text-xs"
                label={{ value: "MWh", angle: -90, position: "insideLeft", style: { textAnchor: "middle" } }}
                tickFormatter={(value) => {
                  if (typeof value === 'number' && !isNaN(value)) {
                    return (value / 1000).toFixed(1)
                  }
                  return '0'
                }}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length && payload[0]) {
                    const data = payload[0].payload
                    if (!data) return null
                    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
                    const month = data.month || 0
                    return (
                      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                        <p className="text-sm font-semibold mb-1">{month > 0 && month <= 12 ? monthNames[month - 1] : `Month ${month}`}</p>
                        <p className="text-sm">
                          <span className="font-medium text-blue-600 dark:text-blue-400">Generation: </span>
                          {typeof data.generation === 'number' && !isNaN(data.generation) ? (data.generation / 1000).toFixed(2) : '0.00'} MWh
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend />
              <Bar
                dataKey="generation"
                fill="url(#yearBarGradient)"
                name="Monthly Generation"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          ) : period === "total" ? (
            // Total view: Bar chart showing yearly generation
            <BarChart data={chartData}>
              <defs>
                <linearGradient id="totalBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="yearLabel"
                tick={{ fill: "currentColor", fontSize: 12 }}
                className="text-xs"
                label={{ value: "Year", position: "insideBottom", offset: -5 }}
              />
              <YAxis
                tick={{ fill: "currentColor", fontSize: 12 }}
                className="text-xs"
                label={{ value: "MWh", angle: -90, position: "insideLeft", style: { textAnchor: "middle" } }}
                tickFormatter={(value) => {
                  if (typeof value === 'number' && !isNaN(value)) {
                    return (value / 1000).toFixed(0)
                  }
                  return '0'
                }}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length && payload[0]) {
                    const data = payload[0].payload
                    if (!data) return null
                    return (
                      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                        <p className="text-sm font-semibold mb-1">Year {data.year || 'N/A'}</p>
                        <p className="text-sm">
                          <span className="font-medium text-blue-600 dark:text-blue-400">Generation: </span>
                          {typeof data.generation === 'number' && !isNaN(data.generation) ? (data.generation / 1000).toFixed(2) : '0.00'} MWh
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend />
              <Bar
                dataKey="generation"
                fill="url(#totalBarGradient)"
                name="Yearly Generation"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          ) : showAreaFill ? (
            // Day view: Area chart
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
            // Day view: Line chart (fallback)
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

        {/* Day/Night Indicators - Only show for day view */}
        {period === "day" && (
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
        )}
      </div>
    </Card>
  )
}
