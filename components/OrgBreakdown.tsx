"use client"

import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Building2, Zap, AlertTriangle } from "lucide-react"
import { useEffect, useState } from "react"

interface OrgBreakdownData {
  orgId: number
  orgName: string
  totalPlants: number
  totalAlerts: number
  activeAlerts: number
  totalGeneration24h: number
}

export function OrgBreakdown() {
  const [orgData, setOrgData] = useState<OrgBreakdownData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch organizations and their metrics
    Promise.all([
      fetch("/api/orgs").then((res) => res.json()),
      fetch("/api/plants").then((res) => res.json()),
      fetch("/api/alerts").then((res) => res.json()),
    ])
      .then(([orgsRes, plantsRes, alertsRes]) => {
        const orgs = orgsRes.orgs || []
        const plants = plantsRes.plants || []
        const alerts = alertsRes.alerts || []

        // Calculate metrics per organization
        const breakdown = orgs.map((org: any) => {
          const orgPlants = plants.filter(
            (p: any) => p.org_id === org.id
          )
          const orgPlantIds = orgPlants.map((p: any) => p.id)
          const orgAlerts = alerts.filter((a: any) =>
            orgPlantIds.includes(a.plant_id)
          )
          const activeAlerts = orgAlerts.filter(
            (a: any) => a.status === "ACTIVE"
          )

          // Calculate 24h generation (would need telemetry data)
          // For now, using placeholder
          const totalGeneration24h = 0 // Would fetch from telemetry API

          return {
            orgId: org.id,
            orgName: org.name,
            totalPlants: orgPlants.length,
            totalAlerts: orgAlerts.length,
            activeAlerts: activeAlerts.length,
            totalGeneration24h,
          }
        })

        setOrgData(breakdown)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="glass-card">
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (orgData.length === 0) {
    return (
      <Card className="glass-card">
        <p className="text-muted-foreground text-sm">
          No organization data available.
        </p>
      </Card>
    )
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Organization Breakdown</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orgData.map((org, idx) => (
          <motion.div
            key={org.orgId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
          >
            <Card className="glass-card hover:shadow-xl transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">{org.orgName}</h4>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Plants</span>
                  </div>
                  <span className="font-semibold">{org.totalPlants}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Alerts</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{org.totalAlerts}</div>
                    {org.activeAlerts > 0 && (
                      <div className="text-xs text-red-600 dark:text-red-400">
                        {org.activeAlerts} active
                      </div>
                    )}
                  </div>
                </div>

                {org.totalGeneration24h > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">
                      24h Generation
                    </span>
                    <span className="font-semibold">
                      {(org.totalGeneration24h / 1000).toFixed(1)} MWh
                    </span>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

