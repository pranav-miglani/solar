"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { DashboardSidebar } from "@/components/DashboardSidebar"
import { WorkOrdersList } from "@/components/WorkOrdersList"
import { useUser } from "@/context/UserContext"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"

interface Organization {
  id: number
  name: string
  work_order_count?: number
}

export default function WorkOrdersPage() {
  const router = useRouter()
  const { account, loading, error } = useUser()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(true)

  useEffect(() => {
    if (loading) return
    
    if (error || !account) {
      router.push("/auth/login")
    }
  }, [loading, error, account, router])

  useEffect(() => {
    // Show org list for SUPERADMIN / DEVELOPER / GOVT users
    if (account && (account.accountType === "GOVT" || account.accountType === "SUPERADMIN" || account.accountType === "DEVELOPER")) {
      fetchOrganizations()
    } else if (account?.accountType === "ORG" && account.orgId) {
      // For ORG users, redirect directly to their org's work orders page
      router.push(`/orgs/${account.orgId}/workorders`)
    }
  }, [account, router])

  async function fetchOrganizations() {
    try {
      const response = await fetch("/api/orgs")
      const data = await response.json()
      if (data.orgs) {
        // Fetch work order counts for each org
        const orgsWithCounts = await Promise.all(
          data.orgs.map(async (org: Organization) => {
            const woResponse = await fetch(`/api/workorders?orgId=${org.id}`)
            const woData = await woResponse.json()
            return {
              ...org,
              work_order_count: woData.workOrders?.length || 0
            }
          })
        )
        setOrgs(orgsWithCounts)
      }
      setLoadingOrgs(false)
    } catch (error) {
      console.error("Error fetching organizations:", error)
      setLoadingOrgs(false)
    }
  }

  if (loading || loadingOrgs) {
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

  const accountType = account.accountType

  // For SUPERADMIN, DEVELOPER, and GOVT users, show list of organizations
  if (accountType === "GOVT" || accountType === "SUPERADMIN" || accountType === "DEVELOPER") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <DashboardSidebar />
        <div className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
          <div className="mb-6 md:mb-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
                  Work Orders
                </h1>
                <p className="text-sm md:text-base text-muted-foreground mt-1">
                  Select an organization to view its work orders
                </p>
              </div>
            </div>
          </div>

          {orgs.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No organizations found</p>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {orgs.map((org, index) => (
                <motion.div
                  key={org.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link href={`/orgs/${org.id}/workorders`}>
                    <Card className="p-6 hover:bg-primary/5 cursor-pointer transition-all duration-200 border-2 hover:border-primary/50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Building2 className="h-5 w-5 text-primary" />
                            <h3 className="text-lg font-semibold">{org.name}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {org.work_order_count || 0} work order{org.work_order_count !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // This should not be reached for ORG users (they get redirected)
  // But keep as fallback for SUPERADMIN/DEVELOPER if they don't select an org
  return null
}

