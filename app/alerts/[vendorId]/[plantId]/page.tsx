"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useParams, useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/DashboardSidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Calendar, Clock, AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react"
import { format } from "date-fns"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination"

interface Alert {
    id: number
    title: string
    description: string
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    status: "ACTIVE" | "RESOLVED" | "ACKNOWLEDGED"
    alert_time: string
    end_time: string | null
    duration_seconds: number | null
    device_sn: string | null
    device_type: string | null
    vendor_alert_id: string
}

export default function PlantAlertsPage() {
    const params = useParams()
    const router = useRouter()
    const [alerts, setAlerts] = useState<Alert[]>([])
    const [plantName, setPlantName] = useState("")
    const [loading, setLoading] = useState(true)
    const [accountType, setAccountType] = useState<string>("")
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const pageSize = 20

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true)
                const meRes = await fetch("/api/me")
                const meData = await meRes.json()
                setAccountType(meData.account.accountType)

                // Fetch plant details
                const plantRes = await fetch(`/api/plants/${params.plantId}`)
                if (plantRes.ok) {
                    const plantData = await plantRes.json()
                    setPlantName(plantData.name)
                }

                // Fetch alerts with pagination
                // We need an API that supports pagination and filtering by plantId
                // Assuming /api/alerts?plantId=...&page=...&limit=...
                const alertsRes = await fetch(`/api/alerts?plantId=${params.plantId}&page=${page}&limit=${pageSize}`)

                if (alertsRes.ok) {
                    const alertsData = await alertsRes.json()
                    setAlerts(alertsData.data || [])
                    // Assuming API returns total count or total pages
                    // If not, we might need to adjust
                    if (alertsData.pagination) {
                        setTotalPages(alertsData.pagination.totalPages)
                    } else {
                        // Fallback if no pagination metadata
                        setTotalPages(1)
                    }
                }
            } catch (error) {
                console.error("Failed to fetch data:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [params.plantId, page])

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case "CRITICAL": return "destructive"
            case "HIGH": return "destructive" // Or orange
            case "MEDIUM": return "default" // Or yellow
            case "LOW": return "secondary" // Or blue
            default: return "outline"
        }
    }

    const formatDuration = (seconds: number | null) => {
        if (!seconds) return "-"
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        if (hours > 0) return `${hours}h ${minutes}m`
        return `${minutes}m`
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
            <DashboardSidebar accountType={accountType} />

            <div className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <Button
                        variant="ghost"
                        className="mb-4 pl-0 hover:pl-2 transition-all"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Plants
                    </Button>

                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold mb-2">{plantName} Alerts</h1>
                            <p className="text-muted-foreground">
                                Historical alerts and events
                            </p>
                        </div>
                        <div className="flex gap-2">
                            {/* Add filters here if needed */}
                        </div>
                    </div>
                </motion.div>

                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Severity</TableHead>
                                    <TableHead>Alert Name</TableHead>
                                    <TableHead>Device</TableHead>
                                    <TableHead>Start Time</TableHead>
                                    <TableHead>End Time</TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            <div className="flex justify-center">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : alerts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                            No alerts found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    alerts.map((alert) => (
                                        <TableRow key={alert.id}>
                                            <TableCell>
                                                <Badge variant={getSeverityColor(alert.severity) as any}>
                                                    {alert.severity}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">{alert.title}</div>
                                                <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={alert.description}>
                                                    {alert.description}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">{alert.device_type}</div>
                                                <div className="text-xs text-muted-foreground">{alert.device_sn}</div>
                                            </TableCell>
                                            <TableCell>
                                                {alert.alert_time ? format(new Date(alert.alert_time), "PP p") : "-"}
                                            </TableCell>
                                            <TableCell>
                                                {alert.end_time ? format(new Date(alert.end_time), "PP p") : "-"}
                                            </TableCell>
                                            <TableCell>
                                                {formatDuration(alert.duration_seconds)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={alert.status === "ACTIVE" ? "destructive" : "outline"}>
                                                    {alert.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="mt-4">
                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                    />
                                </PaginationItem>

                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                    <PaginationItem key={p}>
                                        <PaginationLink
                                            isActive={page === p}
                                            onClick={() => setPage(p)}
                                            className="cursor-pointer"
                                        >
                                            {p}
                                        </PaginationLink>
                                    </PaginationItem>
                                ))}

                                <PaginationItem>
                                    <PaginationNext
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        className={page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                )}
            </div>
        </div>
    )
}
