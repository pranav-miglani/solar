"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useUser } from "@/context/UserContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, ChevronDown, ChevronRight, Settings, Zap, Building2, Database, ArrowLeft } from "lucide-react"
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard"
import { DashboardSidebar } from "@/components/DashboardSidebar"

export default function AnalyticsPage() {
  const { account, loading: userLoading } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!userLoading && account) {
      const accountType = account.accountType
      if (accountType !== "SUPERADMIN" && accountType !== "DEVELOPER") {
        router.push("/dashboard")
      }
    }
  }, [account, userLoading, router])

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!account || (account.accountType !== "SUPERADMIN" && account.accountType !== "DEVELOPER")) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardSidebar />
      
      <div className="md:ml-64 p-4 md:p-6 pt-16 md:pt-8">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Database className="h-8 w-8" />
                Analytics Dashboard
              </h1>
              <p className="text-muted-foreground mt-2">
                View analytics replica configuration and plant energy data
              </p>
            </div>
            <Link href="/dashboard">
              <Button variant="outline" className="w-full sm:w-auto">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
        <AnalyticsDashboard accountType={account.accountType} />
      </div>
    </div>
  )
}

