"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useUser } from "@/context/UserContext"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { PlantEnergyAnalytics } from "@/components/PlantEnergyAnalytics"

export default function AnalyticsPlantDetailPage() {
  const { account, loading: userLoading } = useUser()
  const router = useRouter()
  const params = useParams()
  const plantId = params?.id as string

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
        <Button variant="ghost" onClick={() => router.push("/analytics/plants")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Plants
        </Button>
      </div>
      <PlantEnergyAnalytics plantId={plantId} />
    </div>
  )
}

