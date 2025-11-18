"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import Link from "next/link"
import { ExternalLink, Building2, Plus, User, Mail, Trash2 } from "lucide-react"
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

interface Org {
  id: number
  name: string
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
  const [deletingOrgId, setDeletingOrgId] = useState<number | null>(null)
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

  async function handleDelete(orgId: number) {
    try {
      const response = await fetch(`/api/orgs/${orgId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || "Failed to delete organization")
        return
      }

      // Refresh the list
      fetchOrgs()
      fetchAccounts()
      setDeletingOrgId(null)
    } catch (error) {
      console.error("Error deleting organization:", error)
      alert("Failed to delete organization")
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
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading organizations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={() => setFormData({ name: "" })}
                size="lg"
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 font-semibold"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Organization
              </Button>
            </motion.div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Create Organization
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold">
                  Organization Name
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  placeholder="Enter organization name"
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="transition-all duration-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white transition-all duration-200"
                >
                  Create
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block">
        <Card className="border-2 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-muted/50 to-muted/30 border-b-2">
                <TableHead className="font-bold text-base w-[25%]">Organization Name</TableHead>
                <TableHead className="font-bold text-base w-[30%]">Account</TableHead>
                <TableHead className="font-bold text-base text-right w-[45%]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <Building2 className="h-12 w-12 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground font-medium">
                        No organizations found
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Create your first organization to get started
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                orgs.map((org, index) => {
                  const orgAccount = accounts.find((acc) => acc.org_id === org.id)
                  return (
                    <TableRow
                      key={org.id}
                      className="border-b hover:bg-gradient-to-r hover:from-primary/5 hover:to-primary/10 transition-all duration-200"
                    >
                      <TableCell className="font-semibold text-base py-4 align-middle">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 flex-shrink-0">
                            <Building2 className="h-full w-full text-white" />
                          </div>
                          <span className="truncate">{org.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 align-middle">
                        {orgAccount ? (
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="font-medium truncate">{orgAccount.email}</span>
                            </div>
                            <Badge variant="secondary" className="text-xs w-fit">
                              {orgAccount.account_type}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm flex items-center gap-2">
                            <User className="h-4 w-4 flex-shrink-0" />
                            <span>No account</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 align-middle">
                        <div className="flex items-center justify-end gap-2 flex-nowrap">
                          <Link href={`/orgs/${org.id}/plants`}>
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                              <Button
                                variant="default"
                                size="sm"
                                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap font-medium px-3"
                              >
                                <ExternalLink className="h-4 w-4 mr-1.5" />
                                <span className="hidden lg:inline">View Plants</span>
                                <span className="lg:hidden">Plants</span>
                              </Button>
                            </motion.div>
                          </Link>
                          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedOrg(org)
                                setAccountFormData({ email: "", password: "" })
                                setAccountDialogOpen(true)
                              }}
                              className="border-2 border-border bg-background hover:bg-primary/10 hover:border-primary/50 transition-all duration-200 whitespace-nowrap font-medium shadow-sm hover:shadow-md px-3"
                            >
                              {orgAccount ? (
                                <>
                                  <User className="h-4 w-4 mr-1.5" />
                                  <span className="hidden lg:inline">View Account</span>
                                  <span className="lg:hidden">Account</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="h-4 w-4 mr-1.5" />
                                  <span className="hidden lg:inline">Create Account</span>
                                  <span className="lg:hidden">Create</span>
                                </>
                              )}
                            </Button>
                          </motion.div>
                          <AlertDialog open={deletingOrgId === org.id} onOpenChange={(open: boolean) => !open && setDeletingOrgId(null)}>
                            <AlertDialogTrigger asChild>
                              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDeletingOrgId(org.id)}
                                  className="border-2 border-destructive/30 bg-background hover:bg-destructive/10 hover:border-destructive hover:text-destructive transition-all duration-200 whitespace-nowrap font-medium shadow-sm hover:shadow-md px-3"
                                >
                                  <Trash2 className="h-4 w-4 mr-1.5" />
                                  Delete
                                </Button>
                              </motion.div>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{org.name}"? This action cannot be undone and will delete:
                                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                                    <li>All associated work orders</li>
                                    <li>All associated plants</li>
                                    <li>All associated vendors</li>
                                    <li>All associated accounts</li>
                                  </ul>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(org.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          </div>
        </Card>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {orgs.length === 0 ? (
          <Card className="p-8 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground opacity-50 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium mb-2">
              No organizations found
            </p>
            <p className="text-sm text-muted-foreground">
              Create your first organization to get started
            </p>
          </Card>
        ) : (
          orgs.map((org, index) => {
            const orgAccount = accounts.find((acc) => acc.org_id === org.id)
            return (
              <motion.div
                key={org.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="p-4 border-2 hover:shadow-lg transition-all duration-200">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-3 flex-shrink-0">
                          <Building2 className="h-full w-full text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg truncate">{org.name}</h3>
                          {orgAccount ? (
                            <div className="flex items-center gap-2 mt-1">
                              <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm text-muted-foreground truncate">
                                {orgAccount.email}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 mt-1">
                              <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">
                                No account
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {orgAccount && (
                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                          {orgAccount.account_type}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col gap-2.5 pt-3 border-t">
                      <Link href={`/orgs/${org.id}/plants`}>
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all duration-200 font-medium"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Plants
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOrg(org)
                          setAccountFormData({ email: "", password: "" })
                          setAccountDialogOpen(true)
                        }}
                        className="w-full border-2 border-border hover:bg-primary/10 hover:border-primary/50 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                      >
                        {orgAccount ? (
                          <>
                            <User className="h-4 w-4 mr-2" />
                            View Account
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Account
                          </>
                        )}
                      </Button>
                      <AlertDialog open={deletingOrgId === org.id} onOpenChange={(open: boolean) => !open && setDeletingOrgId(null)}>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingOrgId(org.id)}
                            className="w-full border-2 border-destructive/30 hover:bg-destructive/10 hover:border-destructive hover:text-destructive transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Organization
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{org.name}"? This action cannot be undone and will delete:
                              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                                <li>All associated work orders</li>
                                <li>All associated plants</li>
                                <li>All associated vendors</li>
                                <li>All associated accounts</li>
                              </ul>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(org.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })
        )}
      </div>

      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {accounts.find((acc) => acc.org_id === selectedOrg?.id)
                ? "Organization Account"
                : `Create Account for ${selectedOrg?.name}`}
            </DialogTitle>
          </DialogHeader>
          {accounts.find((acc) => acc.org_id === selectedOrg?.id) ? (
            <div className="space-y-4">
              <Card className="p-4 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-2">
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground">Email</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Mail className="h-4 w-4 text-primary" />
                      <div className="text-base font-semibold">
                        {accounts.find((acc) => acc.org_id === selectedOrg?.id)?.email}
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground">Account Type</Label>
                    <div className="mt-1">
                      <Badge variant="secondary" className="text-sm">
                        {accounts.find((acc) => acc.org_id === selectedOrg?.id)?.account_type}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                Each organization has one account. To change the account, delete
                the existing one and create a new one.
              </p>
            </div>
          ) : (
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">
                  Email
                </Label>
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
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold">
                  Password
                </Label>
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
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAccountDialogOpen(false)}
                  className="transition-all duration-200"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white transition-all duration-200"
                >
                  Create Account
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

