"use client"

import { useEffect, useState, useMemo } from "react"
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
import { Zap, TrendingUp, Calendar, Clock } from "lucide-react"

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

interface PlantEnergyAnalyticsProps {
  plantId: string
}

export function PlantEnergyAnalytics({ plantId }: PlantEnergyAnalyticsProps) {
  const [readings, setReadings] = useState<EnergyReading[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReading, setSelectedReading] = useState<EnergyReading | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    fetchReadings()
  }, [plantId])

  async function fetchReadings() {
    try {
      setLoading(true)
      const response = await fetch(`/api/analytics/plants/${plantId}/energy`)
      if (response.ok) {
        const data = await response.json()
        setReadings(data.readings || [])
      }
    } catch (error) {
      console.error("Failed to fetch energy readings:", error)
    } finally {
      setLoading(false)
    }
  }

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

