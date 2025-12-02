"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Database, 
  RefreshCw, 
  Zap, 
  Building2, 
  Factory,
  Code,
  BookOpen,
  Settings,
  ArrowRight,
  PlayCircle,
  FileText,
  Layers,
  GitBranch,
  Terminal,
  Copy,
  Check
} from "lucide-react"
import { cn } from "@/lib/utils"

interface VendorCapability {
  name: string
  type: string
  auth: boolean
  listPlants: boolean
  telemetry: boolean
  alerts: boolean
  defaultMode: "LIST_PLANTS" | "PER_PLANT"
  notes: string
}

const vendorCapabilities: VendorCapability[] = [
  {
    name: "Solarman",
    type: "SOLARMAN",
    auth: true,
    listPlants: true,
    telemetry: true,
    alerts: true,
    defaultMode: "LIST_PLANTS",
    notes: "Reference standard - full implementation with PRO API support"
  },
  {
    name: "SolarDM",
    type: "SOLARDM",
    auth: true,
    listPlants: true,
    telemetry: true,
    alerts: true,
    defaultMode: "PER_PLANT",
    notes: "At/near parity with Solarman - full implementation"
  },
  {
    name: "PV Blink",
    type: "PVBLINK",
    auth: true,
    listPlants: true,
    telemetry: true,
    alerts: false,
    defaultMode: "PER_PLANT",
    notes: "Plants and telemetry implemented, alerts pending"
  },
  {
    name: "ShineMonitor",
    type: "SHINEMONITOR",
    auth: true,
    listPlants: false,
    telemetry: false,
    alerts: false,
    defaultMode: "LIST_PLANTS",
    notes: "Auth only - plants, telemetry, alerts TODO"
  },
  {
    name: "Foxesscloud",
    type: "FOXESSCLOUD",
    auth: true,
    listPlants: false,
    telemetry: false,
    alerts: false,
    defaultMode: "LIST_PLANTS",
    notes: "Auth only - plants, telemetry, alerts TODO"
  },
]

