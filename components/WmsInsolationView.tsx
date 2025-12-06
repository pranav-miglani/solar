"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  CloudSun,
  Calendar,
  Sun,
} from "lucide-react"
import { InsolationChart } from "@/components/InsolationChart"
import { format, subDays } from "date-fns"

interface WmsDevice {
  id: number
  device_name: string | null
  vendor_device_id: string
  wms_sites?: {
    id: number
    site_name: string
    wms_vendors?: {
      id: number
      name: string
    }
  }
}

interface InsolationReading {
  reading_date: string
  insolation_value: number
  reading_count?: number
  metadata?: {
    min_irr?: number
    max_irr?: number
  }
}

export function WmsInsolationView({ deviceId }: { deviceId: string }) {
  const router = useRouter()
  const [device, setDevice] = useState<WmsDevice | null>(null)
  const [readings, setReadings] = useState<InsolationReading[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState(30) // Default to last 30 days

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, dateRange])

  async function fetchData() {
    try {
      setLoading(true)
      
      // Fetch device info (we'll get it from the devices API)
      const devicesResponse = await fetch(`/api/wms-devices?deviceId=${deviceId}`)
      if (devicesResponse.ok) {
        const devicesData = await devicesResponse.json()
        if (devicesData.devices && devicesData.devices.length > 0) {
          setDevice(devicesData.devices[0])
        }
      }

      // Fetch insolation readings
      const endDate = new Date().toISOString().split("T")[0]
      const startDate = subDays(new Date(), dateRange).toISOString().split("T")[0]
      
      const readingsResponse = await fetch(
        `/api/insolation-readings?deviceId=${deviceId}&startDate=${startDate}&endDate=${endDate}`
      )

      if (!readingsResponse.ok) {
        throw new Error("Failed to fetch insolation readings")
      }

      const readingsData = await readingsResponse.json()
      setReadings(readingsData.readings || [])
    } catch (err: any) {
      setError(err.message || "Failed to load insolation data")
    } finally {
      setLoading(false)
    }
  }

  const statistics = readings.length > 0 ? {
    averageInsolation: readings.reduce((sum, r) => sum + r.insolation_value, 0) / readings.length,
    minInsolation: Math.min(...readings.map(r => r.insolation_value)),
    maxInsolation: Math.max(...readings.map(r => r.insolation_value)),
    totalDays: readings.length,
  } : undefined

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading insolation data...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-6">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => router.back()} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={() => router.back()} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sun className="h-8 w-8 text-yellow-500" />
              Insolation Data
            </h1>
            <p className="text-muted-foreground mt-1">
              {device?.device_name || device?.vendor_device_id || "Device"}
              {device?.wms_sites?.site_name && ` - ${device.wms_sites.site_name}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant={dateRange === 7 ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRange(7)}
          >
            7 Days
          </Button>
          <Button
            variant={dateRange === 30 ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRange(30)}
          >
            30 Days
          </Button>
          <Button
            variant={dateRange === 100 ? "default" : "outline"}
            size="sm"
            onClick={() => setDateRange(100)}
          >
            100 Days
          </Button>
        </div>
      </div>

      {device && (
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Device</p>
                <p className="font-medium">
                  {device.device_name || device.vendor_device_id}
                </p>
              </div>
              {device.wms_sites && (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Site</p>
                    <p className="font-medium">{device.wms_sites.site_name}</p>
                  </div>
                  {device.wms_sites.wms_vendors && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Vendor</p>
                      <p className="font-medium">{device.wms_sites.wms_vendors.name}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <InsolationChart
        data={readings}
        title="Insolation Readings"
        statistics={statistics}
        period="range"
      />
    </div>
  )
}

