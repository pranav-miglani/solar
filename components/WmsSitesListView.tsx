"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  Building2,
  ArrowLeft,
  MapPin,
  ExternalLink,
  CloudSun,
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

interface WmsSite {
  id: number
  site_name: string
  address: string | null
  latitude: number | null
  longitude: number | null
  location: string | null
  status: string | null
  panel_count: number | null
  panel_wattage: number | null
  device_count: number
  wms_vendors?: {
    id: number
    name: string
    vendor_type: string
  }
  organizations?: {
    id: number
    name: string
  }
}

export function WmsSitesListView({ vendorId }: { vendorId: string }) {
  const router = useRouter()
  const [sites, setSites] = useState<WmsSite[]>([])
  const [vendor, setVendor] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId])

  async function fetchData() {
    try {
      setLoading(true)
      const [sitesResponse, vendorResponse] = await Promise.all([
        fetch(`/api/wms-vendors/${vendorId}/sites`),
        fetch(`/api/wms-vendors/${vendorId}`),
      ])

      if (!sitesResponse.ok) {
        throw new Error("Failed to fetch sites")
      }

      const sitesData = await sitesResponse.json()
      setSites(sitesData.sites || [])

      if (vendorResponse.ok) {
        const vendorData = await vendorResponse.json()
        setVendor(vendorData)
      }
    } catch (err: any) {
      setError(err.message || "Failed to load sites")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading sites...</div>
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
            <Button onClick={() => router.push(`/wms/vendors/${vendorId}`)} variant="outline">
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
          <Button
            onClick={() => router.push(`/wms/vendors/${vendorId}`)}
            variant="outline"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CloudSun className="h-8 w-8 text-primary" />
              WMS Sites
            </h1>
            <p className="text-muted-foreground mt-1">
              {vendor?.name ? `Sites for ${vendor.name}` : "Weather Monitoring Sites"}
            </p>
          </div>
        </div>
      </div>

      {sites.length === 0 ? (
        <Card className="p-8 text-center">
          <CloudSun className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Sites Found</h3>
          <p className="text-muted-foreground">
            No sites have been synced for this vendor yet.
          </p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Devices</TableHead>
                <TableHead>Panel Info</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((site) => (
                <TableRow key={site.id}>
                  <TableCell className="font-medium">{site.site_name}</TableCell>
                  <TableCell>
                    {site.address ? (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{site.address}</span>
                      </div>
                    ) : site.location ? (
                      <span className="text-sm text-muted-foreground">{site.location}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {site.status || "Unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{site.device_count || 0}</span>
                  </TableCell>
                  <TableCell>
                    {site.panel_count && site.panel_wattage ? (
                      <span className="text-sm">
                        {site.panel_count} × {site.panel_wattage}W
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/wms/sites/${site.id}/devices`}>
                      <Button variant="outline" size="sm">
                        View Devices
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

