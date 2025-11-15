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
import { StatusBadge } from "@/components/StatusBadge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { work_order_status, work_order_priority } from "@/types/database"

interface WorkOrder {
  id: number
  title: string
  description: string | null
  priority: work_order_priority
  status: work_order_status
  created_at: string
  created_by_user: { email: string }
}

export function WorkOrdersList() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")

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

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <div className="mb-4 flex space-x-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
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
          <SelectTrigger className="w-48">
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workOrders.map((wo) => (
            <TableRow key={wo.id}>
              <TableCell className="font-medium">{wo.title}</TableCell>
              <TableCell>
                <StatusBadge status={wo.status} />
              </TableCell>
              <TableCell>{wo.priority}</TableCell>
              <TableCell>{wo.created_by_user?.email}</TableCell>
              <TableCell>
                {new Date(wo.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Link href={`/workorders/${wo.id}`}>
                  <button className="text-primary hover:underline">View</button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

