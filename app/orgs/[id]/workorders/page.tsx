"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { DashboardSidebar } from "@/components/DashboardSidebar"
import { WorkOrdersList } from "@/components/WorkOrdersList"
import { OrganizationProductionOverview } from "@/components/OrganizationProductionOverview"
import { useUser } from "@/context/UserContext"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function OrgWorkOrdersPage() {
  const router = useRouter()
  const params = useParams()
  const orgId = params?.id ? parseInt(params.id as string, 10) : null
  const { account, loading: userLoading, error: userError } = useUser()
  const [organizationName, setOrganizationName] = useState<string>("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) {
      router.push("/orgs")
      return
    }

    if (userLoading) {
      return
    }

    if (userError || !account) {
      router.push("/auth/login")
      return
    }

    // Fetch organization name
    fetch(`/api/orgs/${orgId}`)
      .then((res) => res.json())
      .then((orgData) => {
        if (orgData.org) {
          setOrganizationName(orgData.org.name)
        }
      })
      .catch(() => {
        // If org fetch fails, continue anyway
      })
      .finally(() => {
        setLoading(false)
      })
  }, [orgId, router, userLoading, userError, account])

  if (userLoading || loading || !account) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  const accountType = account.accountType

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardSidebar />
      <div className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <Link href="/orgs">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Organizations
                </Button>
              </Link>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
                  Work Orders
                </h1>
                <p className="text-sm md:text-base text-muted-foreground mt-1">
                  {organizationName ? (
                    <>
                      Work orders for <span className="font-semibold text-foreground">{organizationName}</span>
                    </>
                  ) : (
                    "View work orders for this organization"
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Organization Production Overview - shown for all users */}
        {orgId && (
          <div className="mb-8">
            <OrganizationProductionOverview
              orgId={orgId}
              organizationName={organizationName || undefined}
              accountType={accountType}
            />
          </div>
        )}
        
        <WorkOrdersList accountType={accountType} orgId={orgId} organizationName={organizationName} />
      </div>
    </div>
  )
}

