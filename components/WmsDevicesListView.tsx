"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  ExternalLink,
  CloudSun,
  Radio,
} from "lucide-react"
import Link from "next/link"

interface WmsDevice {
  id: number
  device_name: string | null
  vendor_device_id: string
  mac_address: string | null
  serial_no: string | null
  wms_sites?: {
    id: number
    site_name: string
    vendor_site_id: string
    wms_vendors?: {
      id: number
      name: string
      vendor_type: string
    }
  }
}

export function WmsDevicesListView({ siteId }: { siteId: string }) {
  const router = useRouter()
  const [devices, setDevices] = useState<WmsDevice[]>([])
  const [site, setSite] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId])

  async function fetchData() {
    try {
      setLoading(true)
      const devicesResponse = await fetch(`/api/wms-devices?siteId=${siteId}`)

      if (!devicesResponse.ok) {
        throw new Error("Failed to fetch devices")
      }

      const devicesData = await devicesResponse.json()
      setDevices(devicesData.devices || [])

      // Get site info from first device if available
      if (devicesData.devices && devicesData.devices.length > 0) {
        setSite(devicesData.devices[0].wms_sites)
      }
    } catch (err: any) {
      setError(err.message || "Failed to load devices")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading devices...</div>
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
              <Radio className="h-8 w-8 text-primary" />
              WMS Devices
            </h1>
            <p className="text-muted-foreground mt-1">
              {site?.site_name ? `Devices for ${site.site_name}` : "Weather Monitoring Devices"}
            </p>
          </div>
        </div>
      </div>

      {devices.length === 0 ? (
        <Card className="p-8 text-center">
          <CloudSun className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Devices Found</h3>
          <p className="text-muted-foreground">
            No devices have been synced for this site yet.
          </p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device Name</TableHead>
                <TableHead>Device ID</TableHead>
                <TableHead>MAC Address</TableHead>
                <TableHead>Serial Number</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">
                    {device.device_name || device.vendor_device_id}
                  </TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {device.vendor_device_id}
                    </code>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{device.mac_address || "N/A"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{device.serial_no || "N/A"}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/wms/devices/${device.id}/insolation`}>
                      <Button variant="outline" size="sm">
                        View Insolation
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

