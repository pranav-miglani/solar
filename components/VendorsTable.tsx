"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"

interface Vendor {
  id: number
  name: string
  api_base_url: string
  credentials: Record<string, any>
  is_active: boolean
}

export function VendorsTable() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    api_base_url: "",
    appId: "",
    appSecret: "",
    username: "",
    passwordSha256: "",
    is_active: true,
  })

  useEffect(() => {
    fetchVendors()
  }, [])

  async function fetchVendors() {
    const supabase = createClient()
    const response = await fetch("/api/vendors")
    const data = await response.json()
    setVendors(data.vendors || [])
    setLoading(false)
  }

  function openDialog(vendor?: Vendor) {
    if (vendor) {
      setEditingVendor(vendor)
      setFormData({
        name: vendor.name,
        api_base_url: vendor.api_base_url,
        appId: vendor.credentials.appId || "",
        appSecret: vendor.credentials.appSecret || "",
        username: vendor.credentials.username || "",
        passwordSha256: vendor.credentials.passwordSha256 || "",
        is_active: vendor.is_active,
      })
    } else {
      setEditingVendor(null)
      setFormData({
        name: "",
        api_base_url: "",
        appId: "",
        appSecret: "",
        username: "",
        passwordSha256: "",
        is_active: true,
      })
    }
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const credentials = {
      appId: formData.appId,
      appSecret: formData.appSecret,
      username: formData.username,
      passwordSha256: formData.passwordSha256,
    }

    const url = editingVendor
      ? `/api/vendors/${editingVendor.id}`
      : "/api/vendors"
    const method = editingVendor ? "PUT" : "POST"

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.name,
        api_base_url: formData.api_base_url,
        credentials,
        is_active: formData.is_active,
      }),
    })

    if (response.ok) {
      setDialogOpen(false)
      fetchVendors()
    } else {
      const error = await response.json()
      alert(error.error || "Failed to save vendor")
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this vendor?")) return

    const response = await fetch(`/api/vendors/${id}`, {
      method: "DELETE",
    })

    if (response.ok) {
      fetchVendors()
    } else {
      const error = await response.json()
      alert(error.error || "Failed to delete vendor")
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <div className="mb-4">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>Add Vendor</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingVendor ? "Edit Vendor" : "Add Vendor"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="api_base_url">API Base URL</Label>
                <Input
                  id="api_base_url"
                  value={formData.api_base_url}
                  onChange={(e) =>
                    setFormData({ ...formData, api_base_url: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="appId">App ID</Label>
                <Input
                  id="appId"
                  value={formData.appId}
                  onChange={(e) =>
                    setFormData({ ...formData, appId: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="appSecret">App Secret</Label>
                <Input
                  id="appSecret"
                  type="password"
                  value={formData.appSecret}
                  onChange={(e) =>
                    setFormData({ ...formData, appSecret: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="passwordSha256">Password (SHA256)</Label>
                <Input
                  id="passwordSha256"
                  type="password"
                  value={formData.passwordSha256}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      passwordSha256: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>API URL</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendors.map((vendor) => (
            <TableRow key={vendor.id}>
              <TableCell>{vendor.name}</TableCell>
              <TableCell className="font-mono text-sm">
                {vendor.api_base_url}
              </TableCell>
              <TableCell>
                {vendor.is_active ? (
                  <span className="text-green-600">Active</span>
                ) : (
                  <span className="text-gray-400">Inactive</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDialog(vendor)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(vendor.id)}
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

