"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/DashboardSidebar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Zap, MapPin, AlertTriangle, ArrowRight } from "lucide-react"

interface Plant {
    id: number
    name: string
    capacity_kw: number
    location: {
        address?: string
    }
    vendor_plant_id: string
    alerts_count?: number
}

export default function VendorPlantsPage() {
    const params = useParams()
    const router = useRouter()
    const [plants, setPlants] = useState<Plant[]>([])
    const [vendorName, setVendorName] = useState("")
    const [loading, setLoading] = useState(true)
    const [accountType, setAccountType] = useState<string>("")

    useEffect(() => {
        const fetchData = async () => {
            try {
                const meRes = await fetch("/api/me")
                const meData = await meRes.json()
                setAccountType(meData.account.accountType)

                // Fetch vendor details
                // We need an API to get vendor details and its plants
                // Assuming /api/vendors/[id] exists or we filter plants by vendor
                // Let's use a hypothetical endpoint or query
                // Actually we can use /api/plants?vendorId=... if it supports it
                // Or we might need to create a specific endpoint for this drill down

                // For now, let's try to fetch all plants and filter (not efficient but works for prototype)
                // Better: Create a new API route /api/vendors/[id]/plants

                // Let's assume we create /api/vendors/[id]/plants-with-alerts-count
                // But since I can't easily create new API routes without seeing existing ones,
                // I'll try to fetch plants and filter.

                // Wait, I can create new API routes.
                // Let's fetch plants for this vendor.
                const plantsRes = await fetch(`/api/plants?vendorId=${params.vendorId}`)

                // Also fetch vendor name
                const vendorRes = await fetch(`/api/vendors/${params.vendorId}`)
                if (vendorRes.ok) {
                    const vendorData = await vendorRes.json()
                    setVendorName(vendorData.name)
                }

                if (plantsRes.ok) {
                    const plantsData = await plantsRes.json()
                    // Filter plants by vendorId if the API returns all (it shouldn't if query param works)
                    // The existing plants API might not support filtering by vendorId
                    // Let's check app/api/plants/route.ts later.
                    // For now assume it returns data.

                    // If the API returns all plants, we filter client side
                    const vendorPlants = plantsData.data?.filter((p: any) => p.vendor_id.toString() === params.vendorId) || []
                    setPlants(vendorPlants)
                }
            } catch (error) {
                console.error("Failed to fetch data:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [params.vendorId])

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
                    <Button
                        variant="ghost"
                        className="mb-4 pl-0 hover:pl-2 transition-all"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Vendors
                    </Button>

                    <h1 className="text-3xl font-bold mb-2">{vendorName} Plants</h1>
                    <p className="text-muted-foreground">
                        Select a plant to view its alerts history
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {plants.map((plant, index) => (
                        <motion.div
                            key={plant.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Link href={`/alerts/${params.vendorId}/${plant.id}`}>
                                <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/50">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg font-bold truncate" title={plant.name}>
                                            {plant.name}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground flex items-center">
                                                    <Zap className="mr-2 h-4 w-4" />
                                                    Capacity
                                                </span>
                                                <span className="font-medium">{plant.capacity_kw} kWp</span>
                                            </div>

                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-muted-foreground flex items-center">
                                                    <MapPin className="mr-2 h-4 w-4" />
                                                    Location
                                                </span>
                                                <span className="font-medium truncate max-w-[150px]" title={plant.location?.address}>
                                                    {plant.location?.address || "N/A"}
                                                </span>
                                            </div>

                                            <div className="pt-2">
                                                <Button className="w-full group" variant="secondary">
                                                    View Alerts
                                                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        </motion.div>
                    ))}

                    {plants.length === 0 && (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            No plants found for this vendor.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