export function SystemFlowDocumentation() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["overview", "architecture", "vendors"])
  )
  const [copiedCode, setCopiedCode] = useState<Set<string>>(new Set())

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  const toggleVendorSection = (vendorId: string) => {
    const newExpanded = new Set(expandedSections)
    
    // If clicking on an already expanded vendor, collapse it
    if (newExpanded.has(vendorId)) {
      newExpanded.delete(vendorId)
    } else {
      // Collapse all other vendor sections first
      newExpanded.delete("vendor-solarman")
      newExpanded.delete("vendor-solardm")
      newExpanded.delete("vendor-pvblink")
      // Then expand the selected vendor
      newExpanded.add(vendorId)
      
      // Scroll to the expanded vendor section after a short delay
      setTimeout(() => {
        const element = document.getElementById(vendorId)
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" })
        }
      }, 100)
    }
    setExpandedSections(newExpanded)
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(prev => new Set(prev).add(id))
    setTimeout(() => {
      setCopiedCode(prev => {
        const newSet = new Set(prev)
        newSet.delete(id)
        return newSet
      })
    }, 2000)
  }

  const SectionHeader = ({ id, title, icon: Icon }: { id: string; title: string; icon: any }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-lg"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      {expandedSections.has(id) ? (
        <ChevronDown className="h-5 w-5 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      )}
    </button>
  )

  const VendorSectionHeader = ({ vendorId, vendorName, icon: Icon }: { vendorId: string; vendorName: string; icon: any }) => (
    <button
      onClick={() => toggleVendorSection(vendorId)}
      className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors rounded-lg border border-border"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="text-xl font-bold">{vendorName}</h3>
      </div>
      {expandedSections.has(vendorId) ? (
        <ChevronDown className="h-5 w-5 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      )}
    </button>
  )

  const FlowSectionHeader = ({ flowId, flowTitle, icon: Icon }: { flowId: string; flowTitle: string; icon: any }) => (
    <button
      onClick={() => toggleSection(flowId)}
      className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors rounded-lg border border-border"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="text-xl font-bold">{flowTitle}</h3>
      </div>
      {expandedSections.has(flowId) ? (
        <ChevronDown className="h-5 w-5 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      )}
    </button>
  )

  const CodeBlock = ({ code, language = "typescript", id }: { code: string; language?: string; id: string }) => (
    <div className="relative group">
      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
        <code className={`language-${language}`}>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copyToClipboard(code, id)}
      >
        {copiedCode.has(id) ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent mb-2">
          Complete System Flow Documentation
        </h1>
        <p className="text-muted-foreground text-lg">
          Comprehensive guide to vendor sync flows, telemetry, alerts, configuration, code implementation, and API mappings
        </p>
        <Badge variant="outline" className="mt-2">
          <Terminal className="h-3 w-3 mr-1" />
          Developer Access Only
        </Badge>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">
            <BookOpen className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="vendors">
            <Factory className="h-4 w-4 mr-2" />
            Vendors
          </TabsTrigger>
          <TabsTrigger value="flows">
            <ArrowRight className="h-4 w-4 mr-2" />
            Flows
          </TabsTrigger>
          <TabsTrigger value="code">
            <Code className="h-4 w-4 mr-2" />
            Code
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Config
          </TabsTrigger>
          <TabsTrigger value="prompts">
            <Terminal className="h-4 w-4 mr-2" />
            Prompts
          </TabsTrigger>
          <TabsTrigger value="mappings">
            <GitBranch className="h-4 w-4 mr-2" />
            Mappings
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* System Architecture */}
          <Card className="overflow-hidden">
            <SectionHeader id="architecture" title="System Architecture" icon={Layers} />
            {expandedSections.has("architecture") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                {/* Architecture Diagram */}
                <div className="bg-muted/50 p-6 rounded-lg">
                  <h3 className="font-semibold text-lg mb-4">System Architecture Flow</h3>
                  <svg viewBox="0 0 800 600" className="w-full h-auto">
                    {/* Frontend */}
                    <rect x="50" y="50" width="200" height="100" rx="8" fill="#3b82f6" opacity="0.2" stroke="#3b82f6" strokeWidth="2"/>
                    <text x="150" y="95" textAnchor="middle" className="text-sm font-semibold fill-foreground">Next.js Frontend</text>
                    <text x="150" y="115" textAnchor="middle" className="text-xs fill-muted-foreground">React Components</text>
                    
                    {/* API Routes */}
                    <rect x="300" y="50" width="200" height="100" rx="8" fill="#8b5cf6" opacity="0.2" stroke="#8b5cf6" strokeWidth="2"/>
                    <text x="400" y="95" textAnchor="middle" className="text-sm font-semibold fill-foreground">API Routes</text>
                    <text x="400" y="115" textAnchor="middle" className="text-xs fill-muted-foreground">Next.js API</text>
                    
                    {/* Main DB */}
                    <rect x="50" y="250" width="200" height="100" rx="8" fill="#10b981" opacity="0.2" stroke="#10b981" strokeWidth="2"/>
                    <text x="150" y="285" textAnchor="middle" className="text-sm font-semibold fill-foreground">Main Database</text>
                    <text x="150" y="305" textAnchor="middle" className="text-xs fill-muted-foreground">Supabase PostgreSQL</text>
                    
                    {/* Telemetry DB */}
                    <rect x="300" y="250" width="200" height="100" rx="8" fill="#f59e0b" opacity="0.2" stroke="#f59e0b" strokeWidth="2"/>
                    <text x="400" y="285" textAnchor="middle" className="text-sm font-semibold fill-foreground">Telemetry Database</text>
                    <text x="400" y="305" textAnchor="middle" className="text-xs fill-muted-foreground">Separate Instance</text>
                    
                    {/* Vendor APIs */}
                    <rect x="550" y="250" width="200" height="100" rx="8" fill="#ef4444" opacity="0.2" stroke="#ef4444" strokeWidth="2"/>
                    <text x="650" y="285" textAnchor="middle" className="text-sm font-semibold fill-foreground">Vendor APIs</text>
                    <text x="650" y="305" textAnchor="middle" className="text-xs fill-muted-foreground">Solarman, SolarDM, etc.</text>
                    
                    {/* Arrows */}
                    <path d="M 250 100 L 300 100" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                    <path d="M 500 100 L 400 250" stroke="#8b5cf6" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                    <path d="M 500 100 L 550 250" stroke="#8b5cf6" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                    <path d="M 250 300 L 300 300" stroke="#10b981" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                    <path d="M 500 300 L 550 300" stroke="#f59e0b" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                    
                    {/* Arrow marker */}
                    <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <polygon points="0 0, 10 3, 0 6" fill="#currentColor"/>
                      </marker>
                    </defs>
                  </svg>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Database Architecture
                    </h3>
                    <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                      <div>
                        <h4 className="font-medium mb-2">Main Database (Supabase)</h4>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li><code className="bg-background px-1 rounded">accounts</code> - User accounts with RBAC</li>
                          <li><code className="bg-background px-1 rounded">organizations</code> - Organization-level settings</li>
                          <li><code className="bg-background px-1 rounded">vendors</code> - Vendor configurations</li>
                          <li><code className="bg-background px-1 rounded">plants</code> - Plant metadata and production metrics</li>
                          <li><code className="bg-background px-1 rounded">work_orders</code> - Work order management</li>
                          <li><code className="bg-background px-1 rounded">alerts</code> - Vendor alerts</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Telemetry Database (Separate Supabase Instance)</h4>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li><code className="bg-background px-1 rounded">telemetry_15m</code> - 15-minute resolution time-series data</li>
                          <li><code className="bg-background px-1 rounded">plant_aggregates</code> - Pre-computed plant-level aggregates</li>
                          <li><code className="bg-background px-1 rounded">work_order_aggregates</code> - Work order-level aggregates</li>
                          <li><code className="bg-background px-1 rounded">organization_aggregates</code> - Organization-level aggregates</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Key Components
                    </h3>
                    <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                      <div>
                        <h4 className="font-medium mb-2">Vendor Adapter System</h4>
                        <p className="text-sm text-muted-foreground">
                          Pluggable architecture using <code className="bg-background px-1 rounded">BaseVendorAdapter</code> abstract class.
                          Each vendor implements authentication, plant listing, telemetry, and alerts.
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Sync Services</h4>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li><code className="bg-background px-1 rounded">plantSyncService.ts</code> - Plant synchronization</li>
                          <li><code className="bg-background px-1 rounded">alertSyncService.ts</code> - Alert synchronization</li>
                          <li><code className="bg-background px-1 rounded">telemetrySyncService.ts</code> - Telemetry synchronization</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Cron Jobs</h4>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li><code className="bg-background px-1 rounded">plantSyncCron.js</code> - 15-minute plant sync</li>
                          <li><code className="bg-background px-1 rounded">alertSyncCron.js</code> - Alert sync scheduler</li>
                          <li>Morning cron (00:15 AM) - Historical aggregate updates</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Configuration Model */}
          <Card className="overflow-hidden">
            <SectionHeader id="configuration" title="Configuration Model" icon={Settings} />
            {expandedSections.has("configuration") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Organization-Level Settings
                    </h3>
                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                      <div>
                        <code className="bg-background px-2 py-1 rounded text-sm font-mono">auto_sync_enabled</code>
                        <p className="text-sm text-muted-foreground mt-1">Boolean - Enable/disable auto-sync for the organization</p>
                      </div>
                      <div>
                        <code className="bg-background px-2 py-1 rounded text-sm font-mono">sync_interval_minutes</code>
                        <p className="text-sm text-muted-foreground mt-1">Integer (1-1440) - Base sync cadence, typically 15 minutes. Sync runs at fixed clock times (e.g., :00, :15, :30, :45 for 15-min intervals)</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Factory className="h-4 w-4" />
                      Vendor-Level Settings
                    </h3>
                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                      <div>
                        <code className="bg-background px-2 py-1 rounded text-sm font-mono">plant_sync_mode</code>
                        <p className="text-sm text-muted-foreground mt-1">Enum: LIST_PLANTS | PER_PLANT - Determines sync strategy</p>
                      </div>
                      <div>
                        <code className="bg-background px-2 py-1 rounded text-sm font-mono">per_plant_sync_interval_minutes</code>
                        <p className="text-sm text-muted-foreground mt-1">Integer (default: 15) - Reserved for future per-plant telemetry cron</p>
                      </div>
                      <div>
                        <code className="bg-background px-2 py-1 rounded text-sm font-mono">plant_list_sync_morning_ist</code>
                        <p className="text-sm text-muted-foreground mt-1">TIME (default: 06:00) - Morning listPlants time for PER_PLANT vendors</p>
                      </div>
                      <div>
                        <code className="bg-background px-2 py-1 rounded text-sm font-mono">plant_list_sync_evening_ist</code>
                        <p className="text-sm text-muted-foreground mt-1">TIME (default: 23:00) - Evening listPlants time for PER_PLANT vendors</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-900">
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">Restricted Sync Window</h4>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Currently configured via environment variables <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">SYNC_WINDOW_START</code> (default: 20:00 IST) 
                    and <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">SYNC_WINDOW_END</code> (default: 05:00 IST). 
                    Per-vendor restricted window configuration is planned but not yet implemented.
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Plant Sync Strategy */}
          <Card className="overflow-hidden">
            <SectionHeader id="sync-strategy" title="Telemetry Sync Strategy" icon={RefreshCw} />
            {expandedSections.has("sync-strategy") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-6 rounded-lg border border-blue-200 dark:border-blue-900">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                      <PlayCircle className="h-5 w-5" />
                      LIST_PLANTS Mode
                    </h4>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                      <strong>Default for:</strong> Solarman, ShineMonitor, Foxesscloud
                    </p>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2 ml-4 list-disc">
                      <li>At each eligible cron tick (based on org sync interval), calls <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">adapter.listPlants()</code></li>
                      <li>Upserts plants into <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">plants</code> table with topology and metrics</li>
                      <li>Production metrics (daily/monthly/yearly/total) come from plant list API</li>
                      <li>No extra vendor-level timing required - uses org sync cadence</li>
                    </ul>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-950/20 p-6 rounded-lg border border-purple-200 dark:border-purple-900">
                    <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                      <PlayCircle className="h-5 w-5" />
                      PER_PLANT Mode
                    </h4>
                    <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
                      <strong>Default for:</strong> SolarDM, PVBlink
                    </p>
                    <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-2 ml-4 list-disc">
                      <li>Preferred source of metrics is per-plant telemetry APIs, not listPlants()</li>
                      <li>At main cron interval, list-based sync is skipped</li>
                      <li>Twice-daily listPlants() refresh at configured morning/evening times (not yet wired)</li>
                      <li>Per-plant telemetry cron uses <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">per_plant_sync_interval_minutes</code></li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Vendors Tab */}
        <TabsContent value="vendors" className="space-y-6">
          <Card className="overflow-hidden">
            <SectionHeader id="vendors" title="Vendor Capabilities Matrix" icon={Factory} />
            {expandedSections.has("vendors") && (
              <div className="p-6 pt-0 border-t">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold">Vendor</th>
                        <th className="text-center p-3 font-semibold">Auth</th>
                        <th className="text-center p-3 font-semibold">listPlants</th>
                        <th className="text-center p-3 font-semibold">Telemetry</th>
                        <th className="text-center p-3 font-semibold">Alerts</th>
                        <th className="text-center p-3 font-semibold">Default Mode</th>
                        <th className="text-left p-3 font-semibold">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorCapabilities.map((vendor, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">
                            <div>{vendor.name}</div>
                            <div className="text-xs text-muted-foreground">{vendor.type}</div>
                          </td>
                          <td className="p-3 text-center">
                            {vendor.auth ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {vendor.listPlants ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {vendor.telemetry ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {vendor.alerts ? (
                              <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant={vendor.defaultMode === "LIST_PLANTS" ? "default" : "secondary"}>
                              {vendor.defaultMode}
                            </Badge>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">{vendor.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Flows Tab */}
        <TabsContent value="flows" className="space-y-6">
          {/* Plant Sync Flow */}
          <Card className="overflow-hidden">
            <FlowSectionHeader flowId="flow-plant-sync" flowTitle="Plant Sync Flow" icon={RefreshCw} />
            {expandedSections.has("flow-plant-sync") && (
              <div className="p-6 pt-0 space-y-6 border-t">
              <div className="p-6 pt-0 space-y-6 border-t">
                {/* Flow Diagram */}
                <div className="bg-muted/50 p-6 rounded-lg">
                  <h3 className="font-semibold text-lg mb-4">Plant Sync Flow Diagram</h3>
                  <svg viewBox="0 0 1000 700" className="w-full h-auto">
                    {/* Entry Points */}
                    <rect x="50" y="50" width="150" height="60" rx="8" fill="#3b82f6" opacity="0.2" stroke="#3b82f6" strokeWidth="2"/>
                    <text x="125" y="80" textAnchor="middle" className="text-xs font-semibold fill-foreground">Cron Trigger</text>
                    <text x="125" y="95" textAnchor="middle" className="text-xs fill-muted-foreground">(Every 15 min)</text>
                    
                    <rect x="250" y="50" width="150" height="60" rx="8" fill="#8b5cf6" opacity="0.2" stroke="#8b5cf6" strokeWidth="2"/>
                    <text x="325" y="80" textAnchor="middle" className="text-xs font-semibold fill-foreground">Manual Sync</text>
                    <text x="325" y="95" textAnchor="middle" className="text-xs fill-muted-foreground">(UI Button)</text>
                    
                    {/* Check Restricted Window */}
                    <rect x="450" y="50" width="200" height="60" rx="8" fill="#f59e0b" opacity="0.2" stroke="#f59e0b" strokeWidth="2"/>
                    <text x="550" y="80" textAnchor="middle" className="text-xs font-semibold fill-foreground">Check Restricted Window</text>
                    <text x="550" y="95" textAnchor="middle" className="text-xs fill-muted-foreground">(8 PM - 5 AM IST)</text>
                    
                    {/* syncAllPlants */}
                    <rect x="700" y="50" width="200" height="60" rx="8" fill="#10b981" opacity="0.2" stroke="#10b981" strokeWidth="2"/>
                    <text x="800" y="80" textAnchor="middle" className="text-xs font-semibold fill-foreground">syncAllPlants()</text>
                    <text x="800" y="95" textAnchor="middle" className="text-xs fill-muted-foreground">plantSyncService.ts</text>
                    
                    {/* Filter Orgs */}
                    <rect x="50" y="200" width="250" height="80" rx="8" fill="#ef4444" opacity="0.2" stroke="#ef4444" strokeWidth="2"/>
                    <text x="175" y="225" textAnchor="middle" className="text-xs font-semibold fill-foreground">Filter Organizations</text>
                    <text x="175" y="245" textAnchor="middle" className="text-xs fill-muted-foreground">auto_sync_enabled = true</text>
                    <text x="175" y="260" textAnchor="middle" className="text-xs fill-muted-foreground">Check sync_interval_minutes</text>
                    
                    {/* For Each Vendor */}
                    <rect x="350" y="200" width="250" height="80" rx="8" fill="#8b5cf6" opacity="0.2" stroke="#8b5cf6" strokeWidth="2"/>
                    <text x="475" y="225" textAnchor="middle" className="text-xs font-semibold fill-foreground">For Each Vendor</text>
                    <text x="475" y="245" textAnchor="middle" className="text-xs fill-muted-foreground">Get plant_sync_mode</text>
                    <text x="475" y="260" textAnchor="middle" className="text-xs fill-muted-foreground">Create adapter</text>
                    
                    {/* LIST_PLANTS Branch */}
                    <rect x="50" y="350" width="250" height="100" rx="8" fill="#3b82f6" opacity="0.2" stroke="#3b82f6" strokeWidth="2"/>
                    <text x="175" y="375" textAnchor="middle" className="text-xs font-semibold fill-foreground">LIST_PLANTS Mode</text>
                    <text x="175" y="395" textAnchor="middle" className="text-xs fill-muted-foreground">Authenticate</text>
                    <text x="175" y="410" textAnchor="middle" className="text-xs fill-muted-foreground">Call listPlants()</text>
                    <text x="175" y="425" textAnchor="middle" className="text-xs fill-muted-foreground">Upsert to DB</text>
                    <text x="175" y="440" textAnchor="middle" className="text-xs fill-muted-foreground">(Batch size: 100)</text>
                    
                    {/* PER_PLANT Branch */}
                    <rect x="350" y="350" width="250" height="100" rx="8" fill="#8b5cf6" opacity="0.2" stroke="#8b5cf6" strokeWidth="2"/>
                    <text x="475" y="375" textAnchor="middle" className="text-xs font-semibold fill-foreground">PER_PLANT Mode</text>
                    <text x="475" y="395" textAnchor="middle" className="text-xs fill-muted-foreground">Skip listPlants()</text>
                    <text x="475" y="410" textAnchor="middle" className="text-xs fill-muted-foreground">(Intended for</text>
                    <text x="475" y="425" textAnchor="middle" className="text-xs fill-muted-foreground">per-plant cron)</text>
                    
                    {/* Results */}
                    <rect x="650" y="350" width="250" height="100" rx="8" fill="#10b981" opacity="0.2" stroke="#10b981" strokeWidth="2"/>
                    <text x="775" y="375" textAnchor="middle" className="text-xs font-semibold fill-foreground">Results</text>
                    <text x="775" y="395" textAnchor="middle" className="text-xs fill-muted-foreground">Success/Failure counts</text>
                    <text x="775" y="410" textAnchor="middle" className="text-xs fill-muted-foreground">Plants synced/created/updated</text>
                    
                    {/* Arrows */}
                    <path d="M 200 110 L 450 80" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                    <path d="M 400 110 L 450 80" stroke="#8b5cf6" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                    <path d="M 650 80 L 700 80" stroke="#f59e0b" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                    <path d="M 900 80 L 800 200" stroke="#10b981" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                    <path d="M 800 240 L 475 240" stroke="#10b981" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                    <path d="M 300 280 L 175 350" stroke="#ef4444" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                    <path d="M 600 280 L 475 350" stroke="#8b5cf6" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                    <path d="M 300 400 L 650 400" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                    <path d="M 600 400 L 650 400" stroke="#8b5cf6" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                    
                    <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <polygon points="0 0, 10 3, 0 6" fill="#currentColor"/>
                      </marker>
                    </defs>
                  </svg>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Entry Points</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        1. Auto Cron
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Runs every 15 minutes via <code className="bg-background px-1 rounded">lib/cron/plantSyncCron.js</code>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Calls <code className="bg-background px-1 rounded">GET /api/cron/sync-plants</code>
                      </p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <PlayCircle className="h-4 w-4" />
                        2. Manual Sync
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        &quot;Sync Plants&quot; button in VendorsTable
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Calls <code className="bg-background px-1 rounded">POST /api/vendors/:id/sync-plants</code>
                      </p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        3. External Cron
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        GitHub Actions, cron-job.org, etc.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Calls <code className="bg-background px-1 rounded">GET /api/cron/sync-plants</code> with <code className="bg-background px-1 rounded">CRON_SECRET</code>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Complete Flow</h3>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    <ol className="text-sm text-muted-foreground space-y-3 ml-4 list-decimal">
                      <li>
                        <strong>Entry Point:</strong> Cron or manual trigger
                        <ul className="ml-4 mt-1 list-disc">
                          <li>Cron checks restricted window (8 PM - 5 AM IST by default)</li>
                          <li>If in window, sync is skipped</li>
                        </ul>
                      </li>
                      <li>
                        <strong>syncAllPlants()</strong> in <code className="bg-background px-1 rounded">plantSyncService.ts</code>
                        <ul className="ml-4 mt-1 list-disc">
                          <li>Fetches all active vendors with organization settings</li>
                          <li>Groups vendors by organization</li>
                          <li>Filters by <code className="bg-background px-1 rounded">shouldSyncOrg()</code>:
                            <ul className="ml-4 mt-1 list-disc">
                              <li>Checks <code className="bg-background px-1 rounded">auto_sync_enabled = true</code></li>
                              <li>Verifies current minute matches <code className="bg-background px-1 rounded">sync_interval_minutes</code> boundary</li>
                            </ul>
                          </li>
                        </ul>
                      </li>
                      <li>
                        <strong>For each eligible vendor:</strong> <code className="bg-background px-1 rounded">syncVendorPlants()</code>
                        <ul className="ml-4 mt-1 list-disc">
                          <li>Resolves <code className="bg-background px-1 rounded">plant_sync_mode</code> (defaults based on vendor_type)</li>
                          <li>If <code className="bg-background px-1 rounded">PER_PLANT</code>: Skip listPlants sync (returns early)</li>
                          <li>If <code className="bg-background px-1 rounded">LIST_PLANTS</code>:
                            <ul className="ml-4 mt-1 list-disc">
                              <li>Creates vendor adapter via <code className="bg-background px-1 rounded">VendorManager.getAdapter()</code></li>
                              <li>Sets token storage for adapter</li>
                              <li>Validates/refreshes token via <code className="bg-background px-1 rounded">validateAndRefreshToken()</code></li>
                              <li>Calls <code className="bg-background px-1 rounded">adapter.listPlants()</code></li>
                              <li>Normalizes plant data (unit conversions, timestamps)</li>
                              <li>Upserts plants in batches of 100 to <code className="bg-background px-1 rounded">plants</code> table</li>
                              <li>Updates production metrics (daily/monthly/yearly/total energy)</li>
                            </ul>
                          </li>
                        </ul>
                      </li>
                      <li>
                        <strong>Results:</strong> Summary with success/failure counts, plants synced/created/updated
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Code Tab - Will continue in next part */}
        <TabsContent value="code" className="space-y-6">
          <Card className="overflow-hidden">
            <SectionHeader id="code-structure" title="Code Structure & Key Files" icon={Code} />
            {expandedSections.has("code-structure") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Core Services</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">lib/services/plantSyncService.ts</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><code className="bg-background px-1 rounded">syncAllPlants()</code> - Main entry point</li>
                        <li><code className="bg-background px-1 rounded">syncVendorPlants()</code> - Per-vendor sync logic</li>
                        <li><code className="bg-background px-1 rounded">getPlantSyncMode()</code> - Resolves sync mode</li>
                        <li><code className="bg-background px-1 rounded">shouldSyncOrg()</code> - Checks org eligibility</li>
                        <li><code className="bg-background px-1 rounded">validateAndRefreshToken()</code> - Token management</li>
                      </ul>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">lib/services/alertSyncService.ts</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><code className="bg-background px-1 rounded">syncAllAlerts()</code> - Sync all vendors</li>
                        <li><code className="bg-background px-1 rounded">syncSolarmanVendorAlerts()</code> - Solarman implementation</li>
                        <li><code className="bg-background px-1 rounded">syncSolarDmVendorAlerts()</code> - SolarDM implementation</li>
                        <li><code className="bg-background px-1 rounded">calculateGridDownBenefitKwh()</code> - Benefit calculation</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Config Tab */}
        <TabsContent value="config" className="space-y-6">
          <Card className="overflow-hidden">
            <SectionHeader id="config-details" title="Configuration Details" icon={Settings} />
            {expandedSections.has("config-details") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Environment Variables</h3>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2 font-semibold">Variable</th>
                          <th className="text-left p-2 font-semibold">Description</th>
                          <th className="text-left p-2 font-semibold">Default</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">SOLARMAN_API_BASE_URL</code></td>
                          <td className="p-2">Solarman API base URL</td>
                          <td className="p-2">-</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">SOLARMAN_PRO_API_BASE_URL</code></td>
                          <td className="p-2">Solarman PRO API base URL (preferred)</td>
                          <td className="p-2">-</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">SOLARDM_API_BASE_URL</code></td>
                          <td className="p-2">SolarDM API base URL</td>
                          <td className="p-2">-</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">PVBLINK_API_BASE_URL</code></td>
                          <td className="p-2">PVBlink API base URL</td>
                          <td className="p-2">-</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">FOXESSCLOUD_API_BASE_URL</code></td>
                          <td className="p-2">Foxesscloud API base URL</td>
                          <td className="p-2">-</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">SYNC_WINDOW_START</code></td>
                          <td className="p-2">Restricted sync window start (HH:mm IST)</td>
                          <td className="p-2">20:00</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">SYNC_WINDOW_END</code></td>
                          <td className="p-2">Restricted sync window end (HH:mm IST)</td>
                          <td className="p-2">05:00</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">CRON_SECRET</code></td>
                          <td className="p-2">Secret token for cron endpoint security</td>
                          <td className="p-2">-</td>
                        </tr>
                        <tr>
                          <td className="p-2"><code className="bg-background px-1 rounded">TELEMETRY_SUPABASE_URL</code></td>
                          <td className="p-2">Telemetry database URL</td>
                          <td className="p-2">-</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Prompts Tab */}
        <TabsContent value="prompts" className="space-y-6">
          <Card className="overflow-hidden">
            <SectionHeader id="cursor-prompts" title="Cursor AI Prompts" icon={Terminal} />
            {expandedSections.has("cursor-prompts") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">System Prompt</h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
                    These prompts can be used with Cursor AI to understand and work with the WOMS codebase.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Complete System Specification Prompt</h4>
                    <CodeBlock 
                      id="system-prompt"
                      code={`# WOMS (Work Order Management System) - Complete System Specification

## System Overview
Build a production-ready **Work Order Management System (WOMS)** for managing solar power plant operations, work orders, alerts, and vendor integrations. The system must handle multiple organizations, vendors (Solarman, Sungrow, etc.), plants, telemetry data, alerts, and work order efficiency tracking.

## Tech Stack Requirements
- **Next.js 14+** with App Router (TypeScript)
- **React 18+** with Server Components and Client Components
- **TypeScript** (strict mode enabled)
- **Supabase** (PostgreSQL) with two database instances
- **Custom authentication** (NOT Supabase Auth)
- **RBAC**: SUPERADMIN, GOVT, ORG, DEVELOPER roles
- **TailwindCSS** + **shadcn/ui** for UI
- **Recharts** for data visualization
- **Framer Motion** for animations
- **node-cron** for scheduled tasks
- **MDC (Mapped Diagnostic Context)** for request tracing`}
                    />
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Vendor Adapter Pattern Prompt</h4>
                    <CodeBlock 
                      id="adapter-prompt"
                      code={`# Vendor Adapter Implementation Guide

## BaseVendorAdapter Interface
All vendor adapters must extend BaseVendorAdapter and implement:
- authenticate(): Promise<string> - Returns access token
- listPlants(): Promise<Plant[]> - Returns all plants from vendor
- getTelemetry(plantId, startTime, endTime): Promise<TelemetryData[]>
- getAlerts(plantId): Promise<Alert[]>
- normalizeTelemetry(rawData): TelemetryData
- normalizeAlert(rawData): Alert

## Token Management
- Tokens stored in vendors.access_token
- Token expiration checked via token_expires_at
- 5-minute buffer for token validation
- Automatic refresh on expiry

## Plant Sync Modes
- LIST_PLANTS: Metrics from listPlants() API
- PER_PLANT: Metrics from per-plant telemetry APIs`}
                    />
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Mappings Tab */}
        <TabsContent value="mappings" className="space-y-6">
          <Card className="overflow-hidden">
            <SectionHeader id="api-mappings" title="Vendor API to Database Mappings" icon={GitBranch} />
            {expandedSections.has("api-mappings") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <p className="text-sm text-muted-foreground mb-6">
                  Detailed API endpoint mappings and attribute transformations for each vendor.
                </p>

                {/* Solarman Section */}
                <div id="vendor-solarman" className="space-y-4">
                  <VendorSectionHeader vendorId="vendor-solarman" vendorName="Solarman" icon={Factory} />
                  
                  {expandedSections.has("vendor-solarman") && (
                  <div className="bg-muted/50 p-4 rounded-lg space-y-4 border-t">
                    <div>
                      <h4 className="font-semibold mb-2">1. Authentication</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">POST {process.env.SOLARMAN_API_BASE_URL || "https://globalapi.solarmanpv.com"}/account/v1.0/token?appId={`{appId}`}</code></div>
                        <div><strong>Request Body:</strong></div>
                        <CodeBlock 
                          id="solarman-auth-request"
                          code={`{
  "appSecret": "string",
  "username": "string",
  "password": "string | passwordSha256",
  "orgId": number (optional)
}`}
                        />
                        <div><strong>Response:</strong></div>
                        <CodeBlock 
                          id="solarman-auth-response"
                          code={`{
  "access_token": "string",
  "token_type": "Bearer",
  "expires_in": 3600
}`}
                        />
                        <div><strong>Token Storage:</strong> Stored in <code className="bg-muted px-1 rounded">vendors.access_token</code>, <code className="bg-muted px-1 rounded">vendors.token_expires_at</code></div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">2. List Plants (PRO API)</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">POST {process.env.SOLARMAN_PRO_API_BASE_URL || "https://globalpro.solarmanpv.com"}/maintain-s/operating/station/v2/search</code></div>
                        <div><strong>Request Body:</strong></div>
                        <CodeBlock 
                          id="solarman-listplants-request"
                          code={`{
  "station": {
    "powerTypeList": ["PV"]
  }
}`}
                        />
                        <div><strong>Response Structure:</strong></div>
                        <CodeBlock 
                          id="solarman-listplants-response"
                          code={`{
  "total": number,
  "data": [
    {
      "station": {
        "id": number,
        "name": string,
        "installedCapacity": number (kW),
        "generationPower": number (W),
        "generationValue": number (kWh - daily),
        "generationMonth": number (kWh - monthly),
        "generationYear": number (kWh - yearly),
        "generationUploadTotalOffset": number (kWh - total),
        "lastUpdateTime": number (Unix seconds),
        "createdDate": number (Unix seconds),
        "startOperatingTime": number (Unix seconds),
        "locationLat": number,
        "locationLng": number,
        "locationAddress": string,
        "networkStatus": string
      }
    }
  ]
}`}
                        />
                        <div><strong>Database Mapping:</strong></div>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">API Field</th>
                              <th className="text-left p-2">DB Column</th>
                              <th className="text-left p-2">Transformation</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2"><code>station.id</code></td>
                              <td className="p-2"><code>vendor_plant_id</code></td>
                              <td className="p-2">Convert to string</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>station.name</code></td>
                              <td className="p-2"><code>name</code></td>
                              <td className="p-2">Direct</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>station.installedCapacity</code></td>
                              <td className="p-2"><code>capacity_kw</code></td>
                              <td className="p-2">Already in kW</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>station.generationPower</code></td>
                              <td className="p-2"><code>current_power_kw</code></td>
                              <td className="p-2">W → kW (divide by 1000)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>station.generationValue</code></td>
                              <td className="p-2"><code>daily_energy_kwh</code></td>
                              <td className="p-2">Direct (already kWh)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>station.generationMonth</code></td>
                              <td className="p-2"><code>monthly_energy_mwh</code></td>
                              <td className="p-2">kWh → MWh (divide by 1000)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>station.generationYear</code></td>
                              <td className="p-2"><code>yearly_energy_mwh</code></td>
                              <td className="p-2">kWh → MWh (divide by 1000)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>station.generationUploadTotalOffset</code></td>
                              <td className="p-2"><code>total_energy_mwh</code></td>
                              <td className="p-2">kWh → MWh (divide by 1000)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>station.lastUpdateTime</code></td>
                              <td className="p-2"><code>last_update_time</code></td>
                              <td className="p-2">Unix seconds → ISO string</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>station.networkStatus</code></td>
                              <td className="p-2"><code>network_status</code></td>
                              <td className="p-2">Trim whitespace</td>
                            </tr>
                            <tr>
                              <td className="p-2"><code>station.locationLat/Lng/Address</code></td>
                              <td className="p-2"><code>location</code> (JSONB)</td>
                              <td className="p-2">{"{lat, lng, address}"}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">3. Daily Telemetry</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">GET {process.env.SOLARMAN_PRO_API_BASE_URL || "https://globalpro.solarmanpv.com"}/maintain-s/history/power/{`{systemId}`}/record?year={`{year}`}&month={`{month}`}&day={`{day}`}</code></div>
                        <div><strong>Response:</strong></div>
                        <CodeBlock 
                          id="solarman-daily-telemetry"
                          code={`{
  "statistics": {
    "systemId": number,
    "year": number,
    "month": number,
    "day": number,
    "generationValue": number (kWh),
    "fullPowerHoursDay": number
  },
  "records": [
    {
      "systemId": number,
      "acceptDay": number,
      "acceptMonth": number,
      "generationPower": number (W),
      "dateTime": number (Unix seconds),
      "generationCapacity": number (0-1)
    }
  ]
}`}
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">4. Alerts</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">POST {process.env.SOLARMAN_PRO_API_BASE_URL || "https://globalpro.solarmanpv.com"}/maintain-s/operating/station/alert?order.direction=ASC&order.property=alertTime&size=100&page={`{page}`}</code></div>
                        <div><strong>Request Body:</strong></div>
                        <CodeBlock 
                          id="solarman-alerts-request"
                          code={`{
  "alertQueryName": "No Mains Voltage",
  "language": "en",
  "status": "-1",
  "timeZone": "Asia/Calcutta"
}`}
                        />
                        <div><strong>Response:</strong></div>
                        <CodeBlock 
                          id="solarman-alerts-response"
                          code={`{
  "total": number,
  "data": [
    {
      "id": string,
      "stationId": number,
      "deviceType": "INVERTER",
      "alertTime": number (Unix seconds),
      "endTime": number | null (Unix seconds),
      "alertName": string,
      "description": string,
      "level": number (0=Info, 1=Warning, 2=Error),
      "influence": number (0=None, 1=Production, 2=Safety, 3=Both)
    }
  ]
}`}
                        />
                        <div><strong>Database Mapping:</strong></div>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">API Field</th>
                              <th className="text-left p-2">DB Column</th>
                              <th className="text-left p-2">Transformation</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2"><code>id</code></td>
                              <td className="p-2"><code>vendor_alert_id</code></td>
                              <td className="p-2">Convert to string</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>stationId</code></td>
                              <td className="p-2"><code>vendor_plant_id</code></td>
                              <td className="p-2">Convert to string</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>alertName</code></td>
                              <td className="p-2"><code>title</code></td>
                              <td className="p-2">Direct</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>level + influence</code></td>
                              <td className="p-2"><code>severity</code></td>
                              <td className="p-2">Map: 0→LOW, 1→MEDIUM, 2→HIGH, Safety→CRITICAL</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>endTime</code></td>
                              <td className="p-2"><code>status</code></td>
                              <td className="p-2">null→ACTIVE, value→RESOLVED</td>
                            </tr>
                            <tr>
                              <td className="p-2"><code>endTime - alertTime</code></td>
                              <td className="p-2"><code>grid_down_seconds</code></td>
                              <td className="p-2">Calculate difference in seconds</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  )}
                </div>

                {/* SolarDM Section */}
                <div id="vendor-solardm" className="space-y-4 mt-8">
                  <VendorSectionHeader vendorId="vendor-solardm" vendorName="SolarDM" icon={Factory} />
                  
                  {expandedSections.has("vendor-solardm") && (
                  <div className="bg-muted/50 p-4 rounded-lg space-y-4 border-t">
                    <div>
                      <h4 className="font-semibold mb-2">1. Authentication</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">POST {process.env.SOLARDM_API_BASE_URL || "http://global.solar-dm.com:8010"}/ums/business/email_login</code></div>
                        <div><strong>Request Body:</strong></div>
                        <CodeBlock 
                          id="solardm-auth-request"
                          code={`{
  "email": "string",
  "password": "string (RSA encrypted)",
  "loginType": "email",
  "regionSign": "3"
}`}
                        />
                        <div><strong>Response:</strong></div>
                        <CodeBlock 
                          id="solardm-auth-response"
                          code={`{
  "code": 0,
  "message": "success",
  "data": {
    "token": "string",
    "refreshToken": "string",
    "tokenHead": "Bearer",
    "expiresIn": number (seconds)
  }
}`}
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">2. List Plants</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">GET {process.env.SOLARDM_API_BASE_URL || "http://global.solar-dm.com:8010"}/dms/plant/list_all</code></div>
                        <div><strong>Response:</strong></div>
                        <CodeBlock 
                          id="solardm-listplants-response"
                          code={`{
  "code": 0,
  "message": "success",
  "data": {
    "total": number,
    "list": [
      {
        "id": string,
        "plantName": string,
        "capacity": string (e.g., "5.00"),
        "latitude": number,
        "longitude": number,
        "address": string,
        "communicateStatus": number (1=online, 2=offline, 3=PARTIAL_OFFLINE),
        "createTime": "YYYY-MM-DD HH:mm:ss"
      }
    ]
  }
}`}
                        />
                        <div><strong>Database Mapping:</strong></div>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">API Field</th>
                              <th className="text-left p-2">DB Column</th>
                              <th className="text-left p-2">Transformation</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2"><code>id</code></td>
                              <td className="p-2"><code>vendor_plant_id</code></td>
                              <td className="p-2">Direct (string)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>plantName</code></td>
                              <td className="p-2"><code>name</code></td>
                              <td className="p-2">Direct</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>capacity</code></td>
                              <td className="p-2"><code>capacity_kw</code></td>
                              <td className="p-2">ParseFloat (string → number)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>communicateStatus</code></td>
                              <td className="p-2"><code>network_status</code></td>
                              <td className="p-2">1→NORMAL, 2→ALL_OFFLINE, 3→PARTIAL_OFFLINE</td>
                            </tr>
                            <tr>
                              <td className="p-2"><code>createTime</code></td>
                              <td className="p-2"><code>vendor_created_date</code></td>
                              <td className="p-2">&quot;YYYY-MM-DD HH:mm:ss&quot; → ISO string</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">3. Daily Telemetry</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">GET {process.env.SOLARDM_API_BASE_URL || "http://global.solar-dm.com:8010"}/dms/data_panel/history/stats/daily/{`{plantId}`}?plantId={`{plantId}`}&type=date&time=YYYY-MM-DD</code></div>
                        <div><strong>Response:</strong></div>
                        <CodeBlock 
                          id="solardm-daily-telemetry"
                          code={`{
  "code": 0,
  "data": {
    "dataList": [
      {
        "time": "YYYY-MM-DD HH:mm:ss",
        "generationPower": number (W),
        "generationEnergy": number (kWh)
      }
    ]
  }
}`}
                        />
                        <div><strong>Note:</strong> SolarDM provides 20-minute intervals (vs Solarman&apos;s 15-minute)</div>
                      </div>
                    </div>
                  </div>
                  )}
                </div>

                {/* PVBlink Section */}
                <div id="vendor-pvblink" className="space-y-4 mt-8">
                  <VendorSectionHeader vendorId="vendor-pvblink" vendorName="PVBlink" icon={Factory} />
                  
                  {expandedSections.has("vendor-pvblink") && (
                  <div className="bg-muted/50 p-4 rounded-lg space-y-4 border-t">
                    <div>
                      <h4 className="font-semibold mb-2">1. Authentication</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">POST {process.env.PVBLINK_API_BASE_URL || "https://cloud.pvblink.com"}/api/pvblink/user/login</code></div>
                        <div><strong>Request Body:</strong></div>
                        <CodeBlock 
                          id="pvblink-auth-request"
                          code={`{
  "email": "string",
  "password": "string",
  "confirmPassword": null,
  "resetPasswordToken": null,
  "rememberMe": false
}`}
                        />
                        <div><strong>Response:</strong></div>
                        <CodeBlock 
                          id="pvblink-auth-response"
                          code={`{
  "data": {
    "accessToken": "string",
    "id": string,
    "email": string
  }
}`}
                        />
                        <div><strong>Token Expiration:</strong> Default 11 hours 30 minutes (41400 seconds)</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">2. List Plants</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">GET {process.env.PVBLINK_API_BASE_URL || "https://cloud.pvblink.com"}/api/pvblink/plant/s/all?pageNo={`{pageNo}`}</code></div>
                        <div><strong>Pagination:</strong> Iterates until empty data array</div>
                        <div><strong>Response:</strong></div>
                        <CodeBlock 
                          id="pvblink-listplants-response"
                          code={`{
  "data": [
    {
      "id": string,
      "name": string,
      "capacity": number (kW),
      "totalProduction": number,
      "dailyProduction": number,
      "isOnline": boolean
    }
  ]
}`}
                        />
                        <div><strong>Database Mapping:</strong></div>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2">API Field</th>
                              <th className="text-left p-2">DB Column</th>
                              <th className="text-left p-2">Transformation</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2"><code>id</code></td>
                              <td className="p-2"><code>vendor_plant_id</code></td>
                              <td className="p-2">Direct (string)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>name</code></td>
                              <td className="p-2"><code>name</code></td>
                              <td className="p-2">Direct</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code>capacity</code></td>
                              <td className="p-2"><code>capacity_kw</code></td>
                              <td className="p-2">Direct (already kW)</td>
                            </tr>
                            <tr>
                              <td className="p-2"><code>isOnline</code></td>
                              <td className="p-2"><code>network_status</code></td>
                              <td className="p-2">true→ONLINE, false→ALL_OFFLINE</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">3. Daily Telemetry</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">GET {process.env.PVBLINK_API_BASE_URL || "https://cloud.pvblink.com"}/api/pvblink/plant/s/production/detail/{`{vendorPlantId}`}/day?year={`{year}`}&month={`{month}`}&day={`{day}`}</code></div>
                        <div><strong>Response:</strong></div>
                        <CodeBlock 
                          id="pvblink-daily-telemetry"
                          code={`{
  "data": {
    "peakHours": number,
    "production": number (kWh),
    "productionData": [
      {
        "production": number (kW),
        "createdOn": number (Unix milliseconds)
      }
    ]
  }
}`}
                        />
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
