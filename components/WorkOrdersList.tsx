"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
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
import { ExternalLink, Plus, Pencil, Trash2, Download, Upload } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { WorkOrderModal } from "@/components/WorkOrderModal"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

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

interface WorkOrdersListProps {
  accountType: string
  orgId?: number | null
  organizationName?: string
}

export function WorkOrdersList({ accountType, orgId, organizationName }: WorkOrdersListProps) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingWorkOrderId, setEditingWorkOrderId] = useState<number | undefined>()
  const [deletingWorkOrderId, setDeletingWorkOrderId] = useState<number | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<any>(null)

  const isSuperAdmin = accountType === "SUPERADMIN" || accountType === "DEVELOPER"

  useEffect(() => {
    fetchWorkOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  async function fetchWorkOrders() {
    const url = orgId ? `/api/workorders?orgId=${orgId}` : `/api/workorders`
    const response = await fetch(url)
    const data = await response.json()
    setWorkOrders(data.workOrders || [])
    setLoading(false)
  }

  function handleEdit(workOrderId: number) {
    // SUPERADMIN can open edit modal; others go to read-only detail page
    if (isSuperAdmin) {
      setEditingWorkOrderId(workOrderId)
      setModalOpen(true)
    }
  }

  function handleCreate() {
    if (!isSuperAdmin) return
    setEditingWorkOrderId(undefined)
    setModalOpen(true)
  }

  function handleModalClose() {
    setModalOpen(false)
    setEditingWorkOrderId(undefined)
    fetchWorkOrders() // Refresh list after modal closes
  }

  async function handleDelete(workOrderId: number) {
    if (!isSuperAdmin) return
    try {
      const response = await fetch(`/api/workorders/${workOrderId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Failed to delete work order")
        return
      }

      // Refresh the list
      fetchWorkOrders()
      setDeletingWorkOrderId(null)
    } catch (error) {
      console.error("Error deleting work order:", error)
      alert("Failed to delete work order")
    }
  }

  async function handleExport() {
    if (!isSuperAdmin) return
    try {
      const url = orgId ? `/api/workorders/export?orgId=${orgId}` : `/api/workorders/export`
      const response = await fetch(url)
      
      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Failed to export work orders")
        return
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = `work_orders_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (error) {
      console.error("Error exporting work orders:", error)
      alert("Failed to export work orders")
    }
  }

  async function handleImport() {
    if (!isSuperAdmin || !importFile) return
    
    setImportLoading(true)
    setImportResult(null)
    
    try {
      const formData = new FormData()
      formData.append("file", importFile)

      const response = await fetch("/api/workorders/import", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || "Failed to import work orders")
        setImportLoading(false)
        return
      }

      setImportResult(data)
      setImportLoading(false)
      
      // Refresh the list if any were processed
      if (data.summary.processed > 0) {
        fetchWorkOrders()
      }
    } catch (error) {
      console.error("Error importing work orders:", error)
      alert("Failed to import work orders")
      setImportLoading(false)
    }
  }

  const editingWorkOrder = workOrders.find((wo) => wo.id === editingWorkOrderId)
  const editingWorkOrderOrgName = editingWorkOrder?.work_order_plants?.[0]?.plants?.organizations?.name

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
      <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-4 p-4 md:p-6 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border border-border shadow-sm">
        {isSuperAdmin && (
          <>
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              className="w-full sm:w-auto"
            >
              <Button 
                onClick={handleExport}
                size="lg"
                variant="outline"
                className="w-full sm:w-auto transition-all duration-200"
              >
                <Download className="h-5 w-5 mr-2" />
                Export Excel
              </Button>
            </motion.div>
            <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
              <DialogTrigger asChild>
                <motion.div 
                  whileHover={{ scale: 1.05 }} 
                  whileTap={{ scale: 0.95 }}
                  className="w-full sm:w-auto"
                >
                  <Button 
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto transition-all duration-200"
                  >
                    <Upload className="h-5 w-5 mr-2" />
                    Import Excel
                  </Button>
                </motion.div>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Import Work Orders from Excel</DialogTitle>
                  <DialogDescription>
                    Upload an Excel file to bulk import work orders. Required columns: Title, Organization ID, Plant ID.
                    <br />
                    <br />
                    <strong>Important:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                      <li>Existing work orders will not be updated</li>
                      <li>A plant can only be mapped to one work order</li>
                      <li>All plants in a work order must belong to the same organization</li>
                      <li>Rows with errors will be reported but not processed</li>
                    </ul>
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="file">Excel File (.xlsx or .xls)</Label>
                    <Input
                      id="file"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                      className="mt-2"
                    />
                  </div>
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Required Columns:</h4>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                      <li><strong>Title</strong> - Work order title</li>
                      <li><strong>Organization ID</strong> - Organization ID (must exist)</li>
                      <li><strong>Vendor Plant ID</strong> - Vendor-specific plant identifier (must exist, unique per vendor type)</li>
                      <li><strong>Vendor Type</strong> - Vendor type (e.g., SOLARMAN, SOLARDM, PVBLINK, SHINEMONITOR, FOXESSCLOUD)</li>
                      <li><strong>Plant Name</strong> (optional) - Plant name (for reference only, not used for matching)</li>
                      <li><strong>Description</strong> (optional) - Work order description</li>
                      <li><strong>Location</strong> (optional) - Work order location</li>
                    </ul>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                      <strong>Note:</strong> Plants are identified by Vendor Plant ID and Vendor Type combination. Vendor Plant ID is unique per vendor type. Plant Name is optional and not used for matching (names can be duplicate).
                    </p>
                  </div>
                  {importResult && (
                    <div className={`p-4 rounded-lg border ${
                      importResult.summary.errors > 0 
                        ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900"
                        : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
                    }`}>
                      <h4 className="font-semibold mb-2">Import Results:</h4>
                      <div className="text-sm space-y-1">
                        <p><strong>Total Rows:</strong> {importResult.summary.totalRows}</p>
                        <p className="text-green-700 dark:text-green-300"><strong>Processed:</strong> {importResult.summary.processed}</p>
                        <p className="text-yellow-700 dark:text-yellow-300"><strong>Errors:</strong> {importResult.summary.errors}</p>
                      </div>
                      {importResult.results && importResult.results.length > 0 && (
                        <div className="mt-4">
                          <h5 className="font-medium mb-2">Error Details (first 10):</h5>
                          <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                            {importResult.results
                              .filter((r: any) => !r.success)
                              .slice(0, 10)
                              .map((r: any, idx: number) => (
                                <div key={idx} className="p-2 bg-white dark:bg-background rounded border">
                                  <p><strong>Row {r.rowNumber}:</strong> {r.error}</p>
                                  {r.plantId && <p className="text-muted-foreground">Plant ID: {r.plantId}</p>}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImportDialogOpen(false)
                      setImportFile(null)
                      setImportResult(null)
                    }}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={!importFile || importLoading}
                  >
                    {importLoading ? "Importing..." : "Import"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              className="w-full sm:w-auto"
            >
              <Button 
                onClick={handleCreate}
                size="lg"
                className="w-full sm:w-auto transition-all duration-200 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg hover:shadow-xl font-semibold text-base"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Work Order
              </Button>
            </motion.div>
          </>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block border border-border rounded-lg overflow-hidden shadow-sm bg-card">
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
                      {isSuperAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(wo.id)}
                          className="transition-all duration-200 hover:scale-110 hover:bg-primary/10"
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      )}
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
                      {isSuperAdmin && (
                        <AlertDialog open={deletingWorkOrderId === wo.id} onOpenChange={(open: boolean) => !open && setDeletingWorkOrderId(null)}>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingWorkOrderId(wo.id)}
                              className="transition-all duration-200 hover:scale-110 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Work Order</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete &quot;{wo.title}&quot;? This action cannot be undone and will remove all associated plant mappings.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(wo.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
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
          <div className="text-center py-12 text-muted-foreground border border-border rounded-lg">
            No work orders found
          </div>
        ) : (
          workOrders.map((wo, index) => (
            <div
              key={wo.id}
              className="border border-border rounded-lg p-4 bg-card hover:bg-primary/5 cursor-pointer transition-all duration-200 animate-in shadow-sm"
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
                      {isSuperAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(wo.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Link href={`/workorders/${wo.id}`}>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                      {isSuperAdmin && (
                        <AlertDialog open={deletingWorkOrderId === wo.id} onOpenChange={(open: boolean) => !open && setDeletingWorkOrderId(null)}>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingWorkOrderId(wo.id)}
                              className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Work Order</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete &quot;{wo.title}&quot;? This action cannot be undone and will remove all associated plant mappings.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(wo.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Created {new Date(wo.created_at).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>

      {isSuperAdmin && (
        <WorkOrderModal
          open={modalOpen}
          onOpenChange={handleModalClose}
          workOrderId={editingWorkOrderId}
          organizationName={organizationName || editingWorkOrderOrgName}
        />
      )}
    </div>
  )
}

