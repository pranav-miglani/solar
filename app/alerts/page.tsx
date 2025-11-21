"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { DashboardSidebar } from "@/components/DashboardSidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Factory, ArrowRight, Clock, AlertTriangle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface Vendor {
    id: number
    name: string
    vendor_type: string
    last_synced_at: string | null
    organizations: {
        name: string
    }
    stats?: {
        total_alerts: number
        active_alerts: number
    }
}

export default function AlertsPage() {
    const [vendors, setVendors] = useState<Vendor[]>([])
    const [loading, setLoading] = useState(true)
    const [accountType, setAccountType] = useState<string>("")

    useEffect(() => {
        // Fetch user info and vendors
        const fetchData = async () => {
            try {
                const meRes = await fetch("/api/me")
                const meData = await meRes.json()
                setAccountType(meData.account.accountType)

                // Fetch vendors with stats
                // We might need a new API endpoint for this or reuse existing
                // For now, let's assume we can fetch vendors and then maybe alerts count
                const vendorsRes = await fetch("/api/vendors") // This needs to be created or checked
                // If /api/vendors doesn't exist or doesn't return what we need, we might need to create it
                // Let's check if we have an endpoint for vendors. 
                // Looking at file list, we have app/api/vendors/route.ts (implied by directory structure)

                if (vendorsRes.ok) {
                    const vendorsData = await vendorsRes.json()
                    setVendors(vendorsData.data || [])
                }
            } catch (error) {
                console.error("Failed to fetch data:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        )
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
                    <h1 className="text-3xl font-bold mb-2">Alerts Management</h1>
                    <p className="text-muted-foreground">
                        Select a vendor to view alerts by plant
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {vendors.map((vendor, index) => (
                        <motion.div
                            key={vendor.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Link href={`/alerts/${vendor.id}`}>
                                <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/50">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-xl font-bold">
                                            {vendor.name}
                                        </CardTitle>
                                        <Factory className="h-5 w-5 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="flex items-center text-sm text-muted-foreground">
                                                <Building2 className="mr-2 h-4 w-4" />
                                                {vendor.organizations?.name || "Unknown Org"}
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <Badge variant="outline">
                                                    {vendor.vendor_type}
                                                </Badge>
                                                {vendor.last_synced_at && (
                                                    <div className="flex items-center text-xs text-muted-foreground" title={new Date(vendor.last_synced_at).toLocaleString()}>
                                                        <Clock className="mr-1 h-3 w-3" />
                                                        Synced {formatDistanceToNow(new Date(vendor.last_synced_at))} ago
                                                    </div>
                                                )}
                                            </div>

                                            <Button className="w-full group" variant="secondary">
                                                View Plants
                                                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        </motion.div>
                    ))}

                    {vendors.length === 0 && (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            No vendors found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function Building2(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
            <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
            <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
            <path d="M10 6h4" />
            <path d="M10 10h4" />
            <path d="M10 14h4" />
            <path d="M10 18h4" />
        </svg>
    )
}
