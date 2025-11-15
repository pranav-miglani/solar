"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ExternalLink, Plus, Pencil } from "lucide-react"
import { WorkOrderModal } from "@/components/WorkOrderModal"
import { Badge } from "@/components/ui/badge"
import type { work_order_status, work_order_priority } from "@/types/database"

interface WorkOrder {
  id: number
  title: string
  description: string | null
  priority: work_order_priority
  status: work_order_status
  created_at: string
  created_by_user: { email: string }
  work_order_plants?: Array<{
    plants: {
      organizations: { name: string }
    }
  }>
}

export function WorkOrdersList() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [editingWorkOrderId, setEditingWorkOrderId] = useState<number | undefined>()

  useEffect(() => {
    fetchWorkOrders()
  }, [statusFilter, priorityFilter])

  async function fetchWorkOrders() {
    const params = new URLSearchParams()
    if (statusFilter !== "all") params.append("status", statusFilter)
    if (priorityFilter !== "all") params.append("priority", priorityFilter)

    const response = await fetch(`/api/workorders?${params.toString()}`)
    const data = await response.json()
    setWorkOrders(data.workOrders || [])
    setLoading(false)
  }

  function handleEdit(workOrderId: number) {
    setEditingWorkOrderId(workOrderId)
    setModalOpen(true)
  }

  function handleCreate() {
    setEditingWorkOrderId(undefined)
    setModalOpen(true)
  }

  function handleModalClose() {
    setModalOpen(false)
    setEditingWorkOrderId(undefined)
    fetchWorkOrders() // Refresh list after modal closes
  }

  const editingWorkOrder = workOrders.find((wo) => wo.id === editingWorkOrderId)
  const organizationName = editingWorkOrder?.work_order_plants?.[0]?.plants?.organizations?.name

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading work orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border">
        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 transition-all duration-200 hover:border-primary/50">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="ASSIGNED">Assigned</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="WAITING_VALIDATION">Waiting Validation</SelectItem>
              <SelectItem value="BLOCKED">Blocked</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-48 transition-all duration-200 hover:border-primary/50">
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button 
          onClick={handleCreate}
          className="transition-all duration-200 hover:scale-105 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Work Order
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-muted/50">
              <TableHead className="font-semibold">Title</TableHead>
              <TableHead className="font-semibold">Priority</TableHead>
              <TableHead className="font-semibold">Created By</TableHead>
              <TableHead className="font-semibold">Created At</TableHead>
              <TableHead className="font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No work orders found
                </TableCell>
              </TableRow>
            ) : (
              workOrders.map((wo, index) => (
                <TableRow 
                  key={wo.id}
                  className="transition-all duration-200 hover:bg-primary/5 cursor-pointer group animate-in"
                  style={{
                    animationDelay: `${index * 50}ms`
                  }}
                  onClick={() => handleEdit(wo.id)}
                >
                  <TableCell className="font-medium group-hover:text-primary transition-colors">
                    {wo.title}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        wo.priority === "HIGH" 
                          ? "destructive" 
                          : wo.priority === "MEDIUM" 
                          ? "default" 
                          : "secondary"
                      }
                      className="transition-all duration-200"
                    >
                      {wo.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {wo.created_by_user?.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(wo.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div 
                      className="flex gap-2 justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(wo.id)}
                        className="transition-all duration-200 hover:scale-110 hover:bg-primary/10"
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Link href={`/workorders/${wo.id}`}>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="transition-all duration-200 hover:scale-110 hover:bg-primary/10"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <WorkOrderModal
        open={modalOpen}
        onOpenChange={handleModalClose}
        workOrderId={editingWorkOrderId}
        organizationName={organizationName}
      />
    </div>
  )
}

