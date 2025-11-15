"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/StatusBadge"
import { Button } from "@/components/ui/button"

interface WorkOrder {
  id: number
  title: string
  description: string | null
  priority: string
  status: string
  created_at: string
  work_order_plants: Array<{
    plants: { name: string }
  }>
}

export function EngineerTasksList() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWorkOrders()
  }, [])

  async function fetchWorkOrders() {
    const response = await fetch("/api/workorders")
    const data = await response.json()
    setWorkOrders(data.workOrders || [])
    setLoading(false)
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (workOrders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No assigned work orders
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {workOrders.map((wo) => (
        <Card key={wo.id}>
          <CardHeader>
            <CardTitle className="text-lg">{wo.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <StatusBadge status={wo.status as any} />
            </div>
            <div className="text-sm text-muted-foreground">
              <div>Priority: {wo.priority}</div>
              <div>
                Plants:{" "}
                {wo.work_order_plants
                  ?.map((p) => p.plants.name)
                  .join(", ") || "None"}
              </div>
              <div>
                Created: {new Date(wo.created_at).toLocaleDateString()}
              </div>
            </div>
            <Link href={`/workorders/${wo.id}`}>
              <Button className="w-full">View Details</Button>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

