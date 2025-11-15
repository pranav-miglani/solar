"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"
import { format } from "date-fns"

interface Alert {
  id: number
  title: string
  description?: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  status: "ACTIVE" | "RESOLVED" | "ACKNOWLEDGED"
  created_at: string
  plants?: {
    id: number
    name: string
  }
}

interface AlertsFeedProps {
  alerts: Alert[]
}

const severityColors = {
  LOW: "bg-blue-500/20 text-blue-500",
  MEDIUM: "bg-yellow-500/20 text-yellow-500",
  HIGH: "bg-orange-500/20 text-orange-500",
  CRITICAL: "bg-red-500/20 text-red-500",
}

export function AlertsFeed({ alerts }: AlertsFeedProps) {
  if (alerts.length === 0) {
    return (
      <Card className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-50/80 via-orange-50/80 to-red-50/80 dark:from-amber-950/50 dark:via-orange-950/50 dark:to-red-950/50 border-2 border-amber-200/50 dark:border-amber-800/50 p-6">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-red-500/5 opacity-50" />
        <div className="relative">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 p-1.5">
              <AlertTriangle className="h-full w-full text-white" />
            </div>
            Alerts
          </h3>
          <div className="text-center text-muted-foreground py-8">
            No alerts to display
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-50/80 via-orange-50/80 to-red-50/80 dark:from-amber-950/50 dark:via-orange-950/50 dark:to-red-950/50 border-2 border-amber-200/50 dark:border-amber-800/50 p-6 hover:shadow-2xl transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-red-500/5 opacity-50" />
      <div className="relative">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 p-1.5">
            <AlertTriangle className="h-full w-full text-white" />
          </div>
          Alerts ({alerts.length})
        </h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="group relative p-4 rounded-xl border-2 border-amber-200/30 dark:border-amber-800/30 bg-gradient-to-br from-background/80 to-muted/40 hover:from-background hover:to-muted/60 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-lg transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-base group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    {alert.title}
                  </h4>
                  {alert.plants && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Plant: {alert.plants.name}
                    </p>
                  )}
                </div>
                <Badge className={`${severityColors[alert.severity]} font-semibold shadow-sm`}>
                  {alert.severity}
                </Badge>
              </div>
              {alert.description && (
                <p className="text-sm text-muted-foreground mb-2">
                  {alert.description}
                </p>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{format(new Date(alert.created_at), "PPp")}</span>
                <Badge variant="outline">{alert.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

