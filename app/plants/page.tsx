"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { DashboardSidebar } from "@/components/DashboardSidebar"
import { useUser } from "@/context/UserContext"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Building2, FileText, BarChart3, ExternalLink } from "lucide-react"

const RECENT_KEY = "plants-recent"
const RECENT_MAX = 5
const PAGE_SIZE = 20

interface WorkOrderRef {
  id: number
  title: string
}

interface PlantRow {
  id: number
  name: string | null
  org_id: number
  vendor_id: number
  organizations: { id: number; name: string } | null
  vendors: { id: number; name: string; vendor_type: string } | null
  workOrders: WorkOrderRef[]
}

interface Org {
  id: number
  name: string
}

export default function PlantsPage() {
  const router = useRouter()
  const { account, loading: userLoading } = useUser()
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [orgId, setOrgId] = useState<string>("")
  const [onlyInWorkOrders, setOnlyInWorkOrders] = useState(false)
  const [plants, setPlants] = useState<PlantRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [orgs, setOrgs] = useState<Org[]>([])
  const [recent, setRecent] = useState<Array<{ id: number; name: string }>>([])

  const accountType = account?.accountType
  const isOrg = accountType === "ORG"
  const isGovt = accountType === "GOVT"
  const showOrgFilter = !isOrg && (accountType === "GOVT" || accountType === "SUPERADMIN" || accountType === "DEVELOPER")
  const showOnlyInWorkOrdersFilter = !isGovt && (accountType === "SUPERADMIN" || accountType === "DEVELOPER" || accountType === "ORG")

  const fetchOrgs = useCallback(async () => {
    if (!showOrgFilter) return
    try {
      const res = await fetch("/api/orgs")
      const data = await res.json()
      if (data.orgs) setOrgs(data.orgs)
    } catch {
      setOrgs([])
    }
  }, [showOrgFilter])

  useEffect(() => {
    if (userLoading || !account) return
    if (!account) {
      router.push("/auth/login")
      return
    }
    fetchOrgs()
  }, [userLoading, account, router, fetchOrgs])

  const loadRecent = useCallback(() => {
    try {
      const raw = typeof window !== "undefined" ? sessionStorage.getItem(RECENT_KEY) : null
      if (!raw) {
        setRecent([])
        return
      }
      const parsed = JSON.parse(raw) as Array<{ id: number; name: string }>
      setRecent(Array.isArray(parsed) ? parsed.slice(0, RECENT_MAX) : [])
    } catch {
      setRecent([])
    }
  }, [])

  useEffect(() => {
    loadRecent()
  }, [loadRecent])

  const addToRecent = useCallback((id: number, name: string) => {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem(RECENT_KEY) : null
    let list: Array<{ id: number; name: string }> = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) list = []
    list = [{ id, name: name || `Plant ${id}` }, ...list.filter((p) => p.id !== id)].slice(0, RECENT_MAX)
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(list))
    loadRecent()
  }, [loadRecent])

  const search = useCallback(async () => {
    const name = searchQuery.trim().slice(0, 50)
    if (!name) {
      setPlants([])
      setTotal(0)
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("name", name)
      params.set("page", String(page))
      params.set("limit", String(PAGE_SIZE))
      if (orgId) params.set("orgId", orgId)
      if (onlyInWorkOrders) params.set("onlyInWorkOrders", "true")
      const res = await fetch(`/api/plants/search?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to fetch")
      setPlants(data.plants ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      setPlants([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, page, orgId, onlyInWorkOrders])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setPlants([])
      setTotal(0)
      return
    }
    search()
  }, [searchQuery, page, orgId, onlyInWorkOrders])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
  }

  const handleAnalyticsClick = (plantId: number, plantName: string) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("analytics-return-to", "/plants")
    }
    addToRecent(plantId, plantName)
    router.push(`/analytics/plants/${plantId}`)
  }

  const handleViewPlantClick = (plantId: number, plantName: string) => {
    addToRecent(plantId, plantName)
    router.push(`/plants/${plantId}`)
  }

  if (userLoading || !account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  const canAccess =
    accountType === "SUPERADMIN" ||
    accountType === "DEVELOPER" ||
    accountType === "ORG" ||
    accountType === "GOVT"
  if (!canAccess) {
    router.push("/dashboard")
    return null
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const displayName = (p: PlantRow) => p.name?.trim() || `Plant ${p.id}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardSidebar />
      <div className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Plants</h1>
          <p className="text-muted-foreground mt-1">Search by plant name to view details, work orders, and analytics</p>
        </div>

        {recent.length > 0 && (
          <Card className="mb-6 p-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">Recently viewed</p>
            <div className="flex flex-wrap gap-2">
              {recent.map((p) => (
                <Link key={p.id} href={`/plants/${p.id}`}>
                  <Button variant="outline" size="sm">
                    {p.name} ({p.id})
                  </Button>
                </Link>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-4 mb-6">
          <form onSubmit={handleSearchSubmit} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <Search className="h-4 w-4 self-center text-muted-foreground" />
                <Input
                  placeholder="Type a plant name to search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  maxLength={50}
                  className="max-w-md"
                />
                <Button type="submit" disabled={loading}>
                  Search
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {showOrgFilter && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Organization</span>
                  <Select value={orgId} onValueChange={setOrgId}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="All organizations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All organizations</SelectItem>
                      {orgs.map((org) => (
                        <SelectItem key={org.id} value={String(org.id)}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {showOnlyInWorkOrdersFilter && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={onlyInWorkOrders}
                    onCheckedChange={(c) => setOnlyInWorkOrders(!!c)}
                  />
                  <span className="text-sm">Only plants in work orders</span>
                </label>
              )}
            </div>
          </form>
        </Card>

        {!searchQuery.trim() ? (
          <Card className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Type a plant name to search</p>
          </Card>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : plants.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">No plants found</p>
          </Card>
        ) : (
          <>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plant</TableHead>
                    {!isOrg && <TableHead>Organization</TableHead>}
                    <TableHead>Vendor</TableHead>
                    <TableHead>Work orders</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plants.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span className="font-medium">
                          {displayName(p)} ({p.id})
                        </span>
                      </TableCell>
                      {!isOrg && (
                        <TableCell>
                          {p.organizations?.name ?? "—"}
                        </TableCell>
                      )}
                      <TableCell>
                        {p.vendors?.name ?? "—"}
                        {p.vendors?.vendor_type && (
                          <span className="text-muted-foreground text-sm ml-1">({p.vendors.vendor_type})</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.workOrders.length === 0 ? (
                            "—"
                          ) : (
                            p.workOrders.map((wo) => (
                              <Link key={wo.id} href={`/workorders/${wo.id}`}>
                                <Button variant="link" size="sm" className="h-auto p-0 text-primary">
                                  {wo.title}
                                </Button>
                              </Link>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewPlantClick(p.id, displayName(p))}
                          >
                            View plant
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAnalyticsClick(p.id, displayName(p))}
                          >
                            <BarChart3 className="h-4 w-4 mr-1" />
                            Analytics
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({total} plants)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
