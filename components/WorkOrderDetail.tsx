"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/StatusBadge"
import { EfficiencyBadge } from "@/components/EfficiencyBadge"
import { TelemetryChart } from "@/components/TelemetryChart"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { getNextValidStatuses } from "@/lib/statusMachine"
import type { work_order_status } from "@/types/database"

interface WorkOrder {
  id: number
  title: string
  description: string | null
  priority: string
  status: work_order_status
  created_at: string
  created_by_user: { email: string }
  work_order_orgs: Array<{ orgs: { name: string } }>
  work_order_plants: Array<{
    plants: { id: number; name: string; capacity_kw: number }
    assigned_engineer: string | null
    assigned_engineer_user?: { email: string }
  }>
}

interface Efficiency {
  id: number
  plant_id: number
  recorded_at: string
  actual_gen: number
  expected_gen: number
  pr: number
  efficiency_pct: number
  category: string
  plants: { name: string }
}

interface Log {
  id: number
  message: string
  attachments: any[]
  created_at: string
  user: { email: string }
}

export function WorkOrderDetail({ workOrderId }: { workOrderId: string }) {
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [efficiency, setEfficiency] = useState<Efficiency[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [telemetry, setTelemetry] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newStatus, setNewStatus] = useState<string>("")
  const [logMessage, setLogMessage] = useState("")
  const [selectedPlantId, setSelectedPlantId] = useState<number | null>(null)

  useEffect(() => {
    fetchWorkOrder()
    fetchEfficiency()
    fetchLogs()
  }, [workOrderId])

  useEffect(() => {
    if (selectedPlantId) {
      fetchTelemetry(selectedPlantId)
    }
  }, [selectedPlantId])

  async function fetchWorkOrder() {
    const response = await fetch(`/api/workorders/${workOrderId}`)
    const data = await response.json()
    setWorkOrder(data.workOrder)
    setLoading(false)
  }

  async function fetchEfficiency() {
    const response = await fetch(`/api/workorders/${workOrderId}/efficiency`)
    const data = await response.json()
    setEfficiency(data.efficiency || [])
  }

  async function fetchLogs() {
    const response = await fetch(`/api/workorders/${workOrderId}/logs`)
    const data = await response.json()
    setLogs(data.logs || [])
  }

  async function fetchTelemetry(plantId: number) {
    const response = await fetch(`/api/plants/${plantId}/telemetry?hours=24`)
    const data = await response.json()
    setTelemetry(data.telemetry || [])
  }

  async function handleStatusUpdate() {
    if (!newStatus) return

    const response = await fetch(`/api/workorders/${workOrderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })

    if (response.ok) {
      fetchWorkOrder()
      setNewStatus("")
    } else {
      const error = await response.json()
      alert(error.error || "Failed to update status")
    }
  }

  async function handleAddLog() {
    if (!logMessage.trim()) return

    const response = await fetch(`/api/workorders/${workOrderId}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: logMessage }),
    })

    if (response.ok) {
      setLogMessage("")
      fetchLogs()
    } else {
      const error = await response.json()
      alert(error.error || "Failed to add log")
    }
  }

  async function handleRecalculateEfficiency() {
    const response = await fetch(`/api/workorders/${workOrderId}/efficiency`, {
      method: "POST",
    })

    if (response.ok) {
      fetchEfficiency()
      alert("Efficiency recalculated")
    } else {
      const error = await response.json()
      alert(error.error || "Failed to recalculate efficiency")
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  if (!workOrder) {
    return <div>Work order not found</div>
  }

  const validNextStatuses = getNextValidStatuses(workOrder.status)

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">{workOrder.title}</h1>
        <div className="flex items-center space-x-4">
          <StatusBadge status={workOrder.status} />
          <span className="text-muted-foreground">
            Priority: {workOrder.priority}
          </span>
          <span className="text-muted-foreground">
            Created by: {workOrder.created_by_user?.email}
          </span>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plants">Plants</TabsTrigger>
          <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
          <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Description</Label>
                <p className="text-muted-foreground">
                  {workOrder.description || "No description"}
                </p>
              </div>
              <div>
                <Label>Organizations</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {workOrder.work_order_orgs?.map((woOrg, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-secondary rounded text-sm"
                    >
                      {woOrg.orgs.name}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plants">
          <Card>
            <CardHeader>
              <CardTitle>Plants</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Capacity (kW)</TableHead>
                    <TableHead>Assigned Engineer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workOrder.work_order_plants?.map((woPlant) => (
                    <TableRow key={woPlant.plants.id}>
                      <TableCell>{woPlant.plants.name}</TableCell>
                      <TableCell>{woPlant.plants.capacity_kw} kW</TableCell>
                      <TableCell>
                        {woPlant.assigned_engineer_user?.email || "Unassigned"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="efficiency">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Efficiency</CardTitle>
                <Button onClick={handleRecalculateEfficiency}>
                  Recalculate
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plant</TableHead>
                    <TableHead>Actual Gen (kWh)</TableHead>
                    <TableHead>Expected Gen (kWh)</TableHead>
                    <TableHead>PR</TableHead>
                    <TableHead>Efficiency</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {efficiency.map((eff) => (
                    <TableRow key={eff.id}>
                      <TableCell>{eff.plants.name}</TableCell>
                      <TableCell>{eff.actual_gen.toFixed(2)}</TableCell>
                      <TableCell>{eff.expected_gen.toFixed(2)}</TableCell>
                      <TableCell>{eff.pr.toFixed(4)}</TableCell>
                      <TableCell>{eff.efficiency_pct.toFixed(1)}%</TableCell>
                      <TableCell>
                        <EfficiencyBadge
                          category={eff.category}
                          efficiencyPct={eff.efficiency_pct}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="telemetry">
          <Card>
            <CardHeader>
              <CardTitle>Telemetry</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label>Select Plant</Label>
                <Select
                  value={selectedPlantId?.toString() || ""}
                  onValueChange={(value) =>
                    setSelectedPlantId(parseInt(value))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plant" />
                  </SelectTrigger>
                  <SelectContent>
                    {workOrder.work_order_plants?.map((woPlant) => (
                      <SelectItem
                        key={woPlant.plants.id}
                        value={woPlant.plants.id.toString()}
                      >
                        {woPlant.plants.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedPlantId && telemetry.length > 0 && (
                <TelemetryChart
                  data={telemetry}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-4">
                <div>
                  <Label htmlFor="logMessage">Add Log</Label>
                  <Textarea
                    id="logMessage"
                    value={logMessage}
                    onChange={(e) => setLogMessage(e.target.value)}
                    rows={3}
                    className="mt-2"
                  />
                </div>
                <Button onClick={handleAddLog}>Add Log</Button>
              </div>
              <div className="space-y-4">
                {logs.map((log) => (
                  <div key={log.id} className="border rounded p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium">{log.user.email}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                    <p className="text-muted-foreground">{log.message}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle>Update Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Current Status</Label>
                  <div className="mt-2">
                    <StatusBadge status={workOrder.status} />
                  </div>
                </div>
                {validNextStatuses.length > 0 && (
                  <div className="mt-2">
                    <Label>New Status</Label>
                    <Select
                      value={newStatus}
                      onValueChange={setNewStatus}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select new status" />
                      </SelectTrigger>
                      <SelectContent>
                        {validNextStatuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {newStatus && (
                  <Button onClick={handleStatusUpdate}>Update Status</Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

