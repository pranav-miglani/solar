"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/DashboardSidebar"
import { CreateWorkOrderForm } from "@/components/CreateWorkOrderForm"

export default function CreateWorkOrderPage() {
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
          const userAccountType = data.account.accountType
          setAccountType(userAccountType)
          
          // Only SUPERADMIN can create work orders
          if (userAccountType !== "SUPERADMIN") {
            router.push("/dashboard")
          }
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
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Create Work Order</h1>
          <CreateWorkOrderForm />
        </div>
      </div>
    </div>
  )
}

