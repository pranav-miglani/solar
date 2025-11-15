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
      <Card className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Alerts
        </h3>
        <div className="text-center text-muted-foreground py-8">
          No alerts to display
        </div>
      </Card>
    )
  }

  return (
    <Card className="glass-card p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5" />
        Alerts ({alerts.length})
      </h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="p-4 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="font-medium">{alert.title}</h4>
                {alert.plants && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Plant: {alert.plants.name}
                  </p>
                )}
              </div>
              <Badge className={severityColors[alert.severity]}>
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
    </Card>
  )
}

