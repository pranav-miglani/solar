"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/DashboardSidebar"
import { CreateWorkOrderForm } from "@/components/CreateWorkOrderForm"
import { useAuth } from "@/hooks/useAuth"

export default function CreateWorkOrderPage() {
  const router = useRouter()
  const { account, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    
    // Only SUPERADMIN can create work orders
    if (account && account.accountType !== "SUPERADMIN") {
      router.push("/dashboard")
    }
  }, [account, loading, router])

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

  if (!account) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardSidebar />
      <div className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 text-foreground">Create Work Order</h1>
          <CreateWorkOrderForm />
        </div>
      </div>
    </div>
  )
}

