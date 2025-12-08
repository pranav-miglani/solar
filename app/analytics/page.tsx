"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/context/UserContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, ChevronDown, ChevronRight, Settings, Zap, Building2, Database } from "lucide-react"
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard"

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
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (!account || (account.accountType !== "SUPERADMIN" && account.accountType !== "DEVELOPER")) {
    return null
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Database className="h-8 w-8" />
          Analytics Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          View analytics replica configuration and plant energy data
        </p>
      </div>
      <AnalyticsDashboard accountType={account.accountType} />
    </div>
  )
}

