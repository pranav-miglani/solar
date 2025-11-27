"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/DashboardSidebar"
import { WorkOrdersList } from "@/components/WorkOrdersList"

export default function WorkOrdersPage() {
  const router = useRouter()
  const [accountType, setAccountType] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check authentication
    fetch("/api/me")
      .then((res) => {
        if (!res.ok) {
          router.push("/auth/login")
          return null
        }
        return res.json()
      })
      .then((data) => {
        if (data) {
          setAccountType(data.account.accountType)
        }
      })
      .catch(() => {
        router.push("/auth/login")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardSidebar accountType={accountType} />
      <div className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
                Work Orders
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                Manage and track work orders
              </p>
            </div>
          </div>
        </div>
        <WorkOrdersList accountType={accountType} />
      </div>
    </div>
  )
}

