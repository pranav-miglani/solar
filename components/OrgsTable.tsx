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
import { createClient } from "@/lib/supabase/client"

interface Org {
  id: number
  name: string
  meta: Record<string, any>
}

interface User {
  id: string
  email: string
  role: string
}

export function OrgsTable() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null)
  const [formData, setFormData] = useState({ name: "" })

  useEffect(() => {
    fetchOrgs()
    fetchUsers()
  }, [])

  async function fetchOrgs() {
    const response = await fetch("/api/orgs")
    const data = await response.json()
    setOrgs(data.orgs || [])
    setLoading(false)
  }

  async function fetchUsers() {
    const response = await fetch("/api/users")
    const data = await response.json()
    setUsers(data.users || [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const response = await fetch("/api/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    })

    if (response.ok) {
      setDialogOpen(false)
      setFormData({ name: "" })
      fetchOrgs()
    } else {
      const error = await response.json()
      alert(error.error || "Failed to create organization")
    }
  }

  async function handleAssignUser(userId: string, orgId: number) {
    const response = await fetch("/api/user-orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, org_id: orgId }),
    })

    if (response.ok) {
      setAssignDialogOpen(false)
      fetchOrgs()
    } else {
      const error = await response.json()
      alert(error.error || "Failed to assign user")
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
            <Button onClick={() => setFormData({ name: "" })}>
              Create Organization
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Organization</DialogTitle>
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
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orgs.map((org) => (
            <TableRow key={org.id}>
              <TableCell>{org.name}</TableCell>
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedOrg(org)
                    setAssignDialogOpen(true)
                  }}
                >
                  Assign Users
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Assign Users to {selectedOrg?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-2 border rounded"
              >
                <div>
                  <div className="font-medium">{user.email}</div>
                  <div className="text-sm text-muted-foreground">
                    {user.role}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    selectedOrg && handleAssignUser(user.id, selectedOrg.id)
                  }
                >
                  Assign
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

