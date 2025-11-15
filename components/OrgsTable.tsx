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

interface Org {
  id: number
  name: string
  meta: Record<string, any>
}

interface Account {
  id: string
  email: string
  account_type: string
  org_id: number | null
}

export function OrgsTable() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [selectedOrg, setSelectedOrg] = useState<Org | null>(null)
  const [formData, setFormData] = useState({ name: "" })
  const [accountFormData, setAccountFormData] = useState({ 
    email: "", 
    password: "" 
  })

  useEffect(() => {
    fetchOrgs()
    fetchAccounts()
  }, [])

  async function fetchOrgs() {
    const response = await fetch("/api/orgs")
    const data = await response.json()
    setOrgs(data.orgs || [])
    setLoading(false)
  }

  async function fetchAccounts() {
    const response = await fetch("/api/accounts")
    if (response.ok) {
      const data = await response.json()
      setAccounts(data.accounts || [])
    }
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

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault()
    
    if (!selectedOrg) return

    const response = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: accountFormData.email,
        password: accountFormData.password,
        account_type: "ORG",
        org_id: selectedOrg.id,
      }),
    })

    if (response.ok) {
      setAccountDialogOpen(false)
      setAccountFormData({ email: "", password: "" })
      fetchAccounts()
      fetchOrgs()
    } else {
      const error = await response.json()
      alert(error.error || "Failed to create account")
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
            <TableHead>Organization Name</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orgs.map((org) => {
            const orgAccount = accounts.find((acc) => acc.org_id === org.id)
            return (
              <TableRow key={org.id}>
                <TableCell className="font-medium">{org.name}</TableCell>
                <TableCell>
                  {orgAccount ? (
                    <div>
                      <div className="font-medium">{orgAccount.email}</div>
                      <div className="text-sm text-muted-foreground">
                        {orgAccount.account_type}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      No account
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedOrg(org)
                      setAccountFormData({ email: "", password: "" })
                      setAccountDialogOpen(true)
                    }}
                  >
                    {orgAccount ? "View Account" : "Create Account"}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {accounts.find((acc) => acc.org_id === selectedOrg?.id)
                ? "Organization Account"
                : `Create Account for ${selectedOrg?.name}`}
            </DialogTitle>
          </DialogHeader>
          {accounts.find((acc) => acc.org_id === selectedOrg?.id) ? (
            <div className="space-y-2">
              <div>
                <Label>Email</Label>
                <div className="text-sm font-medium">
                  {accounts.find((acc) => acc.org_id === selectedOrg?.id)?.email}
                </div>
              </div>
              <div>
                <Label>Account Type</Label>
                <div className="text-sm font-medium">ORG</div>
              </div>
              <p className="text-sm text-muted-foreground">
                Each organization has one account. To change the account, delete
                the existing one and create a new one.
              </p>
            </div>
          ) : (
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={accountFormData.email}
                  onChange={(e) =>
                    setAccountFormData({
                      ...accountFormData,
                      email: e.target.value,
                    })
                  }
                  required
                  placeholder="org@example.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={accountFormData.password}
                  onChange={(e) =>
                    setAccountFormData({
                      ...accountFormData,
                      password: e.target.value,
                    })
                  }
                  required
                  placeholder="Enter password"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAccountDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Account</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

