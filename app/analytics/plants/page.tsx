"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@/context/UserContext"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Building2 } from "lucide-react"
import { AnalyticsPlantsList } from "@/components/AnalyticsPlantsList"

function PlantsPageContent() {
  const { account, loading: userLoading } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const vendorId = searchParams.get("vendorId")

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
    router.push("/dashboard")
    return null
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => router.push("/analytics")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Analytics
        </Button>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="h-8 w-8" />
          Plants
        </h1>
      </div>
      <AnalyticsPlantsList vendorId={vendorId ? parseInt(vendorId) : undefined} />
    </div>
  )
}

export default function AnalyticsPlantsPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    }>
      <PlantsPageContent />
    </Suspense>
  )
}
