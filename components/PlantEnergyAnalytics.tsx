"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Zap, TrendingUp, Calendar, Clock, AlertTriangle, Wifi, WifiOff } from "lucide-react"

interface EnergyReading {
  id: number
  plant_id: number
  reading_date: string
  daily_energy_kwh: number | null
  monthly_energy_kwh: number | null
  yearly_energy_mwh: number | null
  total_energy_mwh: number | null
  metadata: any
}

interface GridDowntimeReading {
  id: number
  plant_id: number
  reading_date: string
  daily_grid_down_seconds: number
  total_grid_down_seconds: number | null
}

interface WasOnlineReading {
  reading_date: string
  was_online: boolean | null
}

interface PlantEnergyAnalyticsProps {
  plantId: string
}

export function PlantEnergyAnalytics({ plantId }: PlantEnergyAnalyticsProps) {
  const [readings, setReadings] = useState<EnergyReading[]>([])
  const [gridDowntimeReadings, setGridDowntimeReadings] = useState<GridDowntimeReading[]>([])
  const [wasOnlineReadings, setWasOnlineReadings] = useState<WasOnlineReading[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReading, setSelectedReading] = useState<EnergyReading | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const fetchReadings = useCallback(async () => {
    try {
      setLoading(true)
      const [energyResponse, gridDowntimeResponse] = await Promise.all([
        fetch(`/api/analytics/plants/${plantId}/energy`),
        fetch(`/api/analytics/plants/${plantId}/grid-downtime`)
      ])
      
      if (energyResponse.ok) {
        const data = await energyResponse.json()
        setReadings(data.readings || [])
      }
      
      if (gridDowntimeResponse.ok) {
        const data = await gridDowntimeResponse.json()
        setGridDowntimeReadings(data.gridDowntimeReadings || [])
        setWasOnlineReadings(data.wasOnlineReadings || [])
      }
    } catch (error) {
      console.error("Failed to fetch analytics data:", error)
    } finally {
      setLoading(false)
    }
  }, [plantId])

  useEffect(() => {
    fetchReadings()
  }, [fetchReadings])

  function handleDataPointClick(data: any) {
    const reading = readings.find((r) => r.reading_date === data.date)
    if (reading) {
      setSelectedReading(reading)
      setModalOpen(true)
    }
  }

  // Daily Energy Chart Data (Bar Chart)
  const dailyChartData = useMemo(() => {
    return readings
      .map((r) => ({
        date: r.reading_date,
        dateLabel: format(new Date(r.reading_date), "MMM dd"),
        value: r.daily_energy_kwh ?? 0,
        timestamp: new Date(r.reading_date).getTime(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [readings])

  // Total Energy Chart Data (Line Chart - increasing)
  const totalChartData = useMemo(() => {
    return readings
      .map((r) => ({
        date: r.reading_date,
        dateLabel: format(new Date(r.reading_date), "MMM dd"),
        value: r.total_energy_mwh ?? 0,
        timestamp: new Date(r.reading_date).getTime(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [readings])

  // Monthly Energy Chart Data (Line Chart - last 100 days showing monthly trend)
  const monthlyChartData = useMemo(() => {
    return readings
      .map((r) => ({
        date: r.reading_date,
        dateLabel: format(new Date(r.reading_date), "MMM dd"),
        value: r.monthly_energy_kwh ?? 0,
        timestamp: new Date(r.reading_date).getTime(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [readings])

  // Yearly Energy Chart Data (Line Chart - increasing)
  const yearlyChartData = useMemo(() => {
    return readings
      .map((r) => ({
        date: r.reading_date,
        dateLabel: format(new Date(r.reading_date), "MMM dd"),
        value: r.yearly_energy_mwh ?? 0,
        timestamp: new Date(r.reading_date).getTime(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [readings])

  // Grid Downtime Chart Data (Daily - Bar Chart)
  const dailyGridDowntimeChartData = useMemo(() => {
    return gridDowntimeReadings
      .map((r) => ({
        date: r.reading_date,
        dateLabel: format(new Date(r.reading_date), "MMM dd"),
        value: r.daily_grid_down_seconds,
        hours: (r.daily_grid_down_seconds / 3600).toFixed(2),
        timestamp: new Date(r.reading_date).getTime(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [gridDowntimeReadings])

  // Grid Downtime Chart Data (Total - Line Chart)
  const totalGridDowntimeChartData = useMemo(() => {
    return gridDowntimeReadings
      .filter((r) => r.total_grid_down_seconds !== null)
      .map((r) => ({
        date: r.reading_date,
        dateLabel: format(new Date(r.reading_date), "MMM dd"),
        value: r.total_grid_down_seconds!,
        hours: (r.total_grid_down_seconds! / 3600).toFixed(2),
        timestamp: new Date(r.reading_date).getTime(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [gridDowntimeReadings])

  // Was Online Chart Data (Bar Chart - 1 for online, 0 for offline)
  const wasOnlineChartData = useMemo(() => {
    return wasOnlineReadings
      .map((r) => ({
        date: r.reading_date,
        dateLabel: format(new Date(r.reading_date), "MMM dd"),
        value: r.was_online ? 1 : 0,
        status: r.was_online ? "Online" : "Offline",
        timestamp: new Date(r.reading_date).getTime(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [wasOnlineReadings])

  // Get latest grid downtime values for summary cards
  const latestGridDowntime = useMemo(() => {
    if (gridDowntimeReadings.length === 0) {
      return { daily: null, total: null, date: null }
    }
    const latest = gridDowntimeReadings[gridDowntimeReadings.length - 1]
    return {
      daily: latest.daily_grid_down_seconds,
      total: latest.total_grid_down_seconds,
      date: latest.reading_date,
    }
  }, [gridDowntimeReadings])

  const formatSeconds = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return "N/A"
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    }
    return `${secs}s`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label, valueLabel }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.dateLabel}</p>
          <p className="text-sm">
            <span className="text-muted-foreground">{valueLabel}: </span>
            <span className="font-medium">{typeof data.value === 'number' ? data.value.toFixed(3) : '0'}</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Grid Downtime Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Daily Grid Downtime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
              {formatSeconds(latestGridDowntime.daily)}
            </div>
            {latestGridDowntime.date && (
              <p className="text-sm text-muted-foreground mt-2">
                Last updated: {format(new Date(latestGridDowntime.date), "MMM dd, yyyy")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              Total Grid Downtime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
              {formatSeconds(latestGridDowntime.total)}
            </div>
            {latestGridDowntime.date && (
              <p className="text-sm text-muted-foreground mt-2">
                Last updated: {format(new Date(latestGridDowntime.date), "MMM dd, yyyy")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Energy - Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Daily Energy Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyChartData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={dailyChartData}
                onClick={(data) => data && handleDataPointClick(data)}
                style={{ cursor: "pointer" }}
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
                  label={{ value: "Daily Energy (kWh)", angle: -90, position: "insideLeft" }}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip valueLabel="Daily Energy" />} />
                <Legend />
                <Bar
                  dataKey="value"
                  fill="#3b82f6"
                  name="Daily Energy (kWh)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Total Energy - Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Total Energy Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalChartData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={totalChartData}
                onClick={(data) => data && handleDataPointClick(data)}
                style={{ cursor: "pointer" }}
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
                  label={{ value: "Total Energy (MWh)", angle: -90, position: "insideLeft" }}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip valueLabel="Total Energy" />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Total Energy (MWh)"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Monthly Energy - Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Monthly Energy Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyChartData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={monthlyChartData}
                onClick={(data) => data && handleDataPointClick(data)}
                style={{ cursor: "pointer" }}
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
                  label={{ value: "Monthly Energy (kWh)", angle: -90, position: "insideLeft" }}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip valueLabel="Monthly Energy" />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="Monthly Energy (kWh)"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Yearly Energy - Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Yearly Energy Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {yearlyChartData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={yearlyChartData}
                onClick={(data) => data && handleDataPointClick(data)}
                style={{ cursor: "pointer" }}
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
                  label={{ value: "Yearly Energy (MWh)", angle: -90, position: "insideLeft" }}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomTooltip valueLabel="Yearly Energy" />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  name="Yearly Energy (MWh)"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Daily Grid Downtime - Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Daily Grid Downtime
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyGridDowntimeChartData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={dailyGridDowntimeChartData}
                style={{ cursor: "pointer" }}
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
                  label={{ value: "Grid Downtime (seconds)", angle: -90, position: "insideLeft" }}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{data.dateLabel}</p>
                          <p className="text-sm">
                            <span className="text-muted-foreground">Grid Downtime: </span>
                            <span className="font-medium">{data.value} seconds ({data.hours} hours)</span>
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend />
                <Bar
                  dataKey="value"
                  fill="#ef4444"
                  name="Daily Grid Downtime (seconds)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Total Grid Downtime - Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Total Grid Downtime Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalGridDowntimeChartData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={totalGridDowntimeChartData}
                style={{ cursor: "pointer" }}
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
                  label={{ value: "Total Grid Downtime (seconds)", angle: -90, position: "insideLeft" }}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{data.dateLabel}</p>
                          <p className="text-sm">
                            <span className="text-muted-foreground">Total Grid Downtime: </span>
                            <span className="font-medium">{data.value} seconds ({data.hours} hours)</span>
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
                  dataKey="value"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Total Grid Downtime (seconds)"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Was Online Status - Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Plant Online Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {wasOnlineChartData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={wasOnlineChartData}
                style={{ cursor: "pointer" }}
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
                  domain={[0, 1]}
                  ticks={[0, 1]}
                  tickFormatter={(value) => value === 1 ? "Online" : "Offline"}
                  label={{ value: "Status", angle: -90, position: "insideLeft" }}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{data.dateLabel}</p>
                          <p className="text-sm">
                            <span className="text-muted-foreground">Status: </span>
                            <span className={`font-medium ${data.value === 1 ? "text-green-600" : "text-red-600"}`}>
                              {data.status}
                            </span>
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend />
                <Bar
                  dataKey="value"
                  name="Online Status"
                  radius={[4, 4, 0, 0]}
                  shape={(props: any) => {
                    const { payload, x, y, width, height } = props
                    const fill = payload.value === 1 ? "#10b981" : "#ef4444"
                    return (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill={fill}
                        rx={4}
                      />
                    )
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Metadata Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Raw Vendor Payload - {selectedReading?.reading_date}
            </DialogTitle>
          </DialogHeader>
          {selectedReading && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Reading Date</h4>
                <p className="text-sm">{selectedReading.reading_date}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Energy Values</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Daily: </span>
                    <span>{selectedReading.daily_energy_kwh ?? "N/A"} kWh</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Monthly: </span>
                    <span>{selectedReading.monthly_energy_kwh ?? "N/A"} kWh</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Yearly: </span>
                    <span>{selectedReading.yearly_energy_mwh ?? "N/A"} MWh</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total: </span>
                    <span>{selectedReading.total_energy_mwh ?? "N/A"} MWh</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Raw Metadata</h4>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                  {JSON.stringify(selectedReading.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

