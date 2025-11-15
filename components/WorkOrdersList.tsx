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
import { Button } from "@/components/ui/button"
import { ExternalLink, Plus, Pencil } from "lucide-react"
import { WorkOrderModal } from "@/components/WorkOrderModal"

interface WorkOrder {
  id: number
  title: string
  description: string | null
  created_at: string
  work_order_plants?: Array<{
    plants: {
      organizations: { name: string }
    }
  }>
}

export function WorkOrdersList() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingWorkOrderId, setEditingWorkOrderId] = useState<number | undefined>()

  useEffect(() => {
    fetchWorkOrders()
  }, [])

  async function fetchWorkOrders() {
    const response = await fetch(`/api/workorders`)
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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border">
        <div className="flex flex-wrap gap-3">
          {/* Filters removed - priority and created_by no longer displayed */}
        </div>
        <Button 
          onClick={handleCreate}
          className="w-full sm:w-auto transition-all duration-200 hover:scale-105 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Work Order
        </Button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block border rounded-lg overflow-hidden shadow-sm bg-card">
        <div className="overflow-x-auto">
          <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-muted/50">
              <TableHead className="font-semibold">Title</TableHead>
              <TableHead className="font-semibold">Created At</TableHead>
              <TableHead className="font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
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
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {workOrders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-lg">
            No work orders found
          </div>
        ) : (
          workOrders.map((wo, index) => (
            <div
              key={wo.id}
              className="border rounded-lg p-4 bg-card hover:bg-primary/5 cursor-pointer transition-all duration-200 animate-in shadow-sm"
              style={{
                animationDelay: `${index * 50}ms`
              }}
              onClick={() => handleEdit(wo.id)}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="font-semibold text-base flex-1">{wo.title}</h3>
                <div 
                  className="flex gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(wo.id)}
                    className="h-8 w-8 p-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Link href={`/workorders/${wo.id}`}>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-8 w-8 p-0"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Created {new Date(wo.created_at).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
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

