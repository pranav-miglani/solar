"use client"

import { useState, useEffect, useRef } from "react"
import mermaid from "mermaid"
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
  AlertTriangle,
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
  Check,
  User,
  Users
} from "lucide-react"
import { cn } from "@/lib/utils"

interface VendorCapability {
  name: string
  type: string
  auth: boolean
  listPlants: boolean
  listPlant: boolean // Per-plant fetching support
  telemetry: boolean
  alerts: boolean
  defaultMode: "LIST_PLANTS" | "PER_PLANT"
  authApi: string
  listPlantsApi: string
  listPlantApi: string
  telemetryApi: string
  alertsApi: string
  mappingStatus: "Complete" | "Partial" | "Pending"
  notes: string
}

const vendorCapabilities: VendorCapability[] = [
  {
    name: "Solarman",
    type: "SOLARMAN",
    auth: true,
    listPlants: true,
    listPlant: true,
    telemetry: true,
    alerts: true,
    defaultMode: "LIST_PLANTS",
    authApi: "POST /account/v1.0/token",
    listPlantsApi: "POST /maintain-s/operating/station/v2/search (PRO API)",
    listPlantApi: "POST /maintain-s/operating/station/v2/search (filtered by stationId)",
    telemetryApi: "GET /maintain-s/history/power/{systemId}/record",
    alertsApi: "POST /maintain-s/operating/station/alert",
    mappingStatus: "Complete",
    notes: "Reference standard - full implementation with PRO API support. All components mapped correctly."
  },
  {
    name: "SolarDM",
    type: "SOLARDM",
    auth: true,
    listPlants: true,
    listPlant: true,
    telemetry: true,
    alerts: true,
    defaultMode: "PER_PLANT",
    authApi: "POST /ums/business/email_login",
    listPlantsApi: "GET /dms/plant/list_all",
    listPlantApi: "GET /dms/plant/{vendorPlantId} + GET /dms/data_panel/metering/sub_v2/{vendorPlantId}",
    telemetryApi: "GET /dms/data_panel/history/stats/daily/{plantId}",
    alertsApi: "GET /dms/inverter_fault/page_list/all (paginated)",
    mappingStatus: "Complete",
    notes: "At/near parity with Solarman - full implementation. All components mapped correctly."
  },
  {
    name: "PV Blink",
    type: "PVBLINK",
    auth: true,
    listPlants: true,
    listPlant: true,
    telemetry: true,
    alerts: false,
    defaultMode: "PER_PLANT",
    authApi: "POST /api/pvblink/user/login",
    listPlantsApi: "GET /api/pvblink/plant/s/all (paginated)",
    listPlantApi: "GET /api/pvblink/plant/s/all (filtered client-side)",
    telemetryApi: "GET /api/pvblink/plant/s/production/detail/{plantId}/day",
    alertsApi: "Not implemented",
    mappingStatus: "Partial",
    notes: "Plants and telemetry implemented (daily/monthly/yearly/total), alerts pending. Components mapped correctly."
  },
  {
    name: "ShineMonitor",
    type: "SHINEMONITOR",
    auth: true,
    listPlants: true,
    listPlant: true,
    telemetry: true,
    alerts: false,
    defaultMode: "LIST_PLANTS",
    authApi: "GET /?action=auth (SHA1 sign/salt)",
    listPlantsApi: "GET /?action=webQueryPlants (paginated)",
    listPlantApi: "GET /?action=webQueryPlants (filtered client-side)",
    telemetryApi: "GET /?action=queryPlantActiveOuputPowerOneDay, queryPlantEnergyMonthPerDay, queryPlantEnergyYearPerMonth, queryPlantEnergyTotalPerYear",
    alertsApi: "Not implemented",
    mappingStatus: "Partial",
    notes: "Plants and telemetry implemented (daily/monthly/yearly/total), realtime and alerts pending. Components mapped correctly."
  },
  {
    name: "Foxesscloud",
    type: "FOXESSCLOUD",
    auth: true,
    listPlants: false,
    listPlant: false,
    telemetry: false,
    alerts: false,
    defaultMode: "LIST_PLANTS",
    authApi: "POST /c/v0/user/login",
    listPlantsApi: "Not implemented",
    listPlantApi: "Not implemented",
    telemetryApi: "Not implemented",
    alertsApi: "Not implemented",
    mappingStatus: "Pending",
    notes: "Auth only - plants, telemetry, alerts TODO. Components not yet mapped."
  },
]

// Custom System Architecture Diagram Component
const SystemArchitectureDiagram = () => {
  const Arrow = ({ direction = "right", label }: { direction?: "right" | "down" | "up" | "left"; label?: string }) => {
    const arrowClass = {
      right: "w-8 h-0.5 bg-primary/60 relative after:content-[''] after:absolute after:right-0 after:top-1/2 after:-translate-y-1/2 after:border-l-3 after:border-l-primary/60 after:border-t-1.5 after:border-t-transparent after:border-b-1.5 after:border-b-transparent",
      down: "h-6 w-0.5 bg-primary/60 relative after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:border-t-3 after:border-t-primary/60 after:border-l-1.5 after:border-l-transparent after:border-r-1.5 after:border-r-transparent",
      up: "h-6 w-0.5 bg-primary/60 relative after:content-[''] after:absolute after:top-0 after:left-1/2 after:-translate-x-1/2 after:border-b-3 after:border-b-primary/60 after:border-l-1.5 after:border-l-transparent after:border-r-1.5 after:border-r-transparent",
      left: "w-8 h-0.5 bg-primary/60 relative after:content-[''] after:absolute after:left-0 after:top-1/2 after:-translate-y-1/2 after:border-r-3 after:border-r-primary/60 after:border-t-1.5 after:border-t-transparent after:border-b-1.5 after:border-b-transparent"
    }
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className={`${arrowClass[direction]}`} />
        {label && <span className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</span>}
      </div>
    )
  }

  const Node = ({ 
    title, 
    children, 
    color = "blue",
    icon,
    className = ""
  }: { 
    title: string
    children: React.ReactNode
    color?: "blue" | "purple" | "green" | "red" | "orange"
    icon?: React.ReactNode
    className?: string
  }) => {
    const colorClasses = {
      blue: "bg-blue-500/10 border-blue-500/50 text-blue-100",
      purple: "bg-purple-500/10 border-purple-500/50 text-purple-100",
      green: "bg-green-500/10 border-green-500/50 text-green-100",
      red: "bg-red-500/10 border-red-500/50 text-red-100",
      orange: "bg-orange-500/10 border-orange-500/50 text-orange-100"
    }
    
    return (
      <div className={`rounded-lg border-2 p-3 ${colorClasses[color]} ${className}`}>
        <div className="flex items-center gap-1.5 mb-2 font-semibold text-xs">
          {icon && <span className="text-sm">{icon}</span>}
          <h4>{title}</h4>
        </div>
        <div className="text-[10px] text-muted-foreground space-y-0.5 leading-tight">
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full py-4">
      <div className="mx-auto space-y-3 max-w-7xl">
        {/* Frontend Layer */}
        <div className="flex flex-col items-center">
          <Node title="Frontend Layer" color="blue" icon="🌐" className="w-full max-w-md">
            <div>Next.js Frontend • React Components (TypeScript)</div>
            <div>Pages: Dashboard, Plants, Work Orders, Alerts</div>
          </Node>
        </div>

        <div className="flex justify-center">
          <Arrow direction="down" label="HTTP Requests" />
        </div>

        {/* API Layer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Node title="API Routes" color="purple" icon="⚙️" className="min-h-[100px]">
            <div>Next.js API Endpoints</div>
            <div>/api/vendors, /api/plants, /api/workorders, /api/alerts, /api/wms-vendors, /api/cron/*</div>
          </Node>
          
          <Node title="Sync Services" color="purple" icon="🔄" className="min-h-[100px]">
            <div>plantSyncService.ts</div>
            <div>liveTelemetrySyncService.ts</div>
            <div>alertSyncService.ts</div>
            <div>wmsSyncService.ts</div>
          </Node>
          
          <Node title="Vendor Adapters" color="purple" icon="🔌" className="min-h-[100px]">
            <div>BaseVendorAdapter (Inverters)</div>
            <div>Solarman, SolarDM, PVBlink, ShineMonitor, Foxesscloud</div>
            <div className="pt-1 border-t border-purple-500/30">BaseWmsAdapter (WMS)</div>
            <div>Intello</div>
          </Node>
        </div>

        {/* Connections from API Layer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex flex-col items-center">
            <Arrow direction="down" label="Query/Update" />
          </div>
          <div className="flex flex-col items-center">
            <Arrow direction="down" label="Read/Write" />
          </div>
          <div className="flex flex-col items-center">
            <Arrow direction="down" label="API Calls" />
          </div>
        </div>

        {/* Database & External Services */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Node title="Main Database" color="green" icon="💾" className="min-h-[100px]">
            <div className="font-medium mb-1">Supabase PostgreSQL</div>
            <div className="text-[10px] space-y-0.5">
              <div><strong>Tables:</strong> accounts, organizations, vendors, plants, work_orders, alerts, wms_vendors, wms_sites, wms_devices, insolation_readings</div>
              <div><strong>Live Telemetry:</strong> Stored in plants table (current_power_kw, daily_energy_kwh, monthly_energy_mwh, etc.)</div>
              <div><strong>Insolation:</strong> Stored in insolation_readings (last 100 days, rollover)</div>
            </div>
          </Node>

          <Node title="External Vendor APIs" color="red" icon="🌍" className="min-h-[100px]">
            <div>Solarman • SolarDM • ShineMonitor • PVBlink • Foxesscloud</div>
            <div className="text-[10px] italic mt-1">Returns telemetry & plant data</div>
            <div className="pt-1 border-t border-red-500/30 mt-1">Intello (WMS)</div>
            <div className="text-[10px] italic">Returns sites, devices & insolation data</div>
          </Node>
        </div>

        {/* Bidirectional flow indicator */}
        <div className="flex justify-center items-center gap-2 py-1">
          <Arrow direction="left" label="Returns" />
          <span className="text-[10px] text-muted-foreground">Bidirectional Flow</span>
          <Arrow direction="right" label="Calls" />
        </div>

        {/* Cron Jobs */}
        <div className="pt-3 border-t border-border/50">
          <div className="text-center mb-2 text-xs font-semibold text-muted-foreground">Scheduled Jobs (Triggers API Routes)</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Node title="Plant Sync Cron" color="orange" icon="⏰" className="min-h-[90px]">
              <div className="text-[10px] space-y-0.5">
                <div>Every 15 min • Checks morning/evening • Twice daily</div>
                <div className="pt-1 border-t border-orange-500/30">→ /api/cron/sync-plants</div>
              </div>
            </Node>
            
            <Node title="Live Telemetry Cron" color="orange" icon="⏰" className="min-h-[90px]">
              <div className="text-[10px] space-y-0.5">
                <div>Every 15 min • Filters by interval • 15/30/45 min sync</div>
                <div className="pt-1 border-t border-orange-500/30">→ /api/cron/sync-live-telemetry</div>
              </div>
            </Node>
            
            <Node title="Alert Sync Cron" color="orange" icon="⏰" className="min-h-[90px]">
              <div className="text-[10px] space-y-0.5">
                <div>Scheduled sync • Vendor alerts</div>
                <div className="pt-1 border-t border-orange-500/30">→ /api/cron/sync-alerts</div>
              </div>
            </Node>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <Node title="WMS Site Sync Cron" color="orange" icon="⏰" className="min-h-[90px]">
              <div className="text-[10px] space-y-0.5">
                <div>Twice daily • 6 AM & 10 PM IST • Sites & devices</div>
                <div className="pt-1 border-t border-orange-500/30">→ /api/cron/sync-wms-sites</div>
              </div>
            </Node>
            <Node title="WMS Insolation Sync Cron" color="orange" icon="⏰" className="min-h-[90px]">
              <div className="text-[10px] space-y-0.5">
                <div>Daily 10 PM IST • Current day insolation</div>
                <div className="pt-1 border-t border-orange-500/30">→ /api/cron/sync-wms-insolation</div>
              </div>
            </Node>
          </div>
        </div>

        {/* Legend */}
        <div className="pt-3 border-t border-border">
          <div className="text-center text-xs font-semibold mb-2 text-muted-foreground">Legend</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[10px]">
            <div className="flex items-center gap-1.5 justify-center">
              <div className="w-3 h-3 rounded bg-blue-500/20 border border-blue-500/50"></div>
              <span>Frontend</span>
            </div>
            <div className="flex items-center gap-1.5 justify-center">
              <div className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500/50"></div>
              <span>API Layer</span>
            </div>
            <div className="flex items-center gap-1.5 justify-center">
              <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/50"></div>
              <span>Database</span>
            </div>
            <div className="flex items-center gap-1.5 justify-center">
              <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/50"></div>
              <span>External APIs</span>
            </div>
            <div className="flex items-center gap-1.5 justify-center">
              <div className="w-3 h-3 rounded bg-orange-500/20 border border-orange-500/50"></div>
              <span>Cron Jobs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Mermaid component for Plant Sync Flow
const PlantSyncMermaidDiagram = () => {
  const mermaidRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>("")

  useEffect(() => {
    if (svg) return

    const diagramDefinition = `flowchart TD
    A["Cron Trigger<br/>Every 15 min<br/>(checks timing)"] --> D{"Check Restricted<br/>Window<br/>8 PM - 5 AM IST"}
    B["Manual Sync<br/>UI Button"] --> D
    C["Twice Daily<br/>Morning/Evening<br/>Configurable"] --> D
    D -->|"Not in window"| E["syncAllPlants()<br/>plantSyncService.ts"]
    D -->|"In window"| F["Skip Sync"]
    E --> G["Filter Organizations<br/>auto_sync_enabled = true"]
    G --> H["For Each Vendor<br/>Check shouldRunPlantSync()<br/>Morning/Evening times"]
    H --> I{"Time matches<br/>morning/evening?"}
    I -->|"Yes"| J["Authenticate<br/>Call listPlants()<br/>Upsert to DB<br/>Batch size: 100"]
    I -->|"No"| K["Skip Sync<br/>(not sync time)"]
    J --> L["Results<br/>Success/Failure counts<br/>Plants synced/created/updated<br/>Fetches newly added plants"]
    K --> M["Wait for next<br/>sync window"]

    style A fill:#3b82f6,stroke:#2563eb,stroke-width:2px,color:#fff
    style B fill:#8b5cf6,stroke:#7c3aed,stroke-width:2px,color:#fff
    style C fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff
    style D fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff
    style E fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff
    style F fill:#ef4444,stroke:#dc2626,stroke-width:2px,color:#fff
    style G fill:#8b5cf6,stroke:#7c3aed,stroke-width:2px,color:#fff
    style H fill:#6366f1,stroke:#4f46e5,stroke-width:2px,color:#fff
    style I fill:#6366f1,stroke:#4f46e5,stroke-width:2px,color:#fff
    style J fill:#3b82f6,stroke:#2563eb,stroke-width:2px,color:#fff
    style K fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff
    style L fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff
    style M fill:#94a3b8,stroke:#64748b,stroke-width:2px,color:#fff`

    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#1e293b',
        primaryTextColor: '#f1f5f9',
        primaryBorderColor: '#475569',
        lineColor: '#64748b',
        secondaryColor: '#334155',
        tertiaryColor: '#0f172a',
      },
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
      },
    })

    const id = `plant-sync-diagram-${Date.now()}`
    
    mermaid.render(id, diagramDefinition).then((result) => {
      setSvg(result.svg)
    }).catch((error) => {
      console.error('Error rendering Mermaid diagram:', error)
    })
  }, [svg])

  if (svg) {
    return (
      <div 
        className="flex justify-center items-center min-h-[500px] overflow-x-auto w-full" 
        dangerouslySetInnerHTML={{ __html: svg }} 
      />
    )
  }

  return (
    <div ref={mermaidRef} className="flex justify-center items-center min-h-[500px] overflow-x-auto w-full">
      <div className="text-muted-foreground">Loading diagram...</div>
    </div>
  )
}

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
      newExpanded.delete("vendor-shinemonitor")
      newExpanded.delete("vendor-foxesscloud")
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
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="overview">
            <BookOpen className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="database">
            <Database className="h-4 w-4 mr-2" />
            Database
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
          <TabsTrigger value="backlog">
            <AlertCircle className="h-4 w-4 mr-2" />
            Backlog
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
                  <SystemArchitectureDiagram />
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
                          <li><code className="bg-background px-1 rounded">vendors</code> - Inverter vendor configurations</li>
                          <li><code className="bg-background px-1 rounded">plants</code> - Plant metadata and production metrics</li>
                          <li><code className="bg-background px-1 rounded">work_orders</code> - Work order management</li>
                          <li><code className="bg-background px-1 rounded">alerts</code> - Vendor alerts</li>
                          <li><code className="bg-background px-1 rounded">wms_vendors</code> - Weather Monitoring System vendor configurations</li>
                          <li><code className="bg-background px-1 rounded">wms_sites</code> - WMS sites (locations with weather monitoring devices)</li>
                          <li><code className="bg-background px-1 rounded">wms_devices</code> - WMS devices (RTUs, sensors) within sites</li>
                          <li><code className="bg-background px-1 rounded">insolation_readings</code> - Daily insolation data (last 100 days, rollover)</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Telemetry Storage</h4>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li><strong>Live Telemetry:</strong> Stored in <code className="bg-background px-1 rounded">plants</code> table (current_power_kw, daily_energy_kwh, monthly_energy_mwh, yearly_energy_mwh, total_energy_mwh, network_status)</li>
                          <li><strong>Historical Telemetry (Graphs):</strong> Fetched on-demand from vendor APIs via <code className="bg-background px-1 rounded">GET /api/plants/[id]/telemetry</code> - not persisted in database</li>
                          <li><strong>Note:</strong> Separate telemetry database has been removed. All telemetry is either stored in main database (live metrics) or fetched on-demand (historical graphs).</li>
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
                          <li><code className="bg-background px-1 rounded">plantSyncService.ts</code> - Plant synchronization (twice daily: morning/evening)</li>
                          <li><code className="bg-background px-1 rounded">alertSyncService.ts</code> - Alert synchronization</li>
                          <li><code className="bg-background px-1 rounded">liveTelemetrySyncService.ts</code> - Live telemetry sync (15/30/45 min intervals, LIST_PLANTS or PER_PLANT mode)</li>
                          <li><code className="bg-background px-1 rounded">telemetrySyncService.ts</code> - Historical telemetry (graphs) synchronization</li>
                          <li><code className="bg-background px-1 rounded">wmsSyncService.ts</code> - WMS site/device sync and insolation data sync</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Cron Jobs</h4>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li><code className="bg-background px-1 rounded">plantSyncCron.js</code> - Runs every 15 min, checks morning/evening times (twice daily sync)</li>
                          <li><code className="bg-background px-1 rounded">liveTelemetrySyncCron.js</code> - Runs every 15 min, filters vendors by telemetry_sync_interval</li>
                          <li><code className="bg-background px-1 rounded">alertSyncCron.js</code> - Alert sync scheduler</li>
                          <li><code className="bg-background px-1 rounded">wmsSiteSyncCron.js</code> - WMS site sync (runs twice daily at 6 AM and 10 PM IST)</li>
                          <li><code className="bg-background px-1 rounded">wmsInsolationSyncCron.js</code> - WMS insolation sync (runs daily at 10 PM IST)</li>
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
                        <p className="text-sm text-muted-foreground mt-1">TIME (default: 23:00) - Evening plant sync time (IST)</p>
                      </div>
                      <div>
                        <code className="bg-background px-2 py-1 rounded text-sm font-mono">telemetry_sync_mode</code>
                        <p className="text-sm text-muted-foreground mt-1">Enum: LIST_PLANTS | PER_PLANT - How live telemetry is fetched (all plants in one call vs per-plant)</p>
                      </div>
                      <div>
                        <code className="bg-background px-2 py-1 rounded text-sm font-mono">telemetry_sync_interval</code>
                        <p className="text-sm text-muted-foreground mt-1">Integer (15, 30, or 45) - Live telemetry sync interval in minutes. Sync runs at fixed clock times based on this interval.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-900">
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">Restricted Sync Window</h4>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>8:00 PM - 5:00 AM IST:</strong> All sync operations (plant sync and telemetry sync) are automatically skipped during this time window.
                    This prevents unnecessary API calls during off-peak hours. Currently configured via environment variables 
                    <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">SYNC_WINDOW_START</code> (default: 20:00 IST) 
                    and <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">SYNC_WINDOW_END</code> (default: 05:00 IST).
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Telemetry Architecture */}
          <Card className="overflow-hidden">
            <SectionHeader id="telemetry-architecture" title="Telemetry Architecture: Graphs vs Live Telemetry" icon={Layers} />
            {expandedSections.has("telemetry-architecture") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-6 rounded-lg border border-blue-200 dark:border-blue-900">
                  <h3 className="font-semibold text-lg mb-4">Two Types of Telemetry Data</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    The system separates telemetry into two distinct categories with different update strategies:
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-background p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Graphs (Historical Telemetry)
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        <strong>Purpose:</strong> Time-series data for visualization and analysis
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                        <li><strong>Storage:</strong> <strong>NOT PERSISTED</strong> - Fetched on-demand from vendor APIs when user requests graph data</li>
                        <li><strong>Update:</strong> Fetched on-demand when user requests graph data via <code className="bg-background px-1 rounded">GET /api/plants/[id]/telemetry</code></li>
                        <li><strong>API:</strong> <code className="bg-background px-1 rounded">GET /api/plants/[id]/telemetry?year=YYYY&month=MM&day=DD</code></li>
                        <li><strong>Resolution:</strong> Vendor-dependent (Solarman: 15-min, ShineMonitor: 5-min, SolarDM: 20-min, PVBlink: varies)</li>
                        <li><strong>Data Source:</strong> Direct vendor API calls (no database storage)</li>
                        <li><strong>Data:</strong> Power generation over time (kW values at each timestamp)</li>
                        <li><strong>Note:</strong> Separate telemetry database has been removed. Historical telemetry is fetched directly from vendor APIs on-demand.</li>
                      </ul>
                    </div>
                    
                    <div className="bg-white dark:bg-background p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                      <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        Live Telemetry (Real-Time Metrics)
                      </h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        <strong>Purpose:</strong> Current production metrics displayed in dashboards
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                        <li><strong>Storage:</strong> Main database (<code className="bg-background px-1 rounded">plants</code> table)</li>
                        <li><strong>Update:</strong> Automatic via cron job at configurable intervals (15, 30, or 45 minutes per vendor)</li>
                        <li><strong>Service:</strong> <code className="bg-background px-1 rounded">liveTelemetrySyncService.ts</code></li>
                        <li><strong>Cron:</strong> <code className="bg-background px-1 rounded">liveTelemetrySyncCron.js</code> (runs every 15 min, filters vendors by interval)</li>
                        <li><strong>Sync Modes:</strong>
                          <ul className="ml-4 mt-1 list-disc">
                            <li><code className="bg-background px-1 rounded">LIST_PLANTS</code> - Fetches all plants telemetry in single API call (efficient)</li>
                            <li><code className="bg-background px-1 rounded">PER_PLANT</code> - Fetches each plant telemetry individually (costly but necessary for some vendors)</li>
                          </ul>
                        </li>
                        <li><strong>Fields Updated:</strong>
                          <ul className="ml-4 mt-1 list-disc">
                            <li><code className="bg-background px-1 rounded">current_power_kw</code></li>
                            <li><code className="bg-background px-1 rounded">daily_energy_kwh</code></li>
                            <li><code className="bg-background px-1 rounded">monthly_energy_mwh</code></li>
                            <li><code className="bg-background px-1 rounded">yearly_energy_mwh</code></li>
                            <li><code className="bg-background px-1 rounded">total_energy_mwh</code></li>
                            <li><code className="bg-background px-1 rounded">network_status</code></li>
                          </ul>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-6 bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-900">
                    <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">How Live Telemetry is Fetched</h4>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                      The system uses two sync modes based on vendor configuration (<code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">telemetry_sync_mode</code>):
                    </p>
                    <ol className="text-sm text-yellow-800 dark:text-yellow-200 space-y-2 ml-4 list-decimal">
                      <li><strong>LIST_PLANTS Mode (Efficient):</strong> 
                        <ul className="ml-4 mt-1 list-disc">
                          <li>Calls <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">adapter.listPlants()</code> once to get all plants with their live telemetry in a single API call</li>
                          <li>Extracts live telemetry fields from each plant&apos;s metadata: current_power_kw, daily_energy_kwh, monthly_energy_mwh, yearly_energy_mwh, total_energy_mwh, network_status</li>
                          <li>Maps vendor response to database fields (handles unit conversions: W→kW, kWh→MWh)</li>
                          <li>Updates <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">plants</code> table in batches of 100</li>
                          <li><strong>Used by:</strong> Solarman, ShineMonitor (when telemetry_sync_mode = LIST_PLANTS)</li>
                        </ul>
                      </li>
                      <li><strong>PER_PLANT Mode (Costly but Necessary):</strong>
                        <ul className="ml-4 mt-1 list-disc">
                          <li>Fetches all active plants for vendor from database</li>
                          <li>For each plant, calls <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">adapter.listPlant(vendorPlantId)</code> to get individual plant telemetry</li>
                          <li>Fetches in batches of 50 plants (parallel API calls to avoid overwhelming vendor)</li>
                          <li>Extracts live telemetry fields from each plant&apos;s metadata</li>
                          <li>Collects all updates and performs batch database update (100 plants per transaction to reduce DB load)</li>
                          <li><strong>Used by:</strong> SolarDM, PVBlink (when telemetry_sync_mode = PER_PLANT, or when listPlants() doesn&apos;t provide live telemetry)</li>
                        </ul>
                      </li>
                      <li><strong>Interval-Based Sync:</strong> Cron runs every 15 minutes, but only syncs vendors whose <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">telemetry_sync_interval</code> matches the current time (e.g., 15 min syncs at :00, :15, :30, :45)</li>
                      <li><strong>listPlant() Usage in Plant Sync:</strong> During plant sync (twice daily), if live telemetry is not available in <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">listPlants()</code> response, 
                      optionally enriches each plant by calling <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">adapter.listPlant(vendorPlantId)</code> (configurable via <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">ENABLE_PER_PLANT_LIVE_TELEMETRY</code> env var, default: enabled). 
                      This happens in batches of 20 plants in parallel.</li>
                    </ol>
                  </div>
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
                      <li>Plant sync runs <strong>twice daily</strong> (morning and evening) to fetch newly added plants</li>
                      <li>At sync time, calls <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">adapter.listPlants()</code></li>
                      <li>Upserts plants into <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">plants</code> table with topology and metrics</li>
                      <li>Production metrics (daily/monthly/yearly/total) come from plant list API</li>
                      <li>Manual/force sync always available on request</li>
                    </ul>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-950/20 p-6 rounded-lg border border-purple-200 dark:border-purple-900">
                    <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                      <PlayCircle className="h-5 w-5" />
                      Live Telemetry Sync Modes
                    </h4>
                    <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
                      <strong>Configurable per vendor:</strong> Set via <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">telemetry_sync_mode</code> in vendor settings
                    </p>
                    <div className="space-y-3">
                      <div>
                        <h5 className="font-medium text-sm mb-1">LIST_PLANTS Mode (Efficient)</h5>
                        <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1 ml-4 list-disc">
                          <li>Single API call gets all plants telemetry</li>
                          <li>Uses <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">adapter.listPlants()</code></li>
                          <li>Recommended for vendors that provide live telemetry in listPlants()</li>
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-medium text-sm mb-1">PER_PLANT Mode (Costly)</h5>
                        <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1 ml-4 list-disc">
                          <li>Each plant requires individual API call</li>
                          <li>Uses <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">adapter.listPlant(vendorPlantId)</code> for each plant</li>
                          <li>Fetches in batches of 50 (parallel), updates in batches of 100</li>
                          <li>Necessary for vendors that don&apos;t provide live telemetry in listPlants()</li>
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-medium text-sm mb-1">Sync Interval</h5>
                        <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1 ml-4 list-disc">
                          <li>Configurable per vendor: 15, 30, or 45 minutes</li>
                          <li>Sync runs at fixed clock times (e.g., 15 min: :00, :15, :30, :45)</li>
                          <li>Stored in <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">telemetry_sync_interval</code> field</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Alert Sync Flow */}
          <Card className="overflow-hidden">
            <FlowSectionHeader flowId="flow-alert-sync" flowTitle="Alert Sync Flow" icon={AlertTriangle} />
            {expandedSections.has("flow-alert-sync") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Entry Points</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        1. Auto Cron
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Runs via <code className="bg-background px-1 rounded">lib/cron/alertSyncCron.js</code>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Calls <code className="bg-background px-1 rounded">GET /api/cron/sync-alerts</code>
                      </p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        2. Manual Trigger
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        SUPERADMIN/DEVELOPER via UI
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Calls <code className="bg-background px-1 rounded">POST /api/vendors/:id/sync-alerts</code> or <code className="bg-background px-1 rounded">POST /api/cron/sync-alerts</code>
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
                        Calls <code className="bg-background px-1 rounded">GET /api/cron/sync-alerts</code> with <code className="bg-background px-1 rounded">CRON_SECRET</code>
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
                        <strong>syncAllAlerts()</strong> in <code className="bg-background px-1 rounded">alertSyncService.ts</code>
                        <ul className="ml-4 mt-1 list-disc">
                          <li>Fetches all active vendors with organization info</li>
                          <li>Filters to vendors with <code className="bg-background px-1 rounded">is_active = true</code> and <code className="bg-background px-1 rounded">org_id IS NOT NULL</code></li>
                          <li>Currently supports <strong>SOLARMAN</strong> and <strong>SOLARDM</strong> vendors only</li>
                          <li>Processes all supported vendors in parallel using <code className="bg-background px-1 rounded">Promise.all()</code></li>
                        </ul>
                      </li>
                      <li>
                        <strong>For each vendor:</strong> Vendor-specific sync function
                        <ul className="ml-4 mt-1 list-disc">
                          <li><strong>Solarman:</strong> <code className="bg-background px-1 rounded">syncSolarmanVendorAlerts()</code>
                            <ul className="ml-4 mt-1 list-disc">
                              <li>Creates vendor adapter and authenticates</li>
                              <li>Fetches all plants for vendor from database</li>
                              <li>Builds plant mapping: <code className="bg-background px-1 rounded">stationId → plant_id</code></li>
                              <li>Determines lookback window from <code className="bg-background px-1 rounded">vendor.credentials.alertsStartDate</code> (default: 1 year)</li>
                              <li>Calls Solarman PRO API: <code className="bg-background px-1 rounded">POST /maintain-s/operating/station/alert</code></li>
                              <li>Filters alerts to <code className="bg-background px-1 rounded">deviceType === &quot;INVERTER&quot;</code> and <code className="bg-background px-1 rounded">alertQueryName === &quot;No Mains Voltage&quot;</code></li>
                              <li>Paginates through alerts (page size: 100) until no more data</li>
                              <li>For each alert:
                                <ul className="ml-4 mt-1 list-disc">
                                  <li>Maps <code className="bg-background px-1 rounded">stationId</code> to internal <code className="bg-background px-1 rounded">plant_id</code></li>
                                  <li>Calculates <code className="bg-background px-1 rounded">grid_down_seconds</code> (endTime - alertTime)</li>
                                  <li>Calculates <code className="bg-background px-1 rounded">grid_down_benefit_kwh</code> (0.5 × hours × capacity_kw, only for 9 AM - 4 PM window)</li>
                                  <li>Maps severity: <code className="bg-background px-1 rounded">level + influence</code> → LOW/MEDIUM/HIGH/CRITICAL (safety influence upgrades to CRITICAL)</li>
                                  <li>Maps status: <code className="bg-background px-1 rounded">endTime === null</code> → ACTIVE, else → RESOLVED</li>
                                  <li>Checks for existing alert by <code className="bg-background px-1 rounded">(vendor_id, vendor_alert_id, plant_id)</code></li>
                                  <li>Upserts alert to <code className="bg-background px-1 rounded">alerts</code> table</li>
                                </ul>
                              </li>
                              <li>Updates <code className="bg-background px-1 rounded">vendors.last_alert_synced_at</code> timestamp</li>
                            </ul>
                          </li>
                          <li><strong>SolarDM:</strong> <code className="bg-background px-1 rounded">syncSolarDmVendorAlerts()</code>
                            <ul className="ml-4 mt-1 list-disc">
                              <li>Creates vendor adapter and authenticates</li>
                              <li>Fetches all plants for vendor from database</li>
                              <li>Builds plant mapping: <code className="bg-background px-1 rounded">vendor_plant_id → plant_id</code></li>
                              <li>Determines lookback window from <code className="bg-background px-1 rounded">vendor.credentials.alertsStartDate</code> (default: 1 year)</li>
                              <li>Calls SolarDM API: <code className="bg-background px-1 rounded">adapter.getAllAlerts()</code> (fetches all alerts, filters client-side)</li>
                              <li>Filters alerts to <code className="bg-background px-1 rounded">faultInfo === &quot;There is no mains voltage&quot;</code></li>
                              <li>For each alert:
                                <ul className="ml-4 mt-1 list-disc">
                                  <li>Maps <code className="bg-background px-1 rounded">plantId</code> to internal <code className="bg-background px-1 rounded">plant_id</code></li>
                                  <li>Parses timestamps: <code className="bg-background px-1 rounded">happenTime</code> and <code className="bg-background px-1 rounded">recoverTime</code> (format: &quot;YYYY-MM-DD HH:mm:ss&quot;)</li>
                                  <li>Filters by date range (alerts outside lookback window are skipped)</li>
                                  <li>Calculates <code className="bg-background px-1 rounded">grid_down_seconds</code> and <code className="bg-background px-1 rounded">grid_down_benefit_kwh</code></li>
                                  <li>Maps severity: <code className="bg-background px-1 rounded">faultLevel</code> → LOW/MEDIUM/HIGH/CRITICAL</li>
                                  <li>Maps status: <code className="bg-background px-1 rounded">recoverTime === null</code> → ACTIVE, else → RESOLVED</li>
                                  <li>Checks for existing alert by <code className="bg-background px-1 rounded">(vendor_id, vendor_alert_id, plant_id)</code></li>
                                  <li>Upserts alert to <code className="bg-background px-1 rounded">alerts</code> table</li>
                                </ul>
                              </li>
                              <li>Updates <code className="bg-background px-1 rounded">vendors.last_alert_synced_at</code> timestamp</li>
                            </ul>
                          </li>
                          <li><strong>Other vendors:</strong> Currently not supported (returns error: &quot;Alert sync is not implemented for vendor type: [type]&quot;)</li>
                        </ul>
                      </li>
                      <li>
                        <strong>Results:</strong> Summary with success/failure counts, alerts synced/created/updated per vendor
                        <ul className="ml-4 mt-1 list-disc">
                          <li>Returns <code className="bg-background px-1 rounded">AlertSyncSummary</code> with:
                            <ul className="ml-4 mt-1 list-disc">
                              <li><code className="bg-background px-1 rounded">totalVendors</code> - Number of vendors processed</li>
                              <li><code className="bg-background px-1 rounded">successful</code> - Number of successful syncs</li>
                              <li><code className="bg-background px-1 rounded">failed</code> - Number of failed syncs</li>
                              <li><code className="bg-background px-1 rounded">totalAlertsSynced</code> - Total alerts processed</li>
                              <li><code className="bg-background px-1 rounded">totalAlertsCreated</code> - New alerts inserted</li>
                              <li><code className="bg-background px-1 rounded">totalAlertsUpdated</code> - Existing alerts updated</li>
                              <li><code className="bg-background px-1 rounded">results</code> - Per-vendor results array</li>
                              <li><code className="bg-background px-1 rounded">duration</code> - Total sync duration in milliseconds</li>
                            </ul>
                          </li>
                        </ul>
                      </li>
                    </ol>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📋 Alert Processing Details</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2 ml-4 list-disc">
                    <li><strong>Deduplication:</strong> Alerts are deduplicated by <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">(vendor_id, vendor_alert_id, plant_id)</code> - if an alert with the same combination exists, it&apos;s updated instead of creating a duplicate</li>
                    <li><strong>Severity Mapping:</strong>
                      <ul className="ml-4 mt-1 list-disc">
                        <li><strong>Solarman:</strong> <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">level</code> (0=LOW, 1=MEDIUM, 2=HIGH) + <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">influence</code> (2/3=Safety → CRITICAL)</li>
                        <li><strong>SolarDM:</strong> <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">faultLevel</code> (1=LOW, 2=MEDIUM, 3=HIGH, 4=CRITICAL)</li>
                      </ul>
                    </li>
                    <li><strong>Status Mapping:</strong>
                      <ul className="ml-4 mt-1 list-disc">
                        <li><strong>ACTIVE:</strong> Alert has no <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">endTime</code> (Solarman) or <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">recoverTime</code> (SolarDM)</li>
                        <li><strong>RESOLVED:</strong> Alert has an end/recover time</li>
                      </ul>
                    </li>
                    <li><strong>Grid Down Benefit Calculation:</strong>
                      <ul className="ml-4 mt-1 list-disc">
                        <li>Calculates hours of grid downtime within 9 AM - 4 PM window (IST)</li>
                        <li>Formula: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">benefit_kwh = 0.5 × hours × capacity_kw</code></li>
                        <li>Only calculated if both <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">alert_time</code> and <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">end_time</code> are present</li>
                        <li>Stored in <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">alerts.grid_down_benefit_kwh</code></li>
                      </ul>
                    </li>
                    <li><strong>Lookback Window:</strong>
                      <ul className="ml-4 mt-1 list-disc">
                        <li>Configurable per vendor via <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">vendor.credentials.alertsStartDate</code> (ISO date string)</li>
                        <li>Default: 1 year lookback if not configured</li>
                        <li>Maximum: 1 year (even if configured date is older)</li>
                        <li>Used to filter alerts by date range</li>
                      </ul>
                    </li>
                    <li><strong>Pagination:</strong>
                      <ul className="ml-4 mt-1 list-disc">
                        <li><strong>Solarman:</strong> Uses page size 100, paginates until empty response</li>
                        <li><strong>SolarDM:</strong> Fetches all alerts in one call via <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">getAllAlerts()</code>, filters client-side</li>
                      </ul>
                    </li>
                  </ul>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-900">
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">⚠️ Important Notes</h4>
                  <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1 ml-4 list-disc">
                    <li>Alert sync is <strong>separate from plant sync and telemetry sync</strong> - runs independently</li>
                    <li>Currently only <strong>Solarman</strong> and <strong>SolarDM</strong> vendors are supported</li>
                    <li>Alert sync respects the restricted time window (8 PM - 5 AM IST)</li>
                    <li>Alerts are filtered to specific types:
                      <ul className="ml-4 mt-1 list-disc">
                        <li><strong>Solarman:</strong> <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">deviceType === &quot;INVERTER&quot;</code> and <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">alertQueryName === &quot;No Mains Voltage&quot;</code></li>
                        <li><strong>SolarDM:</strong> <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">faultInfo === &quot;There is no mains voltage&quot;</code></li>
                      </ul>
                    </li>
                    <li>Alerts are only synced for plants that exist in the database (mapped plants)</li>
                    <li>Grid down benefit calculation only applies to alerts within 9 AM - 4 PM window (IST)</li>
                    <li>Manual sync available per-vendor via <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">POST /api/vendors/:id/sync-alerts</code> (requires vendor update permission)</li>
                  </ul>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Database Tab */}
        <TabsContent value="database" className="space-y-6">
          <Card className="overflow-hidden">
            <SectionHeader id="db-schema" title="Complete Database Schema" icon={Database} />
            {expandedSections.has("db-schema") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Database Architecture</h3>
                    <p className="text-sm text-muted-foreground">
                      Solar Information System uses <strong>a single Supabase database instance</strong>:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                      <li><strong>Main Database:</strong> All application data including live telemetry metrics stored in <code className="bg-background px-1 rounded">plants</code> table</li>
                      <li><strong>Historical Telemetry:</strong> Fetched on-demand from vendor APIs - not persisted in database</li>
                      <li><strong>Note:</strong> Separate telemetry database has been removed. All data is stored in the main database or fetched on-demand.</li>
                    </ul>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Main Database Tables</h3>
                  
                  {/* Accounts Table */}
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <h4 className="font-semibold">accounts</h4>
                    <p className="text-sm text-muted-foreground">Custom authentication table (NOT Supabase Auth)</p>
                    <table className="w-full text-xs border-collapse mt-2">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Column</th>
                          <th className="text-left p-2">Type</th>
                          <th className="text-left p-2">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-2"><code>id</code></td>
                          <td className="p-2">UUID</td>
                          <td className="p-2">Primary key (auto-generated)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>account_type</code></td>
                          <td className="p-2">ENUM</td>
                          <td className="p-2">SUPERADMIN, ORG, GOVT, DEVELOPER</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>email</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">Unique email (used as username)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>password_hash</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">Bcrypt hash (10 rounds)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>org_id</code></td>
                          <td className="p-2">INTEGER</td>
                          <td className="p-2">FK to organizations (NULL for SUPERADMIN/GOVT/DEVELOPER, required for ORG)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>is_active</code></td>
                          <td className="p-2">BOOLEAN</td>
                          <td className="p-2">Account active status (default: true)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>logo_url</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">Organization logo URL (nullable)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>display_name</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">Display name for footer (nullable)</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <strong>Constraints:</strong> ORG accounts must have org_id; SUPERADMIN/GOVT/DEVELOPER must have org_id = NULL
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <strong>Indexes:</strong> email (unique), org_id, account_type
                    </div>
                  </div>

                  {/* Organizations Table */}
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <h4 className="font-semibold">organizations</h4>
                    <p className="text-sm text-muted-foreground">Organizations that own solar plants</p>
                    <table className="w-full text-xs border-collapse mt-2">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Column</th>
                          <th className="text-left p-2">Type</th>
                          <th className="text-left p-2">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-2"><code>id</code></td>
                          <td className="p-2">SERIAL</td>
                          <td className="p-2">Primary key</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>name</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">Organization name</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>auto_sync_enabled</code></td>
                          <td className="p-2">BOOLEAN</td>
                          <td className="p-2">Enable auto-sync (default: true)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>sync_interval_minutes</code></td>
                          <td className="p-2">INTEGER</td>
                          <td className="p-2">Sync interval 1-1440 min (default: 15). Sync runs at fixed clock times.</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <strong>Relationships:</strong> Referenced by accounts.org_id, vendors.org_id, plants.org_id, work_orders.org_id
                    </div>
                  </div>

                  {/* Vendors Table */}
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <h4 className="font-semibold">vendors</h4>
                    <p className="text-sm text-muted-foreground">Vendor integrations with token caching</p>
                    <table className="w-full text-xs border-collapse mt-2">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Column</th>
                          <th className="text-left p-2">Type</th>
                          <th className="text-left p-2">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-2"><code>id</code></td>
                          <td className="p-2">SERIAL</td>
                          <td className="p-2">Primary key</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>name</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">Vendor name</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>vendor_type</code></td>
                          <td className="p-2">ENUM</td>
                          <td className="p-2">SOLARMAN, SOLARDM, PVBLINK, SHINEMONITOR, FOXESSCLOUD, OTHER</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>credentials</code></td>
                          <td className="p-2">JSONB</td>
                          <td className="p-2">Encrypted API credentials (vendor-specific)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>org_id</code></td>
                          <td className="p-2">INTEGER</td>
                          <td className="p-2">FK to organizations (nullable, for vendor-org mapping)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>access_token</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">Cached access token (checked before auth)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>token_expires_at</code></td>
                          <td className="p-2">TIMESTAMPTZ</td>
                          <td className="p-2">Token expiration timestamp</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>plant_sync_mode</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">LIST_PLANTS or PER_PLANT (default based on vendor_type)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>per_plant_sync_interval_minutes</code></td>
                          <td className="p-2">INTEGER</td>
                          <td className="p-2">Interval for PER_PLANT mode (default: 15)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>plant_list_sync_morning_ist</code></td>
                          <td className="p-2">TIME</td>
                          <td className="p-2">Morning listPlants sync time (default: 06:00)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>plant_list_sync_evening_ist</code></td>
                          <td className="p-2">TIME</td>
                          <td className="p-2">Evening plant sync time (default: 23:00 IST)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>telemetry_sync_mode</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">LIST_PLANTS or PER_PLANT - How live telemetry is fetched (default: LIST_PLANTS)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>telemetry_sync_interval</code></td>
                          <td className="p-2">INTEGER</td>
                          <td className="p-2">Live telemetry sync interval in minutes: 15, 30, or 45 (default: 15)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>last_synced_at</code></td>
                          <td className="p-2">TIMESTAMPTZ</td>
                          <td className="p-2">Last successful plant sync timestamp</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>last_alert_synced_at</code></td>
                          <td className="p-2">TIMESTAMPTZ</td>
                          <td className="p-2">Last successful alert sync timestamp</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <strong>Note:</strong> api_base_url removed - stored in environment variables (e.g., SOLARMAN_API_BASE_URL)
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <strong>Indexes:</strong> org_id, token_expires_at (where not null)
                    </div>
                  </div>

                  {/* Plants Table */}
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <h4 className="font-semibold">plants</h4>
                    <p className="text-sm text-muted-foreground">Solar plants with production metrics</p>
                    <table className="w-full text-xs border-collapse mt-2">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Column</th>
                          <th className="text-left p-2">Type</th>
                          <th className="text-left p-2">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-2"><code>id</code></td>
                          <td className="p-2">SERIAL</td>
                          <td className="p-2">Primary key</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>org_id</code></td>
                          <td className="p-2">INTEGER</td>
                          <td className="p-2">FK to organizations (required, CASCADE delete)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>vendor_id</code></td>
                          <td className="p-2">INTEGER</td>
                          <td className="p-2">FK to vendors (required, CASCADE delete)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>vendor_plant_id</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">Vendor-specific plant identifier</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>name</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">Plant name</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>capacity_kw</code></td>
                          <td className="p-2">NUMERIC(10,2)</td>
                          <td className="p-2">Installed capacity in kW</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>current_power_kw</code></td>
                          <td className="p-2">NUMERIC(10,3)</td>
                          <td className="p-2">Current generation power in kW</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>daily_energy_kwh</code></td>
                          <td className="p-2">NUMERIC(10,3)</td>
                          <td className="p-2">Daily energy in kWh (stored in kWh to avoid rounding errors)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>monthly_energy_mwh</code></td>
                          <td className="p-2">NUMERIC(10,3)</td>
                          <td className="p-2">Monthly energy in MWh</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>yearly_energy_mwh</code></td>
                          <td className="p-2">NUMERIC(10,3)</td>
                          <td className="p-2">Yearly energy in MWh</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>total_energy_mwh</code></td>
                          <td className="p-2">NUMERIC(10,3)</td>
                          <td className="p-2">Total cumulative energy in MWh</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>last_update_time</code></td>
                          <td className="p-2">TIMESTAMPTZ</td>
                          <td className="p-2">Last update from vendor (shown as &quot;Last Updated&quot;). Used to determine plant inactivity - plants with last_update_time older than 3 days are automatically disabled.</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>last_refreshed_at</code></td>
                          <td className="p-2">TIMESTAMPTZ</td>
                          <td className="p-2">Last refresh in our DB (shown as &quot;Last Refresh&quot;). Set to current time whenever we sync plant data, regardless of whether vendor has new data.</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>is_active</code></td>
                          <td className="p-2">BOOLEAN</td>
                          <td className="p-2">Indicates if plant is active (true) or disabled (false). Plants are marked inactive if they haven&apos;t received vendor updates (last_update_time) for 3+ days.</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>network_status</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">NORMAL, ALL_OFFLINE, PARTIAL_OFFLINE (whitespace normalized)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>location</code></td>
                          <td className="p-2">JSONB</td>
                          <td className="p-2">{"{lat, lng, address}"}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <strong>Unique Constraint:</strong> (vendor_id, vendor_plant_id) - prevents duplicate plants from same vendor
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <strong>Indexes:</strong> org_id, vendor_id, (vendor_id, org_id), last_update_time, network_status
                    </div>
                  </div>

                  {/* Work Orders Table */}
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <h4 className="font-semibold">work_orders</h4>
                    <p className="text-sm text-muted-foreground">Static work orders (no status field)</p>
                    <table className="w-full text-xs border-collapse mt-2">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Column</th>
                          <th className="text-left p-2">Type</th>
                          <th className="text-left p-2">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-2"><code>id</code></td>
                          <td className="p-2">SERIAL</td>
                          <td className="p-2">Primary key</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>title</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">Work order title</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>description</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">Work order description</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>location</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">Physical location</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>org_id</code></td>
                          <td className="p-2">INTEGER</td>
                          <td className="p-2">FK to organizations (required for CASCADE delete)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>created_at</code></td>
                          <td className="p-2">TIMESTAMPTZ</td>
                          <td className="p-2">Creation timestamp</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>updated_at</code></td>
                          <td className="p-2">TIMESTAMPTZ</td>
                          <td className="p-2">Last update timestamp</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <strong>Note:</strong> No status field - work orders are static per requirements
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <strong>Excel Import/Export:</strong> SUPERADMIN and DEVELOPER can export work orders to Excel and import them back for bulk operations and disaster recovery.
                    </div>
                  </div>

                  {/* Alerts Table */}
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <h4 className="font-semibold">alerts</h4>
                    <p className="text-sm text-muted-foreground">System alerts from vendor APIs</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      <strong>Access:</strong> SUPERADMIN, DEVELOPER, and GOVT can see all alerts. ORG users can only see alerts for their organization&apos;s plants.
                    </p>
                    <table className="w-full text-xs border-collapse mt-2">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Column</th>
                          <th className="text-left p-2">Type</th>
                          <th className="text-left p-2">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-2"><code>id</code></td>
                          <td className="p-2">SERIAL</td>
                          <td className="p-2">Primary key</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>plant_id</code></td>
                          <td className="p-2">INTEGER</td>
                          <td className="p-2">FK to plants (required, CASCADE delete)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>vendor_id</code></td>
                          <td className="p-2">INTEGER</td>
                          <td className="p-2">FK to vendors (helps disambiguate vendor_alert_id)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>vendor_alert_id</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">Original alert ID from vendor</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>vendor_plant_id</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">Vendor-specific plant identifier</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>alert_time</code></td>
                          <td className="p-2">TIMESTAMPTZ</td>
                          <td className="p-2">When alert started (vendor timestamp)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>end_time</code></td>
                          <td className="p-2">TIMESTAMPTZ</td>
                          <td className="p-2">When alert ended/cleared (if provided)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>grid_down_seconds</code></td>
                          <td className="p-2">INTEGER</td>
                          <td className="p-2">Computed grid downtime: max(0, end_time - alert_time)</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>grid_down_benefit_kwh</code></td>
                          <td className="p-2">NUMERIC(12,3)</td>
                          <td className="p-2">Downtime benefit: 0.5 × hours(9am-4pm overlap) × capacity_kw</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>title</code></td>
                          <td className="p-2">TEXT</td>
                          <td className="p-2">Alert title</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>severity</code></td>
                          <td className="p-2">ENUM</td>
                          <td className="p-2">LOW, MEDIUM, HIGH, CRITICAL</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>status</code></td>
                          <td className="p-2">ENUM</td>
                          <td className="p-2">ACTIVE, RESOLVED, ACKNOWLEDGED</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>metadata</code></td>
                          <td className="p-2">JSONB</td>
                          <td className="p-2">Vendor-specific alert data</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <strong>Indexes:</strong> plant_id, status, created_at, (vendor_id, plant_id, alert_time DESC), (vendor_id, vendor_alert_id, plant_id), (vendor_id, vendor_plant_id)
                    </div>
                  </div>

                  {/* Disabled Plants Table */}
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <h4 className="font-semibold">disabled_plants</h4>
                    <p className="text-sm text-muted-foreground">Plants that haven&apos;t received vendor updates (last_update_time) for 3+ days</p>
                    <table className="w-full text-xs border-collapse mt-2">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Column</th>
                          <th className="text-left p-2">Type</th>
                          <th className="text-left p-2">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-2"><code>id</code></td>
                          <td className="p-2">SERIAL</td>
                          <td className="p-2">Primary key</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>plant_id</code></td>
                          <td className="p-2">INTEGER</td>
                          <td className="p-2">FK to plants</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>org_id</code></td>
                          <td className="p-2">INTEGER</td>
                          <td className="p-2">FK to organizations</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>vendor_id</code></td>
                          <td className="p-2">INTEGER</td>
                          <td className="p-2">FK to vendors</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>days_since_refresh</code></td>
                          <td className="p-2">INTEGER</td>
                          <td className="p-2">Days since last_update_time when plant was disabled</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code>disabled_at</code></td>
                          <td className="p-2">TIMESTAMPTZ</td>
                          <td className="p-2">When plant was marked as disabled</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="mt-2 text-xs text-muted-foreground space-y-1">
                      <p><strong>Automatic Disabling:</strong> Function <code>disable_inactive_plants()</code> runs daily at 2 AM IST via cron job (<code>lib/cron/disableInactivePlantsCron.js</code>).</p>
                      <p><strong>Inactivity Criteria:</strong> Plants are disabled based on <code>last_update_time</code> (vendor&apos;s last data update), not <code>last_refreshed_at</code> (our sync time). This ensures we disable plants that haven&apos;t received vendor updates, not just plants we haven&apos;t synced.</p>
                      <p><strong>Live Telemetry:</strong> Inactive plants continue to receive live telemetry sync until they are deleted by user.</p>
                      <p><strong>Deletion:</strong> Only disabled plants can be deleted. Only SUPERADMIN and DEVELOPER can delete plants. Plants associated with work orders cannot be deleted.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Row-Level Security (RLS)</h3>
                    <p className="text-sm text-muted-foreground">
                      All tables have RLS enabled. However, <strong>all API routes use SUPABASE_SERVICE_ROLE_KEY</strong> to bypass RLS because:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                      <li>Custom authentication doesn&apos;t use Supabase Auth (no auth.uid())</li>
                      <li>RLS policies require auth.uid() which doesn&apos;t exist in our system</li>
                      <li>Authorization is handled at application level via RBAC (lib/rbac.ts)</li>
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Database Relationships</h3>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <pre className="text-xs overflow-x-auto">
{`organizations (1) ──< (N) accounts
organizations (1) ──< (N) vendors
organizations (1) ──< (N) plants
organizations (1) ──< (N) work_orders

vendors (1) ──< (N) plants
vendors (1) ──< (N) alerts

plants (1) ──< (N) alerts
plants (1) ──< (N) work_order_plants

work_orders (1) ──< (N) work_order_plants

Unique Constraints:
- accounts.email (unique)
- (vendors.id, plants.vendor_plant_id) (unique) - prevents duplicate plants from same vendor
- (work_order_plants.work_order_id, work_order_plants.plant_id) (unique)
- uq_active_plant: one active work order per plant`}
                      </pre>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Unused/Deprecated Tables</h3>
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">✅ Cleanup Completed</h4>
                      <div className="mt-3 text-xs text-blue-700 dark:text-blue-300">
                        <strong>Note:</strong> Separate telemetry database has been removed. All telemetry is stored in main database (live metrics in <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">plants</code> table) or fetched on-demand from vendor APIs (historical graphs). The <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">work_order_plant_eff</code> table has been completely removed from the schema (not just dropped via migration) as PR (Performance Ratio) calculations are not part of the current system. All references to this table have been removed from the codebase, including schema definitions, RLS policies, type definitions, and documentation.
                      </div>
                    </div>
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
                        <th className="text-center p-3 font-semibold">listPlant</th>
                        <th className="text-center p-3 font-semibold">Telemetry</th>
                        <th className="text-center p-3 font-semibold">Alerts</th>
                        <th className="text-center p-3 font-semibold">Default Mode</th>
                        <th className="text-center p-3 font-semibold">Mapping</th>
                        <th className="text-left p-3 font-semibold">APIs Invoked</th>
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
                              <div title={vendor.authApi} className="cursor-help">
                                <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                              </div>
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {vendor.listPlants ? (
                              <div title={vendor.listPlantsApi} className="cursor-help">
                                <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                              </div>
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {vendor.listPlant ? (
                              <div title={vendor.listPlantApi} className="cursor-help">
                                <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                              </div>
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {vendor.telemetry ? (
                              <div title={vendor.telemetryApi} className="cursor-help">
                                <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                              </div>
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {vendor.alerts ? (
                              <div title={vendor.alertsApi} className="cursor-help">
                                <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                              </div>
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant={vendor.defaultMode === "LIST_PLANTS" ? "default" : "secondary"}>
                              {vendor.defaultMode}
                            </Badge>
                          </td>
                          <td className="p-3 text-center">
                            <Badge 
                              variant={
                                vendor.mappingStatus === "Complete" ? "default" : 
                                vendor.mappingStatus === "Partial" ? "secondary" : 
                                "destructive"
                              }
                            >
                              {vendor.mappingStatus}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground max-w-xs">
                            <div className="space-y-1">
                              {vendor.auth && <div>✓ {vendor.authApi}</div>}
                              {vendor.listPlants && <div>✓ {vendor.listPlantsApi}</div>}
                              {vendor.listPlant && <div>✓ {vendor.listPlantApi}</div>}
                              {vendor.telemetry && <div>✓ {vendor.telemetryApi}</div>}
                              {vendor.alerts && <div>✓ {vendor.alertsApi}</div>}
                            </div>
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
                {/* Flow Diagram */}
                <div className="bg-muted/50 p-6 rounded-lg">
                  <h3 className="font-semibold text-lg mb-4">Plant Sync Flow Diagram</h3>
                  <PlantSyncMermaidDiagram />
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
                          <li>Filters by <code className="bg-background px-1 rounded">auto_sync_enabled = true</code></li>
                          <li>For each vendor, checks <code className="bg-background px-1 rounded">shouldRunPlantSync()</code>:
                            <ul className="ml-4 mt-1 list-disc">
                              <li>Checks if current time is within 15 minutes of morning or evening sync time</li>
                              <li>Uses <code className="bg-background px-1 rounded">plant_list_sync_morning_ist</code> and <code className="bg-background px-1 rounded">plant_list_sync_evening_ist</code></li>
                              <li>Plant sync runs <strong>twice daily</strong> to fetch newly added plants</li>
                            </ul>
                          </li>
                        </ul>
                      </li>
                      <li>
                        <strong>For each eligible vendor:</strong> <code className="bg-background px-1 rounded">syncVendorPlants()</code>
                        <ul className="ml-4 mt-1 list-disc">
                          <li>Creates vendor adapter via <code className="bg-background px-1 rounded">VendorManager.getAdapter()</code></li>
                          <li>Sets token storage for adapter</li>
                          <li>Validates/refreshes token via <code className="bg-background px-1 rounded">validateAndRefreshToken()</code></li>
                          <li>Calls <code className="bg-background px-1 rounded">adapter.listPlants()</code></li>
                          <li>Normalizes plant data (unit conversions, timestamps)</li>
                          <li>Upserts plants in batches of 100 to <code className="bg-background px-1 rounded">plants</code> table</li>
                          <li>Updates production metrics (daily/monthly/yearly/total energy) from <code className="bg-background px-1 rounded">listPlants()</code> response</li>
                          <li><strong>Live Telemetry Enrichment:</strong> If live telemetry fields (current_power_kw, daily_energy_kwh, monthly_energy_mwh, yearly_energy_mwh, total_energy_mwh, network_status) 
                          are not present in <code className="bg-background px-1 rounded">listPlants()</code> response, optionally enriches each plant by calling <code className="bg-background px-1 rounded">adapter.listPlant(vendorPlantId)</code> 
                          (configurable via <code className="bg-background px-1 rounded">ENABLE_PER_PLANT_LIVE_TELEMETRY</code> env var, default: enabled). 
                          Processes in batches of 20 plants in parallel, then merges telemetry data into plant metadata before database upsert.</li>
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

          {/* Live Telemetry Sync Flow */}
          <Card className="overflow-hidden">
            <FlowSectionHeader flowId="flow-live-telemetry-sync" flowTitle="Live Telemetry Sync Flow" icon={Zap} />
            {expandedSections.has("flow-live-telemetry-sync") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Entry Points</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        1. Auto Cron
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Runs every 15 minutes via <code className="bg-background px-1 rounded">lib/cron/liveTelemetrySyncCron.js</code>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Calls <code className="bg-background px-1 rounded">GET /api/cron/sync-live-telemetry</code>
                      </p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        2. External Cron
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        GitHub Actions, cron-job.org, etc.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Calls <code className="bg-background px-1 rounded">GET /api/cron/sync-live-telemetry</code> with <code className="bg-background px-1 rounded">CRON_SECRET</code>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Complete Flow</h3>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    <ol className="text-sm text-muted-foreground space-y-3 ml-4 list-decimal">
                      <li>
                        <strong>Entry Point:</strong> Cron trigger (every 15 minutes)
                        <ul className="ml-4 mt-1 list-disc">
                          <li>Cron checks restricted window (8 PM - 5 AM IST by default)</li>
                          <li>If in window, sync is skipped</li>
                        </ul>
                      </li>
                      <li>
                        <strong>syncAllLiveTelemetry()</strong> in <code className="bg-background px-1 rounded">liveTelemetrySyncService.ts</code>
                        <ul className="ml-4 mt-1 list-disc">
                          <li>Fetches all active vendors</li>
                          <li>For each vendor, checks <code className="bg-background px-1 rounded">shouldSyncVendorTelemetry()</code>:
                            <ul className="ml-4 mt-1 list-disc">
                              <li>Checks if current minute matches <code className="bg-background px-1 rounded">telemetry_sync_interval</code> boundary</li>
                              <li>For 15 min: syncs at :00, :15, :30, :45</li>
                              <li>For 30 min: syncs at :00, :30</li>
                              <li>For 45 min: syncs at :00, :45</li>
                            </ul>
                          </li>
                        </ul>
                      </li>
                      <li>
                        <strong>For each eligible vendor:</strong> <code className="bg-background px-1 rounded">syncVendorLiveTelemetry()</code>
                        <ul className="ml-4 mt-1 list-disc">
                          <li>Gets <code className="bg-background px-1 rounded">telemetry_sync_mode</code> (LIST_PLANTS or PER_PLANT)</li>
                          <li>Creates vendor adapter and validates token</li>
                          <li><strong>If LIST_PLANTS mode (Efficient):</strong>
                            <ul className="ml-4 mt-1 list-disc">
                              <li>Calls <code className="bg-background px-1 rounded">adapter.listPlants()</code> once to get all plants with their live telemetry in a single API call</li>
                              <li>Extracts live telemetry fields from each plant&apos;s metadata: current_power_kw, daily_energy_kwh, monthly_energy_mwh, yearly_energy_mwh, total_energy_mwh, network_status</li>
                              <li>Maps vendor response to database fields (handles unit conversions: W→kW, kWh→MWh)</li>
                              <li>Updates <code className="bg-background px-1 rounded">plants</code> table in batches of 100</li>
                              <li><strong>Vendors using this mode:</strong> Solarman, ShineMonitor (when telemetry_sync_mode = LIST_PLANTS)</li>
                            </ul>
                          </li>
                          <li><strong>If PER_PLANT mode (Costly but Necessary):</strong>
                            <ul className="ml-4 mt-1 list-disc">
                              <li>Fetches all active plants for vendor from database</li>
                              <li>Processes in batches of 50 plants (parallel API calls to avoid overwhelming vendor)</li>
                              <li>For each plant, calls <code className="bg-background px-1 rounded">adapter.listPlant(vendorPlantId)</code> to get individual plant telemetry</li>
                              <li>Extracts live telemetry fields from each plant&apos;s metadata</li>
                              <li>Collects all updates and performs batch database update (100 plants per transaction to reduce DB load)</li>
                              <li><strong>Vendors using this mode:</strong> SolarDM, PVBlink (when telemetry_sync_mode = PER_PLANT, or when listPlants() doesn&apos;t provide live telemetry)</li>
                            </ul>
                          </li>
                          <li>Updates fields: <code className="bg-background px-1 rounded">current_power_kw</code>, <code className="bg-background px-1 rounded">daily_energy_kwh</code>, <code className="bg-background px-1 rounded">monthly_energy_mwh</code>, <code className="bg-background px-1 rounded">yearly_energy_mwh</code>, <code className="bg-background px-1 rounded">total_energy_mwh</code>, <code className="bg-background px-1 rounded">network_status</code></li>
                        </ul>
                      </li>
                      <li>
                        <strong>Results:</strong> Summary with success/failure counts, plants synced/failed
                      </li>
                    </ol>
                  </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-900">
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">⚠️ Important Notes</h4>
                  <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1 ml-4 list-disc">
                    <li>Live telemetry sync is <strong>separate from plant sync</strong> - runs at different intervals</li>
                    <li>Plant sync runs twice daily to fetch newly added plants</li>
                    <li>Live telemetry sync runs at configurable intervals (15/30/45 min) to update real-time metrics</li>
                    <li>LIST_PLANTS mode is more efficient (single API call) but requires vendor support</li>
                    <li>PER_PLANT mode is costly (one call per plant) but works for all vendors</li>
                    <li>All syncs respect the restricted time window (8 PM - 5 AM IST)</li>
                  </ul>
                </div>
              </div>
            )}
          </Card>

          {/* WMS Site Sync Flow */}
          <Card className="overflow-hidden">
            <FlowSectionHeader flowId="flow-wms-site-sync" flowTitle="WMS Site Sync Flow" icon={RefreshCw} />
            {expandedSections.has("flow-wms-site-sync") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Entry Points</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        1. Auto Cron
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Runs twice daily (6 AM and 10 PM IST) via <code className="bg-background px-1 rounded">lib/cron/wmsSiteSyncCron.js</code>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Calls <code className="bg-background px-1 rounded">GET /api/cron/sync-wms-sites</code>
                      </p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        2. External Cron
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        GitHub Actions, cron-job.org, etc.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Calls <code className="bg-background px-1 rounded">GET /api/cron/sync-wms-sites</code> with <code className="bg-background px-1 rounded">CRON_SECRET</code>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Complete Flow</h3>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    <ol className="text-sm text-muted-foreground space-y-3 ml-4 list-decimal">
                      <li>
                        <strong>Entry Point:</strong> Cron trigger (twice daily: 6 AM and 10 PM IST)
                      </li>
                      <li>
                        <strong>syncAllWmsSites()</strong> in <code className="bg-background px-1 rounded">wmsSyncService.ts</code>
                        <ul className="ml-4 mt-1 list-disc">
                          <li>Fetches all active WMS vendors from <code className="bg-background px-1 rounded">wms_vendors</code> table</li>
                          <li>For each vendor, creates WMS adapter (e.g., IntelloAdapter)</li>
                          <li>Authenticates with WMS vendor API (uses cached token if valid)</li>
                        </ul>
                      </li>
                      <li>
                        <strong>For each WMS vendor:</strong>
                        <ul className="ml-4 mt-1 list-disc">
                          <li>Calls <code className="bg-background px-1 rounded">adapter.listSites()</code> to fetch all sites</li>
                          <li>For each site:
                            <ul className="ml-4 mt-1 list-disc">
                              <li>Upserts site into <code className="bg-background px-1 rounded">wms_sites</code> table</li>
                              <li>Extracts devices (RTUs) from site response (stored in metadata)</li>
                              <li>For each device, upserts into <code className="bg-background px-1 rounded">wms_devices</code> table</li>
                            </ul>
                          </li>
                          <li>Updates <code className="bg-background px-1 rounded">last_synced_at</code> timestamp for vendor</li>
                        </ul>
                      </li>
                      <li>
                        <strong>Results:</strong> Summary with sites synced, devices synced, success/failure counts
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* WMS Insolation Sync Flow */}
          <Card className="overflow-hidden">
            <FlowSectionHeader flowId="flow-wms-insolation-sync" flowTitle="WMS Insolation Sync Flow" icon={Zap} />
            {expandedSections.has("flow-wms-insolation-sync") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Entry Points</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        1. Auto Cron
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Runs daily at 10 PM IST via <code className="bg-background px-1 rounded">lib/cron/wmsInsolationSyncCron.js</code>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Calls <code className="bg-background px-1 rounded">GET /api/cron/sync-wms-insolation</code>
                      </p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        2. External Cron / Manual
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        GitHub Actions, cron-job.org, or manual trigger
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Calls <code className="bg-background px-1 rounded">GET /api/cron/sync-wms-insolation</code> with <code className="bg-background px-1 rounded">CRON_SECRET</code>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Complete Flow</h3>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    <ol className="text-sm text-muted-foreground space-y-3 ml-4 list-decimal">
                      <li>
                        <strong>Entry Point:</strong> Cron trigger (daily at 10 PM IST) or manual
                      </li>
                      <li>
                        <strong>syncAllWmsInsolation()</strong> in <code className="bg-background px-1 rounded">wmsSyncService.ts</code>
                        <ul className="ml-4 mt-1 list-disc">
                          <li>Fetches all active WMS vendors</li>
                          <li>For each vendor, gets all active devices from <code className="bg-background px-1 rounded">wms_devices</code> table</li>
                          <li>Creates WMS adapter and authenticates</li>
                        </ul>
                      </li>
                      <li>
                        <strong>For each device:</strong>
                        <ul className="ml-4 mt-1 list-disc">
                          <li>Fetches current day&apos;s date (or previous day if running in morning)</li>
                          <li>Calls <code className="bg-background px-1 rounded">adapter.getInsolationData(deviceId, fromDate, toDate)</code> to get hourly readings</li>
                          <li>Calculates average insolation from hourly IRR values using <code className="bg-background px-1 rounded">calculateAverageInsolation()</code></li>
                          <li>Upserts daily insolation reading into <code className="bg-background px-1 rounded">insolation_readings</code> table</li>
                          <li>Automatic cleanup: Old readings beyond 100 days are removed (rollover)</li>
                        </ul>
                      </li>
                      <li>
                        <strong>Backfill Flow (Initial Setup):</strong>
                        <ul className="ml-4 mt-1 list-disc">
                          <li><code className="bg-background px-1 rounded">backfillAllWmsInsolation()</code> fetches last 100 days of data</li>
                          <li>Iterates through each day (from 100 days ago to today)</li>
                          <li>For each day, fetches insolation for all devices</li>
                          <li>Stores all readings in <code className="bg-background px-1 rounded">insolation_readings</code> table</li>
                        </ul>
                      </li>
                      <li>
                        <strong>Results:</strong> Summary with readings created/updated, devices synced, success/failure counts
                      </li>
                    </ol>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📊 Insolation Calculation</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
                    <li>Insolation is calculated as the <strong>average of all hourly IRR values</strong> for a given day</li>
                    <li>Only non-zero, non-null IRR values are included in the calculation</li>
                    <li>Stored in <code className="bg-background px-1 rounded">insolation_readings</code> table with <code className="bg-background px-1 rounded">date</code> and <code className="bg-background px-1 rounded">device_id</code></li>
                    <li>100-day rollover: Old readings are automatically deleted when new ones are added</li>
                  </ul>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Code Tab */}
        <TabsContent value="code" className="space-y-6">
          <Card className="overflow-hidden">
            <SectionHeader id="code-structure" title="Code Structure & Architecture" icon={Code} />
            {expandedSections.has("code-structure") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Project Structure</h3>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <pre className="text-xs overflow-x-auto">
{`woms/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes (Next.js API endpoints)
│   │   ├── accounts/            # Account management
│   │   ├── alerts/              # Alert endpoints
│   │   ├── cron/                # Cron job endpoints
│   │   │   ├── sync-wms-sites/  # WMS site sync endpoint
│   │   │   └── sync-wms-insolation/  # WMS insolation sync endpoint
│   │   ├── dashboard/           # Dashboard data
│   │   ├── login/               # Authentication
│   │   ├── orgs/                # Organization management
│   │   ├── plants/               # Plant endpoints
│   │   ├── vendors/             # Vendor management & sync
│   │   │   ├── export/          # Excel export endpoint
│   │   │   └── import/          # Excel import endpoint
│   │   ├── wms-vendors/         # WMS vendor management
│   │   │   └── [id]/            # WMS vendor CRUD operations
│   │   ├── accounts/            # Account management
│   │   │   ├── export/          # Excel export endpoint
│   │   │   └── import/          # Excel import endpoint
│   │   └── workorders/          # Work order endpoints
│   │       ├── export/          # Excel export endpoint
│   │       └── import/          # Excel import endpoint
│   ├── auth/                     # Auth pages
│   ├── dashboard/                # Dashboard page
│   ├── superadmin/               # Super admin pages
│   └── workorders/               # Work order pages
├── components/                   # React components
│   ├── ui/                      # shadcn/ui components
│   └── *.tsx                    # Feature components
├── lib/                          # Core libraries
│   ├── services/                # Business logic services
│   │   ├── plantSyncService.ts  # Plant sync orchestration (twice daily)
│   │   ├── alertSyncService.ts  # Alert sync orchestration
│   │   ├── liveTelemetrySyncService.ts  # Live telemetry sync (15/30/45 min intervals)
│   │   └── wmsSyncService.ts    # WMS site/device sync and insolation sync
│   ├── vendors/                 # Inverter vendor adapter system
│   │   ├── baseVendorAdapter.ts # Abstract base class (includes listPlant method)
│   │   ├── solarmanAdapter.ts   # Solarman implementation
│   │   ├── solarDmAdapter.ts   # SolarDM implementation
│   │   ├── pvBlinkAdapter.ts    # PVBlink implementation
│   │   ├── shineMonitorAdapter.ts  # ShineMonitor implementation
│   │   ├── foxesscloudAdapter.ts   # Foxesscloud implementation
│   │   └── vendorManager.ts     # Factory pattern
│   ├── wms/                     # Weather Monitoring System adapters
│   │   ├── baseWmsAdapter.ts    # Abstract base class for WMS vendors
│   │   └── intelloAdapter.ts    # Intello WMS implementation
│   ├── cron/                    # Cron job definitions
│   │   ├── plantSyncCron.js    # Plant sync scheduler (checks morning/evening times)
│   │   ├── liveTelemetrySyncCron.js  # Live telemetry sync scheduler
│   │   ├── alertSyncCron.js     # Alert sync scheduler
│   │   ├── wmsSiteSyncCron.js   # WMS site sync scheduler (twice daily)
│   │   └── wmsInsolationSyncCron.js  # WMS insolation sync scheduler (daily)
│   ├── supabase/                # Database clients
│   │   ├── pooled.ts            # Connection pooling
│   │   ├── client.ts            # Client-side client
│   │   └── server.ts            # Server-side client
│   ├── context/                 # MDC & Logging
│   │   ├── mdc.ts               # Mapped Diagnostic Context
│   │   └── logger.ts            # Structured logger
│   ├── rbac.ts                  # Role-based access control
│   └── api-logger.ts            # API request/response logging
├── supabase/
│   ├── migrations/              # Database migrations
│   └── functions/               # Edge Functions (Deno)
│       ├── vendor-auth/         # Vendor authentication
│       ├── sync-alerts/         # Alert sync
│       └── sync-telemetry/      # Telemetry sync
├── middleware.ts                # Route protection & auth
├── server.js                    # Custom Next.js server with cron
└── types/                       # TypeScript definitions`}
                    </pre>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Core Services</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">lib/services/plantSyncService.ts</h4>
                      <p className="text-xs text-muted-foreground mb-2">Main plant synchronization service (twice daily)</p>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><code className="bg-background px-1 rounded">syncAllPlants()</code> - Main entry point, orchestrates all vendor syncs</li>
                        <li><code className="bg-background px-1 rounded">syncVendorPlants()</code> - Per-vendor sync logic</li>
                        <li><code className="bg-background px-1 rounded">shouldRunPlantSync()</code> - Checks if current time matches morning/evening sync times</li>
                        <li><code className="bg-background px-1 rounded">validateAndRefreshToken()</code> - Token validation and refresh</li>
                        <li>Batch upserts (100 plants per batch) for performance</li>
                        <li>Unit conversions (W→kW, kWh→MWh) during normalization</li>
                        <li>Timestamp conversions (Unix seconds → ISO strings)</li>
                          <li>Fetches newly added plants from vendors</li>
                          <li><strong>Optional Live Telemetry Enrichment:</strong> If live telemetry (current_power_kw, daily_energy_kwh, etc.) is not available in <code className="bg-background px-1 rounded">listPlants()</code> response, 
                          optionally enriches plants by calling <code className="bg-background px-1 rounded">adapter.listPlant(vendorPlantId)</code> for each plant (configurable via <code className="bg-background px-1 rounded">ENABLE_PER_PLANT_LIVE_TELEMETRY</code> env var, default: enabled). 
                          This is done in batches of 20 plants in parallel to avoid overwhelming vendor APIs.</li>
                      </ul>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">lib/services/liveTelemetrySyncService.ts</h4>
                      <p className="text-xs text-muted-foreground mb-2">Live telemetry synchronization service</p>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><code className="bg-background px-1 rounded">syncAllLiveTelemetry()</code> - Main entry point, orchestrates all vendor telemetry syncs</li>
                        <li><code className="bg-background px-1 rounded">syncVendorLiveTelemetry()</code> - Per-vendor telemetry sync with mode handling</li>
                        <li><code className="bg-background px-1 rounded">shouldSyncVendorTelemetry()</code> - Checks if vendor should be synced based on telemetry_sync_interval</li>
                        <li>Supports two modes: LIST_PLANTS (single API call) or PER_PLANT (individual calls)</li>
                        <li>Batch fetching (50 plants parallel) and batch updates (100 plants per transaction)</li>
                        <li>Updates: current_power_kw, daily_energy_kwh, monthly_energy_mwh, yearly_energy_mwh, total_energy_mwh, network_status</li>
                      </ul>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">lib/services/alertSyncService.ts</h4>
                      <p className="text-xs text-muted-foreground mb-2">Alert synchronization service</p>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><code className="bg-background px-1 rounded">syncAllAlerts()</code> - Sync all vendors&apos; alerts</li>
                        <li><code className="bg-background px-1 rounded">syncSolarmanVendorAlerts()</code> - Solarman implementation</li>
                        <li><code className="bg-background px-1 rounded">syncSolarDmVendorAlerts()</code> - SolarDM implementation</li>
                        <li><code className="bg-background px-1 rounded">calculateGridDownBenefitKwh()</code> - Grid downtime benefit calculation</li>
                        <li><code className="bg-background px-1 rounded">getVendorAlertsStartDate()</code> - Configurable lookback window</li>
                        <li>Severity mapping (vendor-specific → standard enum)</li>
                        <li>Alert deduplication by vendor_alert_id</li>
                      </ul>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">lib/services/wmsSyncService.ts</h4>
                      <p className="text-xs text-muted-foreground mb-2">Weather Monitoring System synchronization service</p>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><code className="bg-background px-1 rounded">syncAllWmsSites()</code> - Sync sites and devices for all WMS vendors (twice daily)</li>
                        <li><code className="bg-background px-1 rounded">syncAllWmsInsolation()</code> - Sync insolation data for all WMS vendors (end of day)</li>
                        <li><code className="bg-background px-1 rounded">backfillAllWmsInsolation()</code> - Backfill insolation data for last 100 days</li>
                        <li>Site and device sync with upsert logic</li>
                        <li>Insolation calculation (average of hourly IRR values)</li>
                        <li>100-day rollover storage (automatic cleanup of old readings)</li>
                        <li>Token caching in database (similar to inverter vendors)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Vendor Adapter System</h3>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Pluggable architecture using adapter pattern. Inverter vendors extend <code className="bg-background px-1 rounded">BaseVendorAdapter</code>. WMS vendors extend <code className="bg-background px-1 rounded">BaseWmsAdapter</code>.
                    </p>
                    <div className="space-y-2">
                      <div>
                        <h4 className="font-medium text-sm mb-1">BaseVendorAdapter (lib/vendors/baseVendorAdapter.ts)</h4>
                        <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Abstract base class with common functionality</li>
                          <li>Token storage interface (setTokenStorage)</li>
                          <li>HTTP client with connection pooling</li>
                          <li>Error handling and retry logic</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-1">Required Methods (all adapters must implement)</h4>
                        <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                          <li><code className="bg-background px-1 rounded">authenticate()</code> - Returns access token</li>
                          <li><code className="bg-background px-1 rounded">listPlants()</code> - Returns all plants from vendor</li>
                          <li><code className="bg-background px-1 rounded">listPlant(vendorPlantId)</code> - Returns single plant by vendor plant ID (for PER_PLANT mode)</li>
                          <li><code className="bg-background px-1 rounded">getTelemetry()</code> - Time-series telemetry data</li>
                          <li><code className="bg-background px-1 rounded">getAlerts()</code> - Alert data (if supported)</li>
                          <li><code className="bg-background px-1 rounded">normalizeTelemetry()</code> - Vendor → standard format</li>
                          <li><code className="bg-background px-1 rounded">normalizeAlert()</code> - Vendor → standard alert format</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-1">VendorManager (lib/vendors/vendorManager.ts)</h4>
                        <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Factory pattern to get adapter by vendor_type</li>
                          <li>Singleton adapter instances (reused across requests)</li>
                          <li>Handles adapter creation and configuration</li>
                        </ul>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="font-medium text-sm mb-2">WMS Adapter System (lib/wms/)</h4>
                      <div className="space-y-2">
                        <div>
                          <h5 className="font-medium text-xs mb-1">BaseWmsAdapter (lib/wms/baseWmsAdapter.ts)</h5>
                          <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                            <li>Abstract base class for WMS vendor adapters</li>
                            <li>API base URL from environment variables (e.g., INTELLO_API_BASE_URL)</li>
                            <li>Token storage interface (setTokenStorage)</li>
                            <li>HTTP client with connection pooling</li>
                            <li>Average insolation calculation from hourly readings</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-xs mb-1">Required Methods (all WMS adapters must implement)</h5>
                          <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                            <li><code className="bg-background px-1 rounded">authenticate()</code> - Returns access token</li>
                            <li><code className="bg-background px-1 rounded">listSites()</code> - Returns all sites from WMS vendor</li>
                            <li><code className="bg-background px-1 rounded">getInsolationData(deviceId, fromDate, toDate)</code> - Returns hourly insolation readings</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-xs mb-1">IntelloAdapter (lib/wms/intelloAdapter.ts)</h5>
                          <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                            <li>Intello WMS vendor implementation</li>
                            <li>Authentication: POST /api/intello/authenticate (email, password_hash)</li>
                            <li>Sites: GET /api/intello/user/v1/sites</li>
                            <li>Insolation: GET /api/intello/rtu/v1/data (with date range and RTU ID)</li>
                            <li>Extracts devices (RTUs) from site response</li>
                            <li>Calculates average insolation from hourly IRR values</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">API Routes Pattern</h3>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <p className="text-sm text-muted-foreground">
                      All API routes follow this pattern:
                    </p>
                    <ol className="text-sm text-muted-foreground space-y-2 ml-4 list-decimal">
                      <li>Extract session cookie from request</li>
                      <li>Decode session: <code className="bg-background px-1 rounded">JSON.parse(Buffer.from(session, &quot;base64&quot;).toString())</code></li>
                      <li>Get <code className="bg-background px-1 rounded">accountType</code> and <code className="bg-background px-1 rounded">orgId</code> from session</li>
                      <li>Use <code className="bg-background px-1 rounded">requirePermission(accountType, resource, action)</code> for authorization</li>
                      <li>Use <code className="bg-background px-1 rounded">getMainClient()</code> (service role key) to bypass RLS</li>
                      <li>Perform database operations</li>
                      <li>Return JSON response (or Excel file for export endpoints)</li>
                    </ol>
                    <div className="mt-3">
                      <h4 className="font-medium text-sm mb-1">Excel Import/Export Routes</h4>
                      <p className="text-xs text-muted-foreground">
                        Excel operations use <code className="bg-background px-1 rounded">exceljs</code> library:
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc mt-1">
                        <li><strong>Export:</strong> <code className="bg-background px-1 rounded">GET /api/{`{resource}`}/export</code> - Generates Excel file, returns as blob with Content-Type header</li>
                        <li><strong>Import:</strong> <code className="bg-background px-1 rounded">POST /api/{`{resource}`}/import</code> - Accepts multipart/form-data with file, parses Excel, validates, creates records</li>
                        <li><strong>Resources:</strong> workorders, vendors, accounts</li>
                        <li><strong>Access:</strong> SUPERADMIN and DEVELOPER only</li>
                        <li><strong>Behavior:</strong> Import only creates new records - never updates existing ones</li>
                        <li><strong>Validation:</strong> Comprehensive validation with detailed error messages for failed rows</li>
                      </ul>
                    </div>
                    <div className="mt-3">
                      <h4 className="font-medium text-sm mb-1">MDC Context Integration</h4>
                      <p className="text-xs text-muted-foreground">
                        API routes use <code className="bg-background px-1 rounded">withMDCContext()</code> wrapper to:
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc mt-1">
                        <li>Set MDC context with request metadata (source, user, operation)</li>
                        <li>Automatically propagate context to all async operations</li>
                        <li>Enable structured logging with context</li>
                      </ul>
                    </div>
                    <div className="mt-3">
                      <h4 className="font-medium text-sm mb-1">WMS API Endpoints</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        Weather Monitoring System API routes:
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><strong>GET /api/wms-vendors</strong> - List WMS vendors (filtered by org for ORG users)</li>
                        <li><strong>POST /api/wms-vendors</strong> - Create WMS vendor (SUPERADMIN/DEVELOPER only)</li>
                        <li><strong>GET /api/wms-vendors/[id]</strong> - Get single WMS vendor</li>
                        <li><strong>PUT /api/wms-vendors/[id]</strong> - Update WMS vendor (SUPERADMIN/DEVELOPER only)</li>
                        <li><strong>DELETE /api/wms-vendors/[id]</strong> - Delete WMS vendor (SUPERADMIN/DEVELOPER only)</li>
                        <li><strong>GET /api/cron/sync-wms-sites</strong> - Sync sites for all WMS vendors (cron endpoint, requires CRON_SECRET if configured)</li>
                        <li><strong>GET /api/cron/sync-wms-insolation</strong> - Sync insolation for all WMS vendors (cron endpoint, requires CRON_SECRET if configured)</li>
                      </ul>
                      <div className="bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded-lg border border-yellow-200 dark:border-yellow-900 mt-2">
                        <p className="text-xs text-yellow-800 dark:text-yellow-200">
                          <strong>⚠️ Known Issues:</strong>
                        </p>
                        <ul className="text-xs text-yellow-800 dark:text-yellow-200 space-y-1 ml-4 list-disc mt-1">
                          <li><strong>Missing per-vendor sync endpoint:</strong> Currently, <code className="bg-background px-1 rounded">/api/cron/sync-wms-sites</code> syncs all vendors. A per-vendor endpoint like <code className="bg-background px-1 rounded">/api/wms-vendors/[id]/sync-sites</code> (similar to <code className="bg-background px-1 rounded">/api/vendors/[id]/sync-plants</code>) is needed for UI-triggered single-vendor syncs.</li>
                          <li><strong>Missing data retrieval endpoints:</strong> No endpoints exist to fetch WMS sites, devices, or insolation data for viewing in the UI (e.g., <code className="bg-background px-1 rounded">/api/wms-vendors/[id]/sites</code>, <code className="bg-background px-1 rounded">/api/wms-vendors/[id]/devices</code>, <code className="bg-background px-1 rounded">/api/insolation-readings</code>).</li>
                          <li><strong>Cron endpoint authentication:</strong> The UI component calls <code className="bg-background px-1 rounded">/api/cron/sync-wms-sites</code> without providing <code className="bg-background px-1 rounded">CRON_SECRET</code>, which may cause authentication failures if the secret is configured.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Authentication & Authorization</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Custom Authentication</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><strong>NOT Supabase Auth</strong> - uses custom accounts table</li>
                        <li>Login: <code className="bg-background px-1 rounded">POST /api/login</code></li>
                        <li>Password: bcrypt hash (10 rounds) stored in <code className="bg-background px-1 rounded">password_hash</code></li>
                        <li>Session: base64-encoded JSON cookie with <code className="bg-background px-1 rounded">{"{accountId, accountType, orgId, email}"}</code></li>
                        <li>Session expiry: 7 days (configurable)</li>
                        <li>HTTP-only cookies prevent XSS</li>
                        <li>Secure flag in production</li>
                      </ul>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">RBAC (lib/rbac.ts)</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li>Four account types: SUPERADMIN, DEVELOPER, GOVT, ORG</li>
                        <li>Granular permissions per resource/action</li>
                        <li><code className="bg-background px-1 rounded">requirePermission()</code> throws on unauthorized</li>
                        <li>DEVELOPER has all SUPERADMIN permissions + docs access</li>
                        <li>GOVT: read-only global access</li>
                        <li>ORG: read-only access to own org data</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Middleware (middleware.ts)</h3>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                      <li>Runs on all routes except <code className="bg-background px-1 rounded">/_next</code>, <code className="bg-background px-1 rounded">/api</code>, <code className="bg-background px-1 rounded">/favicon.ico</code></li>
                      <li>Checks for session cookie</li>
                      <li>Decodes session to get accountType</li>
                      <li>Enforces role-based route protection:
                        <ul className="ml-4 mt-1 list-disc">
                          <li><code className="bg-background px-1 rounded">/superadmin/*</code> - SUPERADMIN and DEVELOPER only</li>
                          <li><code className="bg-background px-1 rounded">/superadmin/system-flow</code> - DEVELOPER only</li>
                          <li>Redirects unauthorized users to dashboard</li>
                        </ul>
                      </li>
                      <li>Redirects root and <code className="bg-background px-1 rounded">/auth/login</code> to dashboard</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Cron Jobs (lib/cron/)</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">plantSyncCron.js</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li>Schedule: Every 15 minutes (<code className="bg-background px-1 rounded">*/15 * * * *</code>)</li>
                        <li>Calls: <code className="bg-background px-1 rounded">GET /api/cron/sync-plants</code></li>
                        <li>Checks restricted window (8 PM - 5 AM IST by default)</li>
                        <li>Service checks morning/evening times - plant sync runs <strong>twice daily</strong></li>
                        <li>Skips sync if in restricted window or not at sync time</li>
                        <li>Uses <code className="bg-background px-1 rounded">CRON_SECRET</code> for security (if configured)</li>
                        <li>Runs in-process (server.js starts it)</li>
                      </ul>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">liveTelemetrySyncCron.js</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li>Schedule: Every 15 minutes (<code className="bg-background px-1 rounded">*/15 * * * *</code>)</li>
                        <li>Calls: <code className="bg-background px-1 rounded">GET /api/cron/sync-live-telemetry</code></li>
                        <li>Checks restricted window (8 PM - 5 AM IST by default)</li>
                        <li>Service filters vendors by <code className="bg-background px-1 rounded">telemetry_sync_interval</code> (15/30/45 min)</li>
                        <li>Only syncs vendors whose interval matches current time</li>
                        <li>Uses <code className="bg-background px-1 rounded">CRON_SECRET</code> for security (if configured)</li>
                        <li>Runs in-process (server.js starts it)</li>
                      </ul>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">alertSyncCron.js</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li>Schedule: Every 30 minutes (<code className="bg-background px-1 rounded">*/30 * * * *</code>)</li>
                        <li>Calls: <code className="bg-background px-1 rounded">GET /api/cron/sync-alerts</code></li>
                        <li>Syncs alerts for all active vendors</li>
                        <li>Runs in-process (server.js starts it)</li>
                      </ul>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">disableInactivePlantsCron.js</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li>Schedule: Daily at 2 AM IST / 8:30 PM UTC (<code className="bg-background px-1 rounded">30 20 * * *</code>)</li>
                        <li>Calls: <code className="bg-background px-1 rounded">GET /api/cron/disable-inactive-plants</code></li>
                        <li>Disables plants that haven&apos;t received vendor updates (last_update_time) for 3+ days</li>
                        <li>Runs in-process (server.js starts it)</li>
                        <li>Can be disabled with <code className="bg-background px-1 rounded">ENABLE_DISABLE_INACTIVE_PLANTS_CRON=false</code></li>
                      </ul>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">wmsSiteSyncCron.js</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li>Schedule: Twice daily at 6 AM and 10 PM IST (<code className="bg-background px-1 rounded">0 6,22 * * *</code>)</li>
                        <li>Calls: <code className="bg-background px-1 rounded">GET /api/cron/sync-wms-sites</code></li>
                        <li>Syncs sites and devices from all active WMS vendors</li>
                        <li>Checks for new sites and updates existing ones</li>
                        <li>Extracts devices (RTUs) from site responses</li>
                        <li>Uses <code className="bg-background px-1 rounded">CRON_SECRET</code> for security (if configured)</li>
                        <li>Runs in-process (server.js starts it)</li>
                        <li>Can be disabled with <code className="bg-background px-1 rounded">ENABLE_WMS_SITE_SYNC_CRON=false</code></li>
                      </ul>
                    </div>
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">wmsInsolationSyncCron.js</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li>Schedule: Daily at 10 PM IST (<code className="bg-background px-1 rounded">0 22 * * *</code>)</li>
                        <li>Calls: <code className="bg-background px-1 rounded">GET /api/cron/sync-wms-insolation</code></li>
                        <li>Syncs insolation data for current day for all active WMS vendors</li>
                        <li>Fetches hourly insolation readings and calculates daily average</li>
                        <li>Stores in <code className="bg-background px-1 rounded">insolation_readings</code> table (100-day rollover)</li>
                        <li>Uses <code className="bg-background px-1 rounded">CRON_SECRET</code> for security (if configured)</li>
                        <li>Runs in-process (server.js starts it)</li>
                        <li>Can be disabled with <code className="bg-background px-1 rounded">ENABLE_WMS_INSOLATION_SYNC_CRON=false</code></li>
                      </ul>
                    </div>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                      <strong>⚠️ Production Note:</strong> In-process cron jobs are lost if server crashes. 
                      Consider moving to external scheduler (Supabase Edge Functions, Cloud Scheduler) for production.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Database Clients (lib/supabase/)</h3>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <div>
                      <h4 className="font-medium text-sm mb-1">pooled.ts - Connection Pooling</h4>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><code className="bg-background px-1 rounded">getMainClient()</code> - Singleton main DB client</li>
                        <li>Uses <code className="bg-background px-1 rounded">pooledFetch</code> for HTTP connection reuse</li>
                        <li>Service role key bypasses RLS</li>
                        <li>Reuses client instances across requests</li>
                      </ul>
                    </div>
                    <div className="mt-2">
                      <h4 className="font-medium text-sm mb-1">client.ts - Client-Side Client</h4>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                        <li>Uses anon key (limited by RLS)</li>
                        <li>For client-side components (currently minimal usage)</li>
                      </ul>
                    </div>
                    <div className="mt-2">
                      <h4 className="font-medium text-sm mb-1">server.ts - Server-Side Client</h4>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                        <li>Uses service role key</li>
                        <li>For server components and API routes</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">MDC & Logging (lib/context/)</h3>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <div>
                      <h4 className="font-medium text-sm mb-1">MDC (mdc.ts)</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        Mapped Diagnostic Context - thread-local-like storage for async operations
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                        <li>Uses <code className="bg-background px-1 rounded">AsyncLocalStorage</code> for context propagation</li>
                        <li>Stores: source, requestId, userId, accountType, orgId, operation, vendorId</li>
                        <li>Automatically propagates to all async operations</li>
                        <li>Used by logger for structured logging</li>
                      </ul>
                    </div>
                    <div className="mt-2">
                      <h4 className="font-medium text-sm mb-1">Logger (logger.ts)</h4>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                        <li>Structured logging with MDC context</li>
                        <li>Logs to console (can be extended to external service)</li>
                        <li>Includes context prefix in log messages</li>
                      </ul>
                    </div>
                    <div className="mt-2">
                      <h4 className="font-medium text-sm mb-1">API Logger (api-logger.ts)</h4>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                        <li>Logs all API requests/responses</li>
                        <li>Includes user information, action, duration</li>
                        <li>Uses MDC context for consistent logging</li>
                        <li>Helper: <code className="bg-background px-1 rounded">withMDCContext()</code> wraps API handlers</li>
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
            <SectionHeader id="config-details" title="Configuration & Infrastructure" icon={Settings} />
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
                          <th className="text-left p-2 font-semibold">Required</th>
                          <th className="text-left p-2 font-semibold">Default</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code></td>
                          <td className="p-2">Main Supabase database URL</td>
                          <td className="p-2">✅ Yes</td>
                          <td className="p-2">-</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code></td>
                          <td className="p-2">Main DB anon key (limited permissions)</td>
                          <td className="p-2">✅ Yes</td>
                          <td className="p-2">-</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code></td>
                          <td className="p-2">Main DB service role key (bypasses RLS) - <strong>CRITICAL</strong></td>
                          <td className="p-2">✅ Yes</td>
                          <td className="p-2">-</td>
                        </tr>
                        <tr className="border-b bg-red-50 dark:bg-red-950/10">
                          <td className="p-2"><code className="bg-background px-1 rounded">TELEMETRY_SUPABASE_URL</code></td>
                          <td className="p-2">Telemetry database URL - <strong>DEPRECATED</strong> (separate telemetry database has been removed)</td>
                          <td className="p-2">❌ No</td>
                          <td className="p-2">-</td>
                        </tr>
                        <tr className="border-b bg-red-50 dark:bg-red-950/10">
                          <td className="p-2"><code className="bg-background px-1 rounded">TELEMETRY_SUPABASE_ANON_KEY</code></td>
                          <td className="p-2">Telemetry DB anon key - <strong>DEPRECATED</strong> (not used)</td>
                          <td className="p-2">❌ No</td>
                          <td className="p-2">-</td>
                        </tr>
                        <tr className="border-b bg-red-50 dark:bg-red-950/10">
                          <td className="p-2"><code className="bg-background px-1 rounded">TELEMETRY_SUPABASE_SERVICE_ROLE_KEY</code></td>
                          <td className="p-2">Telemetry DB service role key - <strong>DEPRECATED</strong> (not used)</td>
                          <td className="p-2">❌ No</td>
                          <td className="p-2">-</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">SOLARMAN_API_BASE_URL</code></td>
                          <td className="p-2">Solarman API base URL</td>
                          <td className="p-2">✅ Yes (if using Solarman)</td>
                          <td className="p-2">https://globalapi.solarmanpv.com</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">SOLARMAN_PRO_API_BASE_URL</code></td>
                          <td className="p-2">Solarman PRO API base URL (preferred, richer data)</td>
                          <td className="p-2">⚠️ Optional</td>
                          <td className="p-2">https://globalpro.solarmanpv.com</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">SOLARDM_API_BASE_URL</code></td>
                          <td className="p-2">SolarDM API base URL</td>
                          <td className="p-2">✅ Yes (if using SolarDM)</td>
                          <td className="p-2">-</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">PVBLINK_API_BASE_URL</code></td>
                          <td className="p-2">PVBlink API base URL</td>
                          <td className="p-2">✅ Yes (if using PVBlink)</td>
                          <td className="p-2">-</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">FOXESSCLOUD_API_BASE_URL</code></td>
                          <td className="p-2">Foxesscloud API base URL</td>
                          <td className="p-2">✅ Yes (if using Foxesscloud)</td>
                          <td className="p-2">-</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">SHINEMONITOR_API_BASE_URL</code></td>
                          <td className="p-2">ShineMonitor API base URL</td>
                          <td className="p-2">✅ Yes (if using ShineMonitor)</td>
                          <td className="p-2">-</td>
                        </tr>
                        <tr className="border-b bg-blue-50 dark:bg-blue-950/10">
                          <td className="p-2"><code className="bg-background px-1 rounded">INTELLO_API_BASE_URL</code></td>
                          <td className="p-2">Intello WMS API base URL (Weather Monitoring System)</td>
                          <td className="p-2">✅ Yes (if using Intello WMS)</td>
                          <td className="p-2">https://portal.intellotechsolutions.co.in:5000</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">SYNC_WINDOW_START</code></td>
                          <td className="p-2">Global restricted sync window start (HH:mm IST) - <strong>Deprecated</strong> (use per-vendor config)</td>
                          <td className="p-2">⚠️ Optional</td>
                          <td className="p-2">20:00</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">SYNC_WINDOW_END</code></td>
                          <td className="p-2">Global restricted sync window end (HH:mm IST) - <strong>Deprecated</strong> (use per-vendor config)</td>
                          <td className="p-2">⚠️ Optional</td>
                          <td className="p-2">05:00</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">CRON_SECRET</code></td>
                          <td className="p-2">Secret token for cron endpoint security (Authorization: Bearer header)</td>
                          <td className="p-2">⚠️ Recommended</td>
                          <td className="p-2">-</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">ENABLE_PLANT_SYNC_CRON</code></td>
                          <td className="p-2">Enable in-process plant sync cron (true/false)</td>
                          <td className="p-2">⚠️ Optional</td>
                          <td className="p-2">true</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">ENABLE_ALERT_SYNC_CRON</code></td>
                          <td className="p-2">Enable in-process alert sync cron (true/false)</td>
                          <td className="p-2">⚠️ Optional</td>
                          <td className="p-2">true</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">ENABLE_LIVE_TELEMETRY_SYNC_CRON</code></td>
                          <td className="p-2">Enable in-process live telemetry sync cron (true/false)</td>
                          <td className="p-2">⚠️ Optional</td>
                          <td className="p-2">true</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">ENABLE_WMS_SITE_SYNC_CRON</code></td>
                          <td className="p-2">Enable in-process WMS site sync cron (true/false)</td>
                          <td className="p-2">⚠️ Optional</td>
                          <td className="p-2">true</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">ENABLE_WMS_INSOLATION_SYNC_CRON</code></td>
                          <td className="p-2">Enable in-process WMS insolation sync cron (true/false)</td>
                          <td className="p-2">⚠️ Optional</td>
                          <td className="p-2">true</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">ENABLE_PER_PLANT_LIVE_TELEMETRY</code></td>
                          <td className="p-2">Enable per-plant live telemetry fetching during plant sync if not in listPlants() (true/false)</td>
                          <td className="p-2">⚠️ Optional</td>
                          <td className="p-2">false</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">NODE_ENV</code></td>
                          <td className="p-2">Node environment (development/production)</td>
                          <td className="p-2">⚠️ Optional</td>
                          <td className="p-2">development</td>
                        </tr>
                        <tr className="border-b">
                          <td className="p-2"><code className="bg-background px-1 rounded">PORT</code></td>
                          <td className="p-2">Server port</td>
                          <td className="p-2">⚠️ Optional</td>
                          <td className="p-2">3000</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Infrastructure & Deployment</h3>
                  
                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    <div>
                      <h4 className="font-medium mb-2">Application Server</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><strong>Framework:</strong> Next.js 14.2.33 (App Router)</li>
                        <li><strong>Runtime:</strong> Node.js 18+</li>
                        <li><strong>Server:</strong> Custom server.js with in-process cron jobs</li>
                        <li><strong>Build:</strong> <code className="bg-background px-1 rounded">NODE_OPTIONS=&apos;--max-old-space-size=4096&apos; next build</code> (4GB heap)</li>
                        <li><strong>Experimental:</strong> Turbo mode enabled for faster builds</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Database Infrastructure</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><strong>Main Database:</strong> Single Supabase PostgreSQL instance (all data stored here)</li>
                        <li><strong>Telemetry Storage:</strong> Live telemetry stored in <code className="bg-background px-1 rounded">plants</code> table; historical telemetry fetched on-demand from vendor APIs (not persisted)</li>
                        <li><strong>Connection Pooling:</strong> HTTP connection reuse via pooledFetch</li>
                        <li><strong>RLS:</strong> Enabled but bypassed via service role key</li>
                        <li><strong>Backups:</strong> Supabase point-in-time recovery (configure in dashboard)</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Edge Functions (Supabase)</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><strong>Runtime:</strong> Deno</li>
                        <li><strong>Functions:</strong>
                          <ul className="ml-4 mt-1 list-disc">
                            <li><code className="bg-background px-1 rounded">vendor-auth</code> - Generic vendor authentication</li>
                            <li><code className="bg-background px-1 rounded">sync-telemetry</code> - Telemetry sync (scheduled)</li>
                            <li><code className="bg-background px-1 rounded">sync-alerts</code> - Alert sync (scheduled)</li>
                          </ul>
                        </li>
                        <li><strong>Deployment:</strong> Supabase CLI (<code className="bg-background px-1 rounded">supabase functions deploy</code>)</li>
                        <li><strong>Scheduling:</strong> Supabase dashboard or external cron (cron-job.org, GitHub Actions)</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Recommended Production Setup</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><strong>Hosting:</strong> Vercel (recommended) or self-hosted (Node.js server)</li>
                        <li><strong>Cron Jobs:</strong> Move to external scheduler (Supabase Edge Functions, Cloud Scheduler, cron-job.org)</li>
                        <li><strong>Monitoring:</strong> Integrate APM (Datadog, New Relic, Sentry)</li>
                        <li><strong>Logging:</strong> Structured logging to external service (Datadog, CloudWatch, etc.)</li>
                        <li><strong>Error Tracking:</strong> Sentry or similar for error aggregation</li>
                        <li><strong>Database:</strong> Enable connection pooling in Supabase dashboard</li>
                        <li><strong>CDN:</strong> Vercel Edge Network or Cloudflare for static assets</li>
                        <li><strong>SSL:</strong> Automatic with Vercel, configure for self-hosted</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Security Considerations</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><strong>Service Role Key:</strong> Never expose to client, only server-side</li>
                        <li><strong>Session Tokens:</strong> Currently base64-encoded (consider encryption)</li>
                        <li><strong>CORS:</strong> Configure allowed origins in production</li>
                        <li><strong>Rate Limiting:</strong> Implement at API gateway level (Vercel Pro, Cloudflare)</li>
                        <li><strong>Secrets Management:</strong> Use environment variables, never commit secrets</li>
                        <li><strong>Database:</strong> Enable Supabase network restrictions (IP allowlist)</li>
                        <li><strong>Backup Encryption:</strong> Ensure Supabase backups are encrypted</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Performance Optimization</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><strong>Connection Pooling:</strong> Already implemented via pooledFetch</li>
                        <li><strong>Batch Operations:</strong> Plant sync uses batches of 100</li>
                        <li><strong>Database Indexes:</strong> Comprehensive indexes on foreign keys and query patterns</li>
                        <li><strong>Build Optimization:</strong> Increased heap size, Turbo mode enabled</li>
                        <li><strong>Code Splitting:</strong> Next.js automatic code splitting</li>
                        <li><strong>Caching:</strong> Consider Redis for API response caching</li>
                        <li><strong>CDN:</strong> Static assets served via CDN (Vercel Edge Network)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Deployment Checklist</h3>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                      <li>✅ All environment variables configured</li>
                      <li>✅ Database migrations applied (001_initial_schema.sql, 002_rls_policies.sql, etc.)</li>
                      <li>✅ RLS policies enabled (though bypassed by service role key)</li>
                      <li>✅ Edge Functions deployed and scheduled</li>
                      <li>✅ Default passwords changed (run migration 004_manual_user_setup.sql or create new accounts)</li>
                      <li>✅ SSL certificates valid</li>
                      <li>✅ Monitoring and error tracking configured</li>
                      <li>✅ Backup strategy in place (Supabase point-in-time recovery)</li>
                      <li>✅ CRON_SECRET set for cron endpoint security</li>
                      <li>✅ Vendor API credentials configured in UI</li>
                      <li>⚠️ Consider moving cron jobs to external scheduler</li>
                      <li>⚠️ Implement structured logging to external service</li>
                      <li>⚠️ Add rate limiting at API gateway level</li>
                    </ul>
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
                    These prompts can be used with Cursor AI to understand and work with the Solar Information System codebase.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Complete System Specification Prompt</h4>
                    <CodeBlock 
                      id="system-prompt"
                      code={`# Solar Information System - Complete System Specification

## System Overview
Build a production-ready **Solar Information System (SIS)** for managing solar power plant operations, information management, alerts, and vendor integrations. The system must handle multiple organizations, vendors (Solarman, Sungrow, etc.), plants, telemetry data, alerts, and comprehensive analytics.

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
- listPlants(): Promise<Plant[]> - Returns all plants from vendor (may include live telemetry)
- listPlant(vendorPlantId): Promise<Plant | null> - Returns single plant by vendor plant ID (for PER_PLANT mode or enrichment)
- getTelemetry(plantId, startTime, endTime): Promise<TelemetryData[]> - Historical telemetry (graphs)
- getAlerts(plantId): Promise<Alert[]> - Alert data (if supported)
- normalizeTelemetry(rawData): TelemetryData
- normalizeAlert(rawData): Alert

## Token Management
- Tokens stored in vendors.access_token
- Token expiration checked via token_expires_at
- 5-minute buffer for token validation
- Automatic refresh on expiry

## Plant Sync Modes
- LIST_PLANTS: Metrics from listPlants() API (efficient, single call)
- PER_PLANT: Metrics from per-plant telemetry APIs (costly, individual calls)

## Live Telemetry Sync Modes
- LIST_PLANTS: Fetches all plants telemetry via listPlants() in single call
- PER_PLANTS: Fetches each plant telemetry via listPlant(vendorPlantId) individually

## listPlant() Usage
- Used in live telemetry sync when telemetry_sync_mode = PER_PLANT
- Used during plant sync to optionally enrich plants if live telemetry missing from listPlants() (ENABLE_PER_PLANT_LIVE_TELEMETRY env var)`}
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
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900 mb-4">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">🔵 Live Telemetry Sync Flow</h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                        <strong>Telemetry Sync Mode:</strong> LIST_PLANTS (default) - All live telemetry is fetched in a single API call via <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">listPlants()</code>
                      </p>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                        <strong>listPlant() Usage:</strong> Used during plant sync to optionally enrich plants if live telemetry is missing from <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">listPlants()</code> response (configurable via <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">ENABLE_PER_PLANT_LIVE_TELEMETRY</code>). 
                        Implementation: Calls PRO API <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">/maintain-s/operating/station/v2/search</code> filtered by stationId, or falls back to base endpoint.
                      </p>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Live Telemetry Fields from listPlants():</strong> generationPower (→ current_power_kw), generationValue (→ daily_energy_kwh), generationMonth (→ monthly_energy_mwh), generationYear (→ yearly_energy_mwh), generationUploadTotalOffset (→ total_energy_mwh), networkStatus (→ network_status)
                      </p>
                    </div>
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
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-900 mb-3">
                          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📋 Attribute Mapping</h5>
                          <p className="text-xs text-blue-800 dark:text-blue-200 mb-2">
                            The following table shows how Solarman PRO API fields are mapped to database columns:
                          </p>
                        </div>
                        <div><strong>Database Mapping:</strong></div>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b bg-muted">
                              <th className="text-left p-2 font-semibold">API Field</th>
                              <th className="text-left p-2 font-semibold">DB Column</th>
                              <th className="text-left p-2 font-semibold">Transformation</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">station.id</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">vendor_plant_id</code></td>
                              <td className="p-2">Convert to string</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">station.name</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">name</code></td>
                              <td className="p-2">Direct mapping</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">station.installedCapacity</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">capacity_kw</code></td>
                              <td className="p-2">Already in kW - direct mapping</td>
                            </tr>
                            <tr className="border-b bg-green-50 dark:bg-green-950/10">
                              <td className="p-2"><code className="bg-muted px-1 rounded">station.generationPower</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">current_power_kw</code></td>
                              <td className="p-2"><strong>W → kW</strong> (divide by 1000) - Live telemetry field</td>
                            </tr>
                            <tr className="border-b bg-green-50 dark:bg-green-950/10">
                              <td className="p-2"><code className="bg-muted px-1 rounded">station.generationValue</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">daily_energy_kwh</code></td>
                              <td className="p-2">Direct (already kWh) - <strong>Live telemetry field</strong></td>
                            </tr>
                            <tr className="border-b bg-green-50 dark:bg-green-950/10">
                              <td className="p-2"><code className="bg-muted px-1 rounded">station.generationMonth</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">monthly_energy_mwh</code></td>
                              <td className="p-2"><strong>kWh → MWh</strong> (divide by 1000) - Live telemetry field</td>
                            </tr>
                            <tr className="border-b bg-green-50 dark:bg-green-950/10">
                              <td className="p-2"><code className="bg-muted px-1 rounded">station.generationYear</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">yearly_energy_mwh</code></td>
                              <td className="p-2"><strong>kWh → MWh</strong> (divide by 1000) - Live telemetry field</td>
                            </tr>
                            <tr className="border-b bg-green-50 dark:bg-green-950/10">
                              <td className="p-2"><code className="bg-muted px-1 rounded">station.generationUploadTotalOffset</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">total_energy_mwh</code></td>
                              <td className="p-2"><strong>kWh → MWh</strong> (divide by 1000) - Live telemetry field</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">station.lastUpdateTime</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">last_update_time</code></td>
                              <td className="p-2"><strong>Unix seconds → ISO string</strong> (Date conversion)</td>
                            </tr>
                            <tr className="border-b bg-green-50 dark:bg-green-950/10">
                              <td className="p-2"><code className="bg-muted px-1 rounded">station.networkStatus</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">network_status</code></td>
                              <td className="p-2">Trim whitespace - <strong>Live telemetry field</strong></td>
                            </tr>
                            <tr>
                              <td className="p-2"><code className="bg-muted px-1 rounded">station.locationLat/Lng/Address</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">location</code> (JSONB)</td>
                              <td className="p-2">Combine into JSONB: <code className="bg-muted px-1 rounded">{"{lat, lng, address}"}</code></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">3. List Single Plant (listPlant)</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">POST {process.env.SOLARMAN_PRO_API_BASE_URL || "https://globalpro.solarmanpv.com"}/maintain-s/operating/station/v2/search</code></div>
                        <div><strong>Purpose:</strong> Fetch a single plant by vendor plant ID. Used for live telemetry enrichment during plant sync or in PER_PLANT telemetry sync mode.</div>
                        <div><strong>Request Body:</strong></div>
                        <CodeBlock 
                          id="solarman-listplant-request"
                          code={`{
  "station": {
    "id": number (stationId),
    "powerTypeList": ["PV"]
  }
}`}
                        />
                        <div><strong>Response Structure:</strong></div>
                        <CodeBlock 
                          id="solarman-listplant-response"
                          code={`{
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
        "networkStatus": string,
        "locationLat": number,
        "locationLng": number,
        "locationAddress": string
      }
    }
  ]
}`}
                        />
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-900 mb-3">
                          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📋 Implementation Details</h5>
                          <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
                            <li>Uses PRO API endpoint with station ID filter in request body</li>
                            <li>Falls back to base endpoint if PRO API fails</li>
                            <li>Returns same structure as listPlants() but filtered to single plant</li>
                            <li>Used during plant sync for optional live telemetry enrichment (ENABLE_PER_PLANT_LIVE_TELEMETRY env var)</li>
                            <li>Used in PER_PLANT telemetry sync mode for live telemetry updates</li>
                          </ul>
                        </div>
                        <div><strong>Database Mapping:</strong> Same as listPlants() - see section 2 above. All fields map identically.</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">4. Daily Telemetry</h4>
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
                      <h4 className="font-semibold mb-2">5. Alerts</h4>
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
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-900 mb-3">
                          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📋 Alert Attribute Mapping</h5>
                          <p className="text-xs text-blue-800 dark:text-blue-200 mb-2">
                            The following table shows how Solarman alert fields are mapped to database columns:
                          </p>
                        </div>
                        <div><strong>Database Mapping:</strong></div>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b bg-muted">
                              <th className="text-left p-2 font-semibold">API Field</th>
                              <th className="text-left p-2 font-semibold">DB Column</th>
                              <th className="text-left p-2 font-semibold">Transformation</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">id</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">vendor_alert_id</code></td>
                              <td className="p-2">Convert to string</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">stationId</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">vendor_plant_id</code></td>
                              <td className="p-2">Convert to string</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">alertName</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">title</code></td>
                              <td className="p-2">Direct mapping</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">level + influence</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">severity</code></td>
                              <td className="p-2"><strong>Severity mapping:</strong> 0→LOW, 1→MEDIUM, 2→HIGH, Safety→CRITICAL</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">endTime</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">status</code></td>
                              <td className="p-2"><strong>Status mapping:</strong> null→ACTIVE, value→RESOLVED</td>
                            </tr>
                            <tr>
                              <td className="p-2"><code className="bg-muted px-1 rounded">endTime - alertTime</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">grid_down_seconds</code></td>
                              <td className="p-2"><strong>Calculation:</strong> Difference in seconds (max with 0)</td>
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
                    <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-900 mb-4">
                      <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">🟣 Live Telemetry Sync Flow</h4>
                      <p className="text-sm text-purple-800 dark:text-purple-200 mb-2">
                        <strong>Telemetry Sync Mode:</strong> PER_PLANT (default) - Live telemetry is fetched individually for each plant via <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">listPlant(vendorPlantId)</code>
                      </p>
                      <p className="text-sm text-purple-800 dark:text-purple-200 mb-2">
                        <strong>listPlant() Implementation:</strong> Calls <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">listPlants()</code> and filters client-side by vendorPlantId. Used by live telemetry sync service in PER_PLANT mode.
                      </p>
                      <p className="text-sm text-purple-800 dark:text-purple-200">
                        <strong>Live Telemetry Fields:</strong> communicateStatus (→ network_status). Other fields (current_power_kw, daily_energy_kwh, etc.) are fetched via per-plant telemetry APIs during live telemetry sync.
                      </p>
                    </div>
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
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-900 mb-3">
                          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📋 Attribute Mapping</h5>
                          <p className="text-xs text-blue-800 dark:text-blue-200 mb-2">
                            The following table shows how SolarDM API fields are mapped to database columns:
                          </p>
                        </div>
                        <div><strong>Database Mapping:</strong></div>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b bg-muted">
                              <th className="text-left p-2 font-semibold">API Field</th>
                              <th className="text-left p-2 font-semibold">DB Column</th>
                              <th className="text-left p-2 font-semibold">Transformation</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">id</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">vendor_plant_id</code></td>
                              <td className="p-2">Direct (string)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">plantName</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">name</code></td>
                              <td className="p-2">Direct mapping</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">capacity</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">capacity_kw</code></td>
                              <td className="p-2"><strong>ParseFloat</strong> (string → number, already in kW)</td>
                            </tr>
                            <tr className="border-b bg-green-50 dark:bg-green-950/10">
                              <td className="p-2"><code className="bg-muted px-1 rounded">communicateStatus</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">network_status</code></td>
                              <td className="p-2"><strong>Status mapping:</strong> 1→NORMAL, 2→ALL_OFFLINE, 3→PARTIAL_OFFLINE - <strong>Live telemetry field</strong></td>
                            </tr>
                            <tr>
                              <td className="p-2"><code className="bg-muted px-1 rounded">createTime</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">vendor_created_date</code></td>
                              <td className="p-2"><strong>Date conversion:</strong> &quot;YYYY-MM-DD HH:mm:ss&quot; → ISO string</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">3. List Single Plant (listPlant)</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoints:</strong> 
                          <ul className="ml-4 mt-1 list-disc">
                            <li><code className="bg-muted px-1 rounded">GET /dms/plant/{`{vendorPlantId}`}</code> - Plant info (name, network status, last update time)</li>
                            <li><code className="bg-muted px-1 rounded">GET /dms/data_panel/metering/sub_v2/{`{vendorPlantId}`}</code> - Live telemetry (power, energy)</li>
                          </ul>
                        </div>
                        <div><strong>Purpose:</strong> Fetch a single plant by vendor plant ID with live telemetry. Used for live telemetry sync in PER_PLANT mode.</div>
                        <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg border border-purple-200 dark:border-purple-900 mb-3">
                          <h5 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">📋 Implementation Details</h5>
                          <ul className="text-xs text-purple-800 dark:text-purple-200 space-y-1 ml-4 list-disc">
                            <li><strong>Plant Info Endpoint:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">GET /dms/plant/{`{vendorPlantId}`}</code>
                              <ul className="ml-4 mt-1 list-disc">
                                <li>Returns: <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">plantName</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">communicateStatus</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">lastUpdateTime</code></li>
                                <li>Maps <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">communicateStatus</code> to <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">networkStatus</code> (1=NORMAL, 2=ALL_OFFLINE, 3=PARTIAL_OFFLINE)</li>
                              </ul>
                            </li>
                            <li><strong>Metering Endpoint:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">GET /dms/data_panel/metering/sub_v2/{`{vendorPlantId}`}</code>
                              <ul className="ml-4 mt-1 list-disc">
                                <li>Returns live telemetry: <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">currDay</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">currMonth</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">currYear</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">total</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">power</code></li>
                                <li>Values are in string format: <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">&quot;12.8_kWh&quot;</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">&quot;0_KW&quot;</code></li>
                                <li>Parsed and converted: kWh → MWh for monthly/yearly/total, W → kW for power</li>
                              </ul>
                            </li>
                            <li><strong>Optimization:</strong> No longer calls <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">listPlants()</code> - makes only 2 direct API calls per plant</li>
                            <li><strong>Used in:</strong> PER_PLANT telemetry sync mode for live telemetry updates</li>
                          </ul>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-900 mb-3">
                          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📊 Response Format</h5>
                          <div className="text-xs text-blue-800 dark:text-blue-200 space-y-2">
                            <div><strong>Plant Info Response:</strong></div>
                            <CodeBlock 
                              id="solardm-listplant-info"
                              code={`{
  "code": 0,
  "data": {
    "id": "1994347708036210689",
    "plantName": "4261,2,46",
    "communicateStatus": 2,
    "alarmStatus": 1,
    "lastUpdateTime": "2025-12-03 17:24:27"
  }
}`}
                            />
                            <div><strong>Metering Response:</strong></div>
                            <CodeBlock 
                              id="solardm-listplant-metering"
                              code={`{
  "code": 0,
  "data": {
    "energy": {
      "currDay": "12.8_kWh",
      "currMonth": "12.8_kWh",
      "currYear": "12.8_kWh",
      "total": "12.8_kWh",
      "power": "0_KW"
    }
  }
}`}
                            />
                          </div>
                        </div>
                        <div><strong>Database Mapping:</strong>
                          <ul className="ml-4 mt-1 list-disc text-xs">
                            <li><code className="bg-muted px-1 rounded">current_power_kw</code> ← <code className="bg-muted px-1 rounded">energy.power</code> (parsed from &quot;0_KW&quot; format, already in kW)</li>
                            <li><code className="bg-muted px-1 rounded">daily_energy_kwh</code> ← <code className="bg-muted px-1 rounded">energy.currDay</code> (parsed from &quot;12.8_kWh&quot; format)</li>
                            <li><code className="bg-muted px-1 rounded">monthly_energy_mwh</code> ← <code className="bg-muted px-1 rounded">energy.currMonth</code> (parsed, converted kWh → MWh)</li>
                            <li><code className="bg-muted px-1 rounded">yearly_energy_mwh</code> ← <code className="bg-muted px-1 rounded">energy.currYear</code> (parsed, converted kWh → MWh)</li>
                            <li><code className="bg-muted px-1 rounded">total_energy_mwh</code> ← <code className="bg-muted px-1 rounded">energy.total</code> (parsed, converted kWh → MWh)</li>
                            <li><code className="bg-muted px-1 rounded">network_status</code> ← <code className="bg-muted px-1 rounded">communicateStatus</code> (1=NORMAL, 2=ALL_OFFLINE, 3=PARTIAL_OFFLINE)</li>
                            <li><code className="bg-muted px-1 rounded">last_update_time</code> ← <code className="bg-muted px-1 rounded">lastUpdateTime</code> (parsed from &quot;YYYY-MM-DD HH:mm:ss&quot; to ISO string)</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">4. Daily Telemetry</h4>
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
                    <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-900 mb-4">
                      <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">🟣 Live Telemetry Sync Flow</h4>
                      <p className="text-sm text-purple-800 dark:text-purple-200 mb-2">
                        <strong>Telemetry Sync Mode:</strong> PER_PLANT (default) - Live telemetry is fetched individually for each plant via <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">listPlant(vendorPlantId)</code>
                      </p>
                      <p className="text-sm text-purple-800 dark:text-purple-200 mb-2">
                        <strong>listPlant() Implementation:</strong> Calls <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">listPlants()</code> and filters client-side by vendorPlantId. Used by live telemetry sync service in PER_PLANT mode.
                      </p>
                      <p className="text-sm text-purple-800 dark:text-purple-200">
                        <strong>Live Telemetry Fields:</strong> isOnline (→ network_status). Other fields are fetched via per-plant telemetry APIs during live telemetry sync.
                      </p>
                    </div>
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
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-900 mb-3">
                          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📋 Attribute Mapping</h5>
                          <p className="text-xs text-blue-800 dark:text-blue-200 mb-2">
                            The following table shows how PVBlink API fields are mapped to database columns:
                          </p>
                        </div>
                        <div><strong>Database Mapping:</strong></div>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b bg-muted">
                              <th className="text-left p-2 font-semibold">API Field</th>
                              <th className="text-left p-2 font-semibold">DB Column</th>
                              <th className="text-left p-2 font-semibold">Transformation</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">id</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">vendor_plant_id</code></td>
                              <td className="p-2">Direct (string)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">name</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">name</code></td>
                              <td className="p-2">Direct mapping</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">capacity</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">capacity_kw</code></td>
                              <td className="p-2">Direct (already in kW)</td>
                            </tr>
                            <tr className="border-b bg-green-50 dark:bg-green-950/10">
                              <td className="p-2"><code className="bg-muted px-1 rounded">isOnline</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">network_status</code></td>
                              <td className="p-2"><strong>Boolean mapping:</strong> true→ONLINE, false→ALL_OFFLINE - <strong>Live telemetry field</strong></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">3. List Single Plant (listPlant)</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Implementation:</strong> Client-side filtering from <code className="bg-muted px-1 rounded">listPlants()</code></div>
                        <div><strong>Purpose:</strong> Fetch a single plant by vendor plant ID. Used for live telemetry enrichment during plant sync or in PER_PLANT telemetry sync mode.</div>
                        <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg border border-purple-200 dark:border-purple-900 mb-3">
                          <h5 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">📋 Implementation Details</h5>
                          <ul className="text-xs text-purple-800 dark:text-purple-200 space-y-1 ml-4 list-disc">
                            <li>Calls <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">GET /api/pvblink/plant/s/all</code> (same as listPlants(), paginated)</li>
                            <li>Filters the response client-side by matching <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">vendorPlantId</code></li>
                            <li>Returns the matching plant or null if not found</li>
                            <li><strong>Note:</strong> PVBlink&apos;s listPlants() doesn&apos;t provide live telemetry fields (current_power_kw, daily_energy_kwh, etc.)</li>
                            <li>Live telemetry must be fetched separately via telemetry APIs during live telemetry sync</li>
                            <li>Used in PER_PLANT telemetry sync mode for live telemetry updates</li>
                          </ul>
                        </div>
                        <div><strong>Database Mapping:</strong> Same as listPlants() - see section 2 above. Only provides basic plant info (id, name, capacity, network_status).</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">4. Daily Telemetry</h4>
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

                {/* ShineMonitor Section */}
                <div id="vendor-shinemonitor" className="space-y-4 mt-8">
                  <VendorSectionHeader vendorId="vendor-shinemonitor" vendorName="ShineMonitor" icon={Factory} />
                  
                  {expandedSections.has("vendor-shinemonitor") && (
                  <div className="bg-muted/50 p-4 rounded-lg space-y-4 border-t">
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900 mb-4">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">🔵 Live Telemetry Sync Flow</h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                        <strong>Telemetry Sync Mode:</strong> LIST_PLANTS (default) - All live telemetry is fetched in a single API call via <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">listPlants()</code>
                      </p>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                        <strong>listPlant() Implementation:</strong> Calls <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">listPlants()</code> and filters client-side by vendorPlantId. Used during plant sync for optional enrichment.
                      </p>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Live Telemetry Fields from listPlants():</strong> outputPower (→ current_power_kw), energy (→ daily_energy_kwh), energyMonth (→ monthly_energy_mwh), energyYear (→ yearly_energy_mwh), energyTotal (→ total_energy_mwh), status (→ network_status)
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">1. Authentication</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">GET {process.env.SHINEMONITOR_API_BASE_URL || "https://web.shinemonitor.com/public"}/?sign={`{sign}`}&salt={`{salt}`}&action=auth&usr={`{user_name}`}&company-key={`{company_key}`}</code></div>
                        <div><strong>Authentication Method:</strong> SHA1-based sign/salt mechanism</div>
                        <div><strong>Sign Generation:</strong></div>
                        <CodeBlock 
                          id="shinemonitor-auth-sign"
                          code={`salt = current timestamp (milliseconds)
pass_hash = SHA1(password)
action_string = "&action=auth&usr={user_name}&company-key={company_key}"
sign = SHA1(salt + pass_hash + action_string)`}
                        />
                        <div><strong>Request Headers:</strong></div>
                        <CodeBlock 
                          id="shinemonitor-auth-headers"
                          code={`Accept: application/json
Origin: https://kstar.shinemonitor.com
Referer: https://kstar.shinemonitor.com/`}
                        />
                        <div><strong>Response:</strong></div>
                        <CodeBlock 
                          id="shinemonitor-auth-response"
                          code={`{
  "err": 0,
  "desc": "success",
  "dat": {
    "token": "string",
    "secret": "string",
    "expire": number (seconds),
    "role": number,
    "usr": string,
    "uid": number
  }
}`}
                        />
                        <div><strong>Token Storage:</strong> Stored in <code className="bg-muted px-1 rounded">vendors.access_token</code>, <code className="bg-muted px-1 rounded">vendors.token_expires_at</code>, <code className="bg-muted px-1 rounded">vendors.token_metadata.secret</code></div>
                        <div><strong>Note:</strong> Both <code className="bg-muted px-1 rounded">token</code> and <code className="bg-muted px-1 rounded">secret</code> are required for all subsequent API calls</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">2. List Plants</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">GET {process.env.SHINEMONITOR_API_BASE_URL || "https://web.shinemonitor.com/public"}/?sign={`{sign}`}&salt={`{salt}`}&token={`{token}`}&action=webQueryPlants&orderBy=ascPlantId&page={`{page}`}&pagesize={`{pagesize}`}</code></div>
                        <div><strong>Pagination:</strong> Iterates through pages (page size: 100) until all plants are fetched</div>
                        <div><strong>Sign Generation for API Calls:</strong></div>
                        <CodeBlock 
                          id="shinemonitor-api-sign"
                          code={`1. Remove sign, salt, token from query string
2. Get remaining query string from &action onwards
3. sign = SHA1(salt + secret + token + finalQueryString)
Example: &action=webQueryPlants&orderBy=ascPlantId&page=0&pagesize=100`}
                        />
                        <div><strong>Response Structure:</strong></div>
                        <CodeBlock 
                          id="shinemonitor-listplants-response"
                          code={`{
  "err": 0,
  "desc": "success",
  "dat": {
    "total": number,
    "page": number,
    "pagesize": number,
    "plant": [
      {
        "pid": number,
        "uid": number,
        "usr": string,
        "name": string,
        "type": number,
        "status": number (0=NORMAL, 1=ALL_OFFLINE, others=PARTIAL_OFFLINE),
        "address": {
          "lon": string,
          "lat": string,
          "address": string (optional),
          "timezone": number
        },
        "nominalPower": string (kW, e.g., "3.0000"),
        "install": string ("YYYY-MM-DD HH:mm:ss"),
        "gts": string ("YYYY-MM-DD HH:mm:ss"),
        "outputPower": string (kW, e.g., "0.7574"),
        "energy": string (kWh daily, e.g., "2.5000"),
        "energyMonth": string (kWh monthly, e.g., "131.6000"),
        "energyYear": string (kWh yearly, e.g., "2034.7000"),
        "energyTotal": string (kWh total, e.g., "2034.7000"),
        "energyDatDate": string ("YYYY-MM-DD HH:mm:ss")
      }
    ]
  }
}`}
                        />
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-900 mb-3">
                          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📋 Attribute Mapping</h5>
                          <p className="text-xs text-blue-800 dark:text-blue-200 mb-2">
                            The following table shows how ShineMonitor API fields are mapped to database columns:
                          </p>
                        </div>
                        <div><strong>Database Mapping:</strong></div>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b bg-muted">
                              <th className="text-left p-2 font-semibold">API Field</th>
                              <th className="text-left p-2 font-semibold">DB Column</th>
                              <th className="text-left p-2 font-semibold">Transformation</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">pid</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">vendor_plant_id</code></td>
                              <td className="p-2">Convert to string</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">name</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">name</code></td>
                              <td className="p-2">Direct mapping</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">nominalPower</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">capacity_kw</code></td>
                              <td className="p-2"><strong>ParseFloat</strong> (string → number, already in kW)</td>
                            </tr>
                            <tr className="border-b bg-green-50 dark:bg-green-950/10">
                              <td className="p-2"><code className="bg-muted px-1 rounded">outputPower</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">current_power_kw</code></td>
                              <td className="p-2"><strong>ParseFloat</strong> (already in kW) - <strong>Live telemetry field</strong></td>
                            </tr>
                            <tr className="border-b bg-green-50 dark:bg-green-950/10">
                              <td className="p-2"><code className="bg-muted px-1 rounded">energy</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">daily_energy_kwh</code></td>
                              <td className="p-2"><strong>ParseFloat</strong> (already in kWh) - <strong>Live telemetry field</strong></td>
                            </tr>
                            <tr className="border-b bg-green-50 dark:bg-green-950/10">
                              <td className="p-2"><code className="bg-muted px-1 rounded">energyMonth</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">monthly_energy_mwh</code></td>
                              <td className="p-2"><strong>ParseFloat → divide by 1000</strong> (kWh → MWh) - <strong>Live telemetry field</strong></td>
                            </tr>
                            <tr className="border-b bg-green-50 dark:bg-green-950/10">
                              <td className="p-2"><code className="bg-muted px-1 rounded">energyYear</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">yearly_energy_mwh</code></td>
                              <td className="p-2"><strong>ParseFloat → divide by 1000</strong> (kWh → MWh) - <strong>Live telemetry field</strong></td>
                            </tr>
                            <tr className="border-b bg-green-50 dark:bg-green-950/10">
                              <td className="p-2"><code className="bg-muted px-1 rounded">energyTotal</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">total_energy_mwh</code></td>
                              <td className="p-2"><strong>ParseFloat → divide by 1000</strong> (kWh → MWh) - <strong>Live telemetry field</strong></td>
                            </tr>
                            <tr className="border-b bg-green-50 dark:bg-green-950/10">
                              <td className="p-2"><code className="bg-muted px-1 rounded">status</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">network_status</code></td>
                              <td className="p-2"><strong>Status mapping:</strong> 0→NORMAL, 1→ALL_OFFLINE, others→PARTIAL_OFFLINE - <strong>Live telemetry field</strong></td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">install</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">vendor_created_date</code></td>
                              <td className="p-2"><strong>Date conversion:</strong> &quot;YYYY-MM-DD HH:mm:ss&quot; → ISO string</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">gts</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">start_operating_time</code></td>
                              <td className="p-2"><strong>Date conversion:</strong> &quot;YYYY-MM-DD HH:mm:ss&quot; → ISO string</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">energyDatDate</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">last_update_time</code></td>
                              <td className="p-2"><strong>Date conversion:</strong> &quot;YYYY-MM-DD HH:mm:ss&quot; → ISO string</td>
                            </tr>
                            <tr>
                              <td className="p-2"><code className="bg-muted px-1 rounded">address.lat/lon/address</code></td>
                              <td className="p-2"><code className="bg-muted px-1 rounded">location</code> (JSONB)</td>
                              <td className="p-2">Combine into JSONB: <code className="bg-muted px-1 rounded">{"{lat, lng, address}"}</code></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">3. List Single Plant (listPlant)</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Implementation:</strong> Client-side filtering from <code className="bg-muted px-1 rounded">listPlants()</code></div>
                        <div><strong>Purpose:</strong> Fetch a single plant by vendor plant ID. Used for live telemetry enrichment during plant sync or in PER_PLANT telemetry sync mode.</div>
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-900 mb-3">
                          <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📋 Implementation Details</h5>
                          <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
                            <li>Calls <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">GET /?action=webQueryPlants</code> (same as listPlants(), paginated)</li>
                            <li>Filters the response client-side by matching <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">vendorPlantId</code> (pid field)</li>
                            <li>Returns the matching plant or null if not found</li>
                            <li><strong>Note:</strong> ShineMonitor&apos;s listPlants() already provides live telemetry fields in metadata (outputPower, energy, energyMonth, energyYear, energyTotal, status)</li>
                            <li>Live telemetry is available directly from listPlants() response, so listPlant() is primarily used for optional enrichment during plant sync</li>
                            <li>Used during plant sync for optional live telemetry enrichment (ENABLE_PER_PLANT_LIVE_TELEMETRY env var)</li>
                          </ul>
                        </div>
                        <div><strong>Database Mapping:</strong> Same as listPlants() - see section 2 above. All live telemetry fields are available (current_power_kw, daily_energy_kwh, monthly_energy_mwh, yearly_energy_mwh, total_energy_mwh, network_status).</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">4. Daily Telemetry</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">GET {process.env.SHINEMONITOR_API_BASE_URL || "https://web.shinemonitor.com/public"}/?sign={`{sign}`}&salt={`{salt}`}&token={`{token}`}&action=queryPlantActiveOuputPowerOneDay&plantid={`{vendorPlantId}`}&date=YYYY-MM-DD</code></div>
                        <div><strong>Response:</strong></div>
                        <CodeBlock 
                          id="shinemonitor-daily-telemetry"
                          code={`{
  "err": 0,
  "desc": "success",
  "dat": {
    "outputPower": [
      {
        "val": string (kW, e.g., "0.0000", "1.7508"),
        "ts": string ("YYYY-MM-DD HH:mm:ss")
      }
    ],
    "activePowerSwitch": boolean
  }
}`}
                        />
                        <div><strong>Note:</strong> ShineMonitor provides 5-minute intervals (vs Solarman&apos;s 15-minute)</div>
                        <div><strong>Transformation:</strong> Power values are in kW, converted to W for consistency with Solarman format (API route converts back to kW)</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">4. Monthly Telemetry</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">GET {process.env.SHINEMONITOR_API_BASE_URL || "https://web.shinemonitor.com/public"}/?sign={`{sign}`}&salt={`{salt}`}&token={`{token}`}&action=queryPlantEnergyMonthPerDay&plantid={`{vendorPlantId}`}&date=YYYY-MM</code></div>
                        <div><strong>Response:</strong></div>
                        <CodeBlock 
                          id="shinemonitor-monthly-telemetry"
                          code={`{
  "err": 0,
  "desc": "success",
  "dat": {
    "perday": [
      {
        "val": string (kWh daily, e.g., "8.4000", "9.8000"),
        "ts": string ("YYYY-MM-DD HH:mm:ss")
      }
    ],
    "energyTotal": number (kWh monthly total)
  }
}`}
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">5. Yearly Telemetry</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">GET {process.env.SHINEMONITOR_API_BASE_URL || "https://web.shinemonitor.com/public"}/?sign={`{sign}`}&salt={`{salt}`}&token={`{token}`}&action=queryPlantEnergyYearPerMonth&plantid={`{vendorPlantId}`}&date=YYYY</code></div>
                        <div><strong>Response:</strong></div>
                        <CodeBlock 
                          id="shinemonitor-yearly-telemetry"
                          code={`{
  "err": 0,
  "desc": "success",
  "dat": {
    "permonth": [
      {
        "val": string (kWh monthly, e.g., "248.4000", "284.2000"),
        "ts": string ("YYYY-MM-DD HH:mm:ss")
      }
    ]
  }
}`}
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">6. Total Telemetry</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">GET {process.env.SHINEMONITOR_API_BASE_URL || "https://web.shinemonitor.com/public"}/?sign={`{sign}`}&salt={`{salt}`}&token={`{token}`}&action=queryPlantEnergyTotalPerYear&plantid={`{vendorPlantId}`}</code></div>
                        <div><strong>Note:</strong> API doesn&apos;t support year range filtering, so results are filtered client-side</div>
                        <div><strong>Response:</strong></div>
                        <CodeBlock 
                          id="shinemonitor-total-telemetry"
                          code={`{
  "err": 0,
  "desc": "success",
  "dat": {
    "peryear": [
      {
        "val": string (kWh yearly, e.g., "967.3000"),
        "ts": string ("YYYY-MM-DD HH:mm:ss")
      }
    ]
  }
}`}
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">7. Alerts & Realtime</h4>
                      <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded border border-yellow-200 dark:border-yellow-900">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          <strong>⚠️ Not Yet Implemented:</strong> Alerts and realtime data endpoints are not yet implemented for ShineMonitor.
                        </p>
                      </div>
                    </div>
                  </div>
                  )}
                </div>

                {/* Foxesscloud Section */}
                <div id="vendor-foxesscloud" className="space-y-4 mt-8">
                  <VendorSectionHeader vendorId="vendor-foxesscloud" vendorName="Foxesscloud" icon={Factory} />
                  
                  {expandedSections.has("vendor-foxesscloud") && (
                  <div className="bg-muted/50 p-4 rounded-lg space-y-4 border-t">
                    <div>
                      <h4 className="font-semibold mb-2">1. Authentication</h4>
                      <div className="bg-background p-3 rounded text-sm space-y-2">
                        <div><strong>Endpoint:</strong> <code className="bg-muted px-1 rounded">POST {process.env.FOXESSCLOUD_API_BASE_URL || "https://www.foxesscloud.com"}/c/v0/user/login</code></div>
                        <div><strong>Request Body:</strong></div>
                        <CodeBlock 
                          id="foxesscloud-auth-request"
                          code={`{
  "user": "string (username)",
  "password": "string (MD5 hashed password)"
}`}
                        />
                        <div><strong>Request Headers:</strong></div>
                        <CodeBlock 
                          id="foxesscloud-auth-headers"
                          code={`Accept: application/json, text/plain, */*
Accept-Language: en-GB,en-US;q=0.9,en;q=0.8
Content-Type: application/json;charset=UTF-8
contenttype: application/json
lang: en
Origin: {baseUrl}
Referer: {baseUrl}/login
timezone: Asia/Calcutta
timestamp: {current_timestamp_ms}
User-Agent: Mozilla/5.0...`}
                        />
                        <div><strong>Response:</strong></div>
                        <CodeBlock 
                          id="foxesscloud-auth-response"
                          code={`{
  "errno": 0,
  "result": {
    "token": "string",
    "access": number,
    "user": string,
    "weakFlag": boolean
  }
}`}
                        />
                        <div><strong>Token Storage:</strong> Stored in <code className="bg-muted px-1 rounded">vendors.access_token</code>, <code className="bg-muted px-1 rounded">vendors.token_expires_at</code></div>
                        <div><strong>Token Expiration:</strong> Default 23 hours 30 minutes (84600 seconds)</div>
                        <div><strong>Retry Logic:</strong> Implements automatic retry (max 3 attempts) with exponential backoff on authentication failures</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">2. List Plants</h4>
                      <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded border border-yellow-200 dark:border-yellow-900">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          <strong>⚠️ Not Yet Implemented:</strong> Plant listing endpoint is not yet implemented for Foxesscloud.
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">3. Telemetry</h4>
                      <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded border border-yellow-200 dark:border-yellow-900">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          <strong>⚠️ Not Yet Implemented:</strong> Telemetry endpoints (daily, monthly, yearly, total) are not yet implemented for Foxesscloud.
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">5. Alerts & Realtime</h4>
                      <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded border border-yellow-200 dark:border-yellow-900">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          <strong>⚠️ Not Yet Implemented:</strong> Alerts and realtime data endpoints are not yet implemented for Foxesscloud.
                        </p>
                      </div>
                    </div>
                  </div>
                  )}
                </div>

                {/* Vendor Onboarding Guide */}
                <div id="vendor-onboarding" className="space-y-4 mt-12">
                  <div className="flex items-center justify-between p-4 border-b-2 border-primary">
                    <div className="flex items-center gap-3">
                      <Users className="h-6 w-6 text-primary" />
                      <h2 className="text-2xl font-bold">Vendor Onboarding Guide</h2>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSection("vendor-onboarding")}
                    >
                      {expandedSections.has("vendor-onboarding") ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                  
                  {expandedSections.has("vendor-onboarding") && (
                  <div className="bg-muted/50 p-6 rounded-lg space-y-6 border-t">
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📋 Overview</h3>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        This guide outlines the requirements and process for onboarding a new vendor integration into Solar Information System. 
                        Each vendor must implement a standardized adapter interface that provides authentication, plant listing, telemetry, and alerts.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">1. BaseVendorAdapter Interface</h4>
                      <div className="bg-background p-4 rounded text-sm space-y-3">
                        <p className="text-muted-foreground">
                          All vendor adapters must extend <code className="bg-muted px-1 rounded">BaseVendorAdapter</code> and implement the following abstract methods:
                        </p>
                        <CodeBlock 
                          id="base-adapter-interface"
                          code={`abstract class BaseVendorAdapter {
  // Required Methods
  abstract authenticate(): Promise<string>
  abstract listPlants(): Promise<Plant[]>
  abstract getTelemetry(plantId: string, startTime: Date, endTime: Date): Promise<TelemetryData[]>
  abstract getRealtime(plantId: string): Promise<RealtimeData>
  abstract getAlerts(plantId: string): Promise<Alert[]>
  
  // Optional Methods (with default implementation)
  async listPlant(vendorPlantId: string): Promise<Plant | null> {
    // Override if vendor supports per-plant fetching
    throw new Error(\`listPlant() not implemented for vendor type: \${this.config.vendorType}\`)
  }
  
  // Protected Normalization Methods
  protected abstract normalizeTelemetry(rawData: any): TelemetryData
  protected abstract normalizeAlert(rawData: any): Alert
}`}
                        />
                        <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded border border-yellow-200 dark:border-yellow-900">
                          <p className="text-xs text-yellow-800 dark:text-yellow-200">
                            <strong>⚠️ Important:</strong> <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">listPlant()</code> is optional but recommended. 
                            It&apos;s used for live telemetry sync in PER_PLANT mode and for enriching plants during plant sync if live telemetry is missing from <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">listPlants()</code>.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">2. Vendor Configuration Requirements</h4>
                      <div className="bg-background p-4 rounded text-sm space-y-3">
                        <h5 className="font-medium">Database Configuration</h5>
                        <p className="text-muted-foreground">
                          When creating a vendor in the database, the following fields are required:
                        </p>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b bg-muted">
                              <th className="text-left p-2 font-semibold">Field</th>
                              <th className="text-left p-2 font-semibold">Type</th>
                              <th className="text-left p-2 font-semibold">Required</th>
                              <th className="text-left p-2 font-semibold">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">name</code></td>
                              <td className="p-2">TEXT</td>
                              <td className="p-2">✅ Yes</td>
                              <td className="p-2">Vendor display name (e.g., &quot;Solarman Production&quot;)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">vendor_type</code></td>
                              <td className="p-2">ENUM</td>
                              <td className="p-2">✅ Yes</td>
                              <td className="p-2">One of: SOLARMAN, SOLARDM, SHINEMONITOR, PVBLINK, FOXESSCLOUD, OTHER</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">credentials</code></td>
                              <td className="p-2">JSONB</td>
                              <td className="p-2">✅ Yes</td>
                              <td className="p-2">Vendor-specific authentication credentials</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-muted px-1 rounded">org_id</code></td>
                              <td className="p-2">INTEGER</td>
                              <td className="p-2">Optional</td>
                              <td className="p-2">Organization ID (NULL for global/shared vendors)</td>
                            </tr>
                            <tr>
                              <td className="p-2"><code className="bg-muted px-1 rounded">is_active</code></td>
                              <td className="p-2">BOOLEAN</td>
                              <td className="p-2">Optional</td>
                              <td className="p-2">Active status (default: true)</td>
                            </tr>
                          </tbody>
                        </table>
                        <h5 className="font-medium mt-4">Environment Variables</h5>
                        <p className="text-muted-foreground">
                          API base URLs are stored in environment variables, not in the database:
                        </p>
                        <CodeBlock 
                          id="env-vars-example"
                          code={`# Pattern: {VENDOR_TYPE}_API_BASE_URL
SOLARMAN_API_BASE_URL=https://globalapi.solarmanpv.com
SOLARMAN_PRO_API_BASE_URL=https://globalpro.solarmanpv.com
SOLARDM_API_BASE_URL=http://global.solar-dm.com:8010
SHINEMONITOR_API_BASE_URL=https://web.shinemonitor.com/public
PVBLINK_API_BASE_URL=https://cloud.pvblink.com
FOXESSCLOUD_API_BASE_URL=https://www.foxesscloud.com`}
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">3. Data Mapping Requirements</h4>
                      <div className="bg-background p-4 rounded text-sm space-y-3">
                        <h5 className="font-medium">Unit Conversions</h5>
                        <p className="text-muted-foreground">
                          The system expects data in specific units. Your adapter must convert vendor data to these units:
                        </p>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b bg-muted">
                              <th className="text-left p-2 font-semibold">Metric</th>
                              <th className="text-left p-2 font-semibold">Required Unit</th>
                              <th className="text-left p-2 font-semibold">Conversion Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2">Capacity</td>
                              <td className="p-2">kW</td>
                              <td className="p-2">If vendor provides in W, divide by 1000</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2">Current Power</td>
                              <td className="p-2">kW</td>
                              <td className="p-2">If vendor provides in W, divide by 1000</td>
                            </tr>
                            <tr className="border-b bg-green-50 dark:bg-green-950/10">
                              <td className="p-2"><strong>Daily Energy</strong></td>
                              <td className="p-2"><strong>kWh</strong></td>
                              <td className="p-2"><strong>Store in kWh (not MWh) to avoid rounding errors</strong></td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2">Monthly Energy</td>
                              <td className="p-2">MWh</td>
                              <td className="p-2">If vendor provides in kWh, divide by 1000</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2">Yearly Energy</td>
                              <td className="p-2">MWh</td>
                              <td className="p-2">If vendor provides in kWh, divide by 1000</td>
                            </tr>
                            <tr>
                              <td className="p-2">Total Energy</td>
                              <td className="p-2">MWh</td>
                              <td className="p-2">If vendor provides in kWh, divide by 1000</td>
                            </tr>
                          </tbody>
                        </table>
                        <h5 className="font-medium mt-4">Timestamp Handling</h5>
                        <ul className="text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Vendor timestamps may be Unix timestamps (seconds or milliseconds) or ISO strings</li>
                          <li>Always convert to ISO 8601 format (<code className="bg-muted px-1 rounded">YYYY-MM-DDTHH:mm:ss.sssZ</code>)</li>
                          <li>Store in UTC, convert from vendor timezone if needed</li>
                        </ul>
                        <CodeBlock 
                          id="timestamp-conversion"
                          code={`// Unix timestamp (seconds) → ISO string
const lastUpdateTime = station.lastUpdateTime 
  ? new Date(station.lastUpdateTime * 1000).toISOString() 
  : null

// Unix timestamp (milliseconds) → ISO string
const lastUpdateTime = station.lastUpdateTime 
  ? new Date(station.lastUpdateTime).toISOString() 
  : null`}
                        />
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">4. Implementation Checklist</h4>
                      <div className="bg-background p-4 rounded text-sm space-y-3">
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <div>
                              <strong>Phase 1: Setup</strong>
                              <ul className="ml-4 mt-1 space-y-1 list-disc text-muted-foreground">
                                <li>Create vendor adapter class extending <code className="bg-muted px-1 rounded">BaseVendorAdapter</code></li>
                                <li>Register adapter in <code className="bg-muted px-1 rounded">lib/vendors/vendorManager.ts</code></li>
                                <li>Add vendor type to <code className="bg-muted px-1 rounded">vendor_type</code> ENUM in database</li>
                                <li>Set up environment variables for API base URL</li>
                              </ul>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <div>
                              <strong>Phase 2: Authentication</strong>
                              <ul className="ml-4 mt-1 space-y-1 list-disc text-muted-foreground">
                                <li>Implement <code className="bg-muted px-1 rounded">authenticate()</code> method</li>
                                <li>Handle token caching (check expiration before re-auth)</li>
                                <li>Implement <code className="bg-muted px-1 rounded">setTokenStorage()</code> for token persistence</li>
                                <li>Handle authentication errors gracefully</li>
                              </ul>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <div>
                              <strong>Phase 3: Plant Listing</strong>
                              <ul className="ml-4 mt-1 space-y-1 list-disc text-muted-foreground">
                                <li>Implement <code className="bg-muted px-1 rounded">listPlants()</code> method</li>
                                <li>Map vendor plant ID to <code className="bg-muted px-1 rounded">vendor_plant_id</code> (as string)</li>
                                <li>Extract and normalize plant name, capacity, location</li>
                                <li>Extract live telemetry fields (current_power_kw, daily_energy_kwh, etc.)</li>
                                <li>Handle pagination if vendor API supports it</li>
                              </ul>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <div>
                              <strong>Phase 4: Optional - listPlant()</strong>
                              <ul className="ml-4 mt-1 space-y-1 list-disc text-muted-foreground">
                                <li>Implement <code className="bg-muted px-1 rounded">listPlant(vendorPlantId)</code> if vendor supports per-plant fetching</li>
                                <li>Used for live telemetry sync in PER_PLANT mode</li>
                                <li>Used for enriching plants during plant sync if live telemetry missing from listPlants()</li>
                              </ul>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <div>
                              <strong>Phase 5: Telemetry & Alerts</strong>
                              <ul className="ml-4 mt-1 space-y-1 list-disc text-muted-foreground">
                                <li>Implement <code className="bg-muted px-1 rounded">getTelemetry()</code> for historical data (graphs)</li>
                                <li>Implement <code className="bg-muted px-1 rounded">getAlerts()</code> if vendor supports alerts</li>
                                <li>Implement <code className="bg-muted px-1 rounded">normalizeTelemetry()</code> and <code className="bg-muted px-1 rounded">normalizeAlert()</code></li>
                                <li>Map vendor severity levels to standard enum (LOW, MEDIUM, HIGH, CRITICAL)</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">5. Common Pitfalls</h4>
                      <div className="bg-background p-4 rounded text-sm space-y-3">
                        <div className="space-y-2">
                          <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded border border-red-200 dark:border-red-900">
                            <strong className="text-red-900 dark:text-red-100">Unit Conversion Errors</strong>
                            <p className="text-xs text-red-800 dark:text-red-200 mt-1">
                              <strong>Problem:</strong> Storing daily energy in MWh instead of kWh<br/>
                              <strong>Solution:</strong> Always store <code className="bg-red-100 dark:bg-red-900 px-1 rounded">daily_energy_kwh</code> in kWh (not MWh)
                            </p>
                          </div>
                          <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded border border-orange-200 dark:border-orange-900">
                            <strong className="text-orange-900 dark:text-orange-100">Timestamp Handling</strong>
                            <p className="text-xs text-orange-800 dark:text-orange-200 mt-1">
                              <strong>Problem:</strong> Storing Unix timestamps as-is<br/>
                              <strong>Solution:</strong> Always convert to ISO 8601 format using <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">new Date(timestamp).toISOString()</code>
                            </p>
                          </div>
                          <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded border border-yellow-200 dark:border-yellow-900">
                            <strong className="text-yellow-900 dark:text-yellow-100">Data Normalization</strong>
                            <p className="text-xs text-yellow-800 dark:text-yellow-200 mt-1">
                              <strong>Problem:</strong> Not trimming whitespace from status fields<br/>
                              <strong>Solution:</strong> Always <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">.trim()</code> string values from vendor API
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">📚 Additional Resources</h4>
                      <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
                        <li>Reference implementations: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">lib/vendors/solarmanAdapter.ts</code>, <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">lib/vendors/solarDmAdapter.ts</code></li>
                        <li>Base adapter: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">lib/vendors/baseVendorAdapter.ts</code></li>
                        <li>Type definitions: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">lib/vendors/types.ts</code></li>
                        <li>Vendor manager: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">lib/vendors/vendorManager.ts</code></li>
                        <li>Full documentation: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">docs/VENDOR_ONBOARDING.md</code></li>
                      </ul>
                    </div>
                  </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Backlog Tab - Production Improvements */}
        <TabsContent value="backlog" className="space-y-6">
          {/* Excel Import/Export Features */}
          <Card className="overflow-hidden">
            <SectionHeader id="excel-features" title="Excel Import/Export Features" icon={FileText} />
            {expandedSections.has("excel-features") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Overview</h3>
                  <p className="text-sm text-muted-foreground">
                    SUPERADMIN and DEVELOPER accounts can export and import data via Excel files for bulk operations and disaster recovery.
                    All Excel operations use <code className="bg-background px-1 rounded">exceljs</code> library for file generation and parsing.
                  </p>

                  {/* Work Orders Excel */}
                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    <h4 className="font-semibold">Work Orders Excel Import/Export</h4>
                    <p className="text-sm text-muted-foreground">
                      <strong>Endpoints:</strong>
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                      <li><code className="bg-background px-1 rounded">GET /api/workorders/export</code> - Export work orders to Excel</li>
                      <li><code className="bg-background px-1 rounded">POST /api/workorders/import</code> - Import work orders from Excel</li>
                    </ul>
                    <p className="text-sm text-muted-foreground">
                      <strong>Export Columns:</strong> Work Order ID, Title, Description, Location, Organization ID/Name, Vendor Plant ID, Plant Name, Vendor ID/Name/Type, Capacity (kW), Created At, Updated At
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Import Requirements:</strong> Title, Organization ID, Vendor Plant ID, Vendor Type (mandatory). Plant Name is optional (not used for matching).
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>UI Location:</strong> Work Orders page - Export Excel and Import Excel buttons (SUPERADMIN/DEVELOPER only)
                    </p>
                  </div>

                  {/* Vendors Excel */}
                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    <h4 className="font-semibold">Vendors Excel Import/Export</h4>
                    <p className="text-sm text-muted-foreground">
                      <strong>Endpoints:</strong>
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                      <li><code className="bg-background px-1 rounded">GET /api/vendors/export</code> - Export vendors to Excel</li>
                      <li><code className="bg-background px-1 rounded">POST /api/vendors/import</code> - Import vendors from Excel</li>
                    </ul>
                    <p className="text-sm text-muted-foreground">
                      <strong>Export Columns:</strong> Vendor ID, Name, Vendor Type, Organization ID/Name, Is Active, Credentials (JSON), Plant Sync Mode, Per Plant Sync Interval, Plant List Sync Morning/Evening (IST), Telemetry Sync Mode, Telemetry Sync Interval
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Import Requirements:</strong> Name, Vendor Type, Organization ID, Credentials (JSON) (mandatory). Other fields are optional with defaults.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Validation:</strong> Organization must exist, vendor name + org_id combination must be unique, credentials must be valid JSON
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>UI Location:</strong> Vendors page - Export Excel and Import Excel buttons (SUPERADMIN/DEVELOPER only)
                    </p>
                    <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900">
                      <p className="text-xs text-yellow-800 dark:text-yellow-200">
                        <strong>⚠️ Important:</strong> Import only creates new vendors - does not update existing ones. Credentials must be valid JSON format.
                      </p>
                    </div>
                  </div>

                  {/* Accounts Excel */}
                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    <h4 className="font-semibold">Accounts Excel Import/Export</h4>
                    <p className="text-sm text-muted-foreground">
                      <strong>Endpoints:</strong>
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                      <li><code className="bg-background px-1 rounded">GET /api/accounts/export</code> - Export accounts to Excel (filtered by orgId if provided)</li>
                      <li><code className="bg-background px-1 rounded">POST /api/accounts/import</code> - Import accounts from Excel</li>
                    </ul>
                    <p className="text-sm text-muted-foreground">
                      <strong>Export Columns:</strong> Account ID, Email, Password (empty - not exported for security), Account Type, Organization ID/Name, Display Name, Logo URL, Is Active, Created At
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Import Requirements:</strong> Email, Password, Account Type (mandatory). For ORG accounts, Organization ID is required. For SUPERADMIN/GOVT, Organization ID must be empty.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Validation:</strong> Email must be unique, organization must exist for ORG accounts, each organization can only have one ORG account, DEVELOPER accounts cannot be created via import
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>UI Location:</strong> Organizations page - Export Accounts Excel and Import Accounts Excel buttons (SUPERADMIN/DEVELOPER only)
                    </p>
                    <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900">
                      <p className="text-xs text-yellow-800 dark:text-yellow-200">
                        <strong>⚠️ Important:</strong> Import only creates new accounts - does not update existing ones. Passwords are hashed using bcrypt before storage. DEVELOPER accounts cannot be created via import (must use script).
                      </p>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Common Features Across All Excel Operations</h4>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
                      <li><strong>No Updates:</strong> All import operations only create new records - existing records are never updated</li>
                      <li><strong>Validation:</strong> Comprehensive validation with detailed error messages for failed rows</li>
                      <li><strong>Results:</strong> Import responses include total processed, successful creations, errors, and detailed error messages (first 100 rows)</li>
                      <li><strong>File Format:</strong> Supports .xlsx and .xls formats</li>
                      <li><strong>Security:</strong> Only SUPERADMIN and DEVELOPER accounts can access export/import features</li>
                      <li><strong>Filtering:</strong> Export endpoints support optional <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">orgId</code> query parameter for organization-specific exports</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <SectionHeader id="work-order-excel" title="Work Order Excel Import/Export (Detailed)" icon={FileText} />
            {expandedSections.has("work-order-excel") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Excel Export</h3>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    <p className="text-sm text-muted-foreground">
                      <strong>Access:</strong> SUPERADMIN and DEVELOPER accounts can export work orders to Excel format.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Endpoint:</strong> <code className="bg-background px-1 rounded">GET /api/workorders/export</code>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Query Parameters:</strong>
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                      <li><code className="bg-background px-1 rounded">orgId</code> (optional) - Filter by organization ID</li>
                    </ul>
                    <p className="text-sm text-muted-foreground">
                      <strong>Exported Columns:</strong>
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                      <li>Work Order ID, Title, Description, Location</li>
                      <li>Organization ID, Organization Name</li>
                      <li>Plant ID, Plant Name, Vendor Plant ID</li>
                      <li>Vendor ID, Vendor Name, Vendor Type</li>
                      <li>Capacity (kW), Created At, Updated At</li>
                    </ul>
                    <p className="text-sm text-muted-foreground">
                      <strong>Format:</strong> One row per plant mapping. Work orders with multiple plants will have multiple rows.
                    </p>
                  </div>

                  <h3 className="font-semibold text-lg">Excel Import</h3>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                    <p className="text-sm text-muted-foreground">
                      <strong>Access:</strong> SUPERADMIN and DEVELOPER accounts can import work orders from Excel files.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Endpoint:</strong> <code className="bg-background px-1 rounded">POST /api/workorders/import</code>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Request:</strong> Multipart form data with <code className="bg-background px-1 rounded">file</code> field containing Excel file (.xlsx or .xls)
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-900">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Required Columns:</h4>
                      <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                        <li><strong>Title</strong> - Work order title (required)</li>
                        <li><strong>Organization ID</strong> - Organization ID (required, must exist)</li>
                        <li><strong>Vendor Plant ID</strong> - Vendor-specific plant identifier (required, unique per vendor type)</li>
                        <li><strong>Vendor Type</strong> - Vendor type (required, e.g., SOLARMAN, SOLARDM, PVBLINK, SHINEMONITOR, FOXESSCLOUD)</li>
                        <li><strong>Plant Name</strong> - Plant name (optional, for reference only, not used for matching)</li>
                        <li><strong>Description</strong> - Work order description (optional)</li>
                        <li><strong>Location</strong> - Work order location (optional)</li>
                      </ul>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                        <strong>Note:</strong> Plants are identified by the combination of Vendor Plant ID and Vendor Type. Vendor Plant ID is unique per vendor type (not globally unique). Plant Name is optional and not used for matching since names can be duplicate. The internal Plant ID is not required for import.
                      </p>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-950/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-900">
                      <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">⚠️ Important Rules:</h4>
                      <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1 list-disc list-inside">
                        <li><strong>No Updates:</strong> Existing work orders are not updated. Only new work orders are created.</li>
                        <li><strong>One Plant Per Work Order:</strong> A plant can only be mapped to one active work order.</li>
                        <li><strong>Same Organization:</strong> All plants in a work order must belong to the same organization.</li>
                        <li><strong>Validation:</strong> Rows with errors are reported but not processed.</li>
                        <li><strong>Grouping:</strong> Rows with the same Title and Organization ID are grouped into one work order.</li>
                      </ul>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <strong>Response:</strong> Returns summary with:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                      <li>Total rows processed</li>
                      <li>Number of successfully created work orders</li>
                      <li>Number of rows with errors</li>
                      <li>Detailed error messages for failed rows (first 100)</li>
                    </ul>
                    <p className="text-sm text-muted-foreground">
                      <strong>Use Case:</strong> Bulk upload work orders for disaster recovery or initial data migration.
                    </p>
                  </div>

                  <h3 className="font-semibold text-lg">Implementation Details</h3>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <p className="text-sm text-muted-foreground">
                      <strong>Library:</strong> Uses <code className="bg-background px-1 rounded">exceljs</code> for Excel file generation and parsing.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Export Logic:</strong>
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                      <li>Fetches work orders with plant mappings and vendor information</li>
                      <li>Creates one row per plant mapping (work orders with multiple plants have multiple rows)</li>
                      <li>Exports Vendor Plant ID and Plant Name as primary identifiers (not internal Plant ID)</li>
                      <li>Formats dates as ISO strings</li>
                      <li>Generates Excel file with styled header row</li>
                    </ul>
                    <p className="text-sm text-muted-foreground">
                      <strong>Import Logic:</strong>
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                      <li>Parses Excel file and extracts data rows</li>
                      <li>Groups rows by Title + Organization ID combination</li>
                      <li>Validates organization exists</li>
                      <li>Looks up vendors by Vendor Type</li>
                      <li>Looks up plants by Vendor Plant ID and Vendor ID (derived from Vendor Type) combination</li>
                      <li>Vendor Plant ID is unique per vendor type (not globally unique)</li>
                      <li>Plant Name is optional and not used for matching (names can be duplicate)</li>
                      <li>Validates all matched plants exist and belong to the same organization</li>
                      <li>Checks for existing work orders (skips if found - no updates)</li>
                      <li>Checks for existing plant mappings in other work orders (reports error)</li>
                      <li>Creates new work orders and plant mappings for valid rows</li>
                      <li>Returns detailed results with success/error status for each row</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <SectionHeader id="backlog" title="Production Improvements Backlog" icon={AlertCircle} />
            {expandedSections.has("backlog") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Production improvements prioritized by <strong>blast radius</strong> (impact/severity). 
                    Higher blast radius = more critical for production stability and scalability.
                  </p>
                  
                  {/* Critical Blast Radius */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-red-600 dark:text-red-400">🔴 Critical Blast Radius (System-Wide Impact)</h3>
                    
                    <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-900 space-y-3">
                      <div>
                        <h4 className="font-semibold mb-2">1. Database Connection Pooling & Connection Limits</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> Entire system - all API routes, cron jobs, vendor syncs
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Issue:</strong> Current implementation uses pooled fetch but doesn&apos;t enforce connection limits. 
                          Under high load, could exhaust Supabase connection pool leading to connection timeouts and cascading failures.
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Impact:</strong> Complete system unavailability during peak load or vendor sync bursts
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Implement connection pool size limits in <code className="bg-background px-1 rounded">lib/vendors/httpClient.ts</code></li>
                          <li>Add connection queue with timeout for rejected connections</li>
                          <li>Monitor connection pool metrics (active, idle, waiting)</li>
                          <li>Add circuit breaker pattern for vendor API calls</li>
                          <li>Implement retry with exponential backoff for transient failures</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">2. Error Handling & Observability</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> All operations - silent failures can cause data inconsistency
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Issue:</strong> Many error paths log to console but don&apos;t surface to monitoring. 
                          MDC context exists but not fully utilized for error tracking.
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Impact:</strong> Undetected failures, data loss, difficult troubleshooting
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Integrate structured logging with external service (Datadog, Sentry, CloudWatch)</li>
                          <li>Add error tracking for all vendor API failures with context</li>
                          <li>Implement alerting for critical error patterns (vendor auth failures, sync failures)</li>
                          <li>Add distributed tracing for request flows across services</li>
                          <li>Create error dashboard showing failure rates by vendor/operation</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">3. Rate Limiting & Vendor API Throttling</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> All vendor syncs - can cause vendor API bans
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Issue:</strong> No rate limiting on vendor API calls. Concurrent syncs could exceed vendor rate limits, 
                          leading to API bans and complete sync failures.
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Impact:</strong> Vendor API bans, complete sync failure for affected vendors
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Implement per-vendor rate limiting (requests per minute/hour)</li>
                          <li>Add request queue with priority for critical operations</li>
                          <li>Respect vendor API rate limit headers (Retry-After, X-RateLimit-*)</li>
                          <li>Add exponential backoff on 429 (Too Many Requests) responses</li>
                          <li>Monitor and alert on rate limit violations</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">4. Database Transaction Management</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> Data consistency - partial updates can corrupt data
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Issue:</strong> Plant sync uses batch upserts but no explicit transactions. 
                          Partial failures could leave data in inconsistent state.
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Impact:</strong> Data corruption, inconsistent plant metrics, orphaned records
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Wrap batch operations in database transactions</li>
                          <li>Implement idempotency keys for sync operations</li>
                          <li>Add data validation before batch inserts</li>
                          <li>Create reconciliation jobs to detect and fix inconsistencies</li>
                          <li>Add database constraints to prevent invalid states</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">5. Session Security & Token Management</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> Authentication system - security breach
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Issue:</strong> Session tokens in cookies are base64-encoded (not encrypted). 
                          No token rotation, no session invalidation on password change.
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Impact:</strong> Session hijacking, unauthorized access, security breach
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Encrypt session tokens (use JWT with signing or AES encryption)</li>
                          <li>Implement session rotation on sensitive operations</li>
                          <li>Add session invalidation on password change</li>
                          <li>Store active sessions in database for revocation</li>
                          <li>Add CSRF protection for state-changing operations</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* High Blast Radius */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-orange-600 dark:text-orange-400">🟠 High Blast Radius (Multi-Service Impact)</h3>
                    
                    <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border border-orange-200 dark:border-orange-900 space-y-3">
                      <div>
                        <h4 className="font-semibold mb-2">6. Cron Job Reliability & Failure Recovery</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> All scheduled syncs - data staleness
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Issue:</strong> Cron jobs run in-process. If server crashes, jobs are lost. 
                          No retry mechanism for failed syncs. No dead letter queue.
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Impact:</strong> Missed syncs, stale data, manual intervention required
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Move cron jobs to external scheduler (Supabase Edge Functions, Cloud Scheduler, cron-job.org)</li>
                          <li>Implement job queue with retry mechanism (Bull, BullMQ, or Supabase Queue)</li>
                          <li>Add dead letter queue for permanently failed jobs</li>
                          <li>Store job execution history in database</li>
                          <li>Add monitoring and alerting for missed cron executions</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">7. Vendor Token Expiration & Refresh</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> All operations for affected vendors
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Issue:</strong> Token expiration checked but refresh logic may fail silently. 
                          No proactive token refresh before expiration.
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Impact:</strong> Sync failures when tokens expire, manual token refresh required
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Implement proactive token refresh (refresh 5 minutes before expiration)</li>
                          <li>Add token refresh retry with exponential backoff</li>
                          <li>Store refresh tokens securely (encrypted in credentials JSONB)</li>
                          <li>Alert on repeated token refresh failures</li>
                          <li>Add manual token refresh endpoint for troubleshooting</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">8. Memory Leaks & Resource Management</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> Server stability - OOM crashes
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Issue:</strong> Large batch operations may hold references. 
                          Build process already requires increased heap size (4GB). No memory monitoring.
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Impact:</strong> Server crashes, service unavailability, data loss
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Add memory monitoring and alerting</li>
                          <li>Implement streaming for large batch operations</li>
                          <li>Add resource cleanup in error paths</li>
                          <li>Profile memory usage during sync operations</li>
                          <li>Consider pagination for large result sets</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">9. Database Index Optimization</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> Query performance - slow API responses
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Issue:</strong> Some queries may not use optimal indexes. 
                          No query performance monitoring. Missing composite indexes for common query patterns.
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Impact:</strong> Slow API responses, poor user experience, database load
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Analyze slow query logs (enable pg_stat_statements)</li>
                          <li>Add composite indexes for common query patterns (org_id + vendor_id, etc.)</li>
                          <li>Add partial indexes for filtered queries (WHERE is_active = true)</li>
                          <li>Monitor index usage and remove unused indexes</li>
                          <li>Add query performance metrics to monitoring</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">10. Remove Unused Tables & Deprecated Features</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> Database schema cleanup - reduces confusion and maintenance overhead
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>✅ Completed:</strong> The following cleanup has been done:
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li><code className="bg-background px-1 rounded">work_order_plant_eff</code> table - Completely removed from schema (table definition, indexes, RLS policies, type definitions, and all documentation references removed)</li>
                          <li>Efficiency endpoint (<code className="bg-background px-1 rounded">/api/workorders/[id]/efficiency</code>) - Removed (never existed in current codebase)</li>
                          <li>Efficiency UI components (<code className="bg-background px-1 rounded">EfficiencyBadge</code>, <code className="bg-background px-1 rounded">EfficiencySummary</code>) - Removed (never existed in current codebase)</li>
                          <li>Efficiency permissions from RBAC - Removed (never existed in current codebase)</li>
                          <li>All references to <code className="bg-background px-1 rounded">work_order_plant_eff</code> removed from: schema migrations, RLS policies, TypeScript types, API route comments, and all documentation files</li>
                          <li>Telemetry database environment variables (TELEMETRY_SUPABASE_*) - Deprecated (separate telemetry database removed, all telemetry stored in main DB or fetched on-demand from vendor APIs)</li>
                        </ul>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Note:</strong> PR (Performance Ratio) calculations are not part of the current system architecture.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Medium Blast Radius */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-yellow-600 dark:text-yellow-400">🟡 Medium Blast Radius (Feature/Service Impact)</h3>
                    
                    <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-900 space-y-3">
                      <div>
                        <h4 className="font-semibold mb-2">11. Per-Vendor Restricted Sync Window Implementation</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> Vendor sync scheduling
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Issue:</strong> Restricted window is global (env var). 
                          Should be per-vendor configurable via UI (currently only default exists).
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Add restricted_window_start/end columns to vendors table</li>
                          <li>Update cron to check per-vendor windows</li>
                          <li>Add UI controls in vendor sync settings</li>
                          <li>Default to 8 PM - 5 AM IST if not specified</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">12. Twice-Daily listPlants for PER_PLANT Vendors</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> PER_PLANT vendor sync accuracy
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Issue:</strong> plant_list_sync_morning_ist/evening_ist configured but not wired into cron.
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Create separate cron job for twice-daily listPlants refresh</li>
                          <li>Only run for PER_PLANT mode vendors</li>
                          <li>Respect vendor-specific morning/evening times</li>
                          <li>Add monitoring for execution success</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">13. ShineMonitor & Foxesscloud Full Implementation</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> Feature completeness for these vendors
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Issue:</strong> Only authentication implemented. Plants, telemetry, alerts pending.
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Implement listPlants() for both vendors</li>
                          <li>Implement telemetry endpoints</li>
                          <li>Implement alert sync (if supported by vendor)</li>
                          <li>Add to vendor capabilities matrix</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">14. API Response Caching</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> API performance, database load
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Issue:</strong> No caching for read-heavy endpoints (dashboard, plant lists, etc.)
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Implement Redis or in-memory cache for dashboard data</li>
                          <li>Add cache invalidation on data updates</li>
                          <li>Cache with appropriate TTLs (1-5 minutes for dynamic data)</li>
                          <li>Add cache hit/miss metrics</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">15. Database Backup & Disaster Recovery</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> Data loss risk
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Issue:</strong> No documented backup strategy or recovery procedures.
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Document Supabase backup configuration (point-in-time recovery)</li>
                          <li>Create disaster recovery runbook</li>
                          <li>Test backup restoration procedures</li>
                          <li>Add backup verification alerts</li>
                          <li>Document RTO/RPO requirements</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Low Blast Radius */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg text-blue-600 dark:text-blue-400">🔵 Low Blast Radius (Optimization/Enhancement)</h3>
                    
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900 space-y-3">
                      <div>
                        <h4 className="font-semibold mb-2">16. Performance Monitoring & APM</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> Observability
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Integrate APM tool (New Relic, Datadog APM, or similar)</li>
                          <li>Add custom metrics for business operations (sync duration, plant counts, etc.)</li>
                          <li>Create performance dashboards</li>
                          <li>Set up SLOs/SLIs for critical operations</li>
                        </ul>
                        <p className="text-sm text-muted-foreground mt-2">
                          <strong>📚 Setup Guide:</strong> Complete step-by-step guide available at <code className="bg-background px-1 rounded">docs/NEW_RELIC_APM_SETUP.md</code>
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">17. Load Testing & Capacity Planning</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> Scalability planning
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Create load test scenarios (k6, Artillery, or Locust)</li>
                          <li>Test vendor sync under load</li>
                          <li>Identify bottlenecks and capacity limits</li>
                          <li>Document scaling recommendations</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">18. Automated Testing Suite</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> Code quality, regression prevention
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Add unit tests for services (plantSyncService, alertSyncService)</li>
                          <li>Add integration tests for API routes</li>
                          <li>Add E2E tests for critical user flows</li>
                          <li>Add vendor adapter mock tests</li>
                          <li>Set up CI/CD test pipeline</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">19. Documentation & Runbooks</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> Operational efficiency
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Create runbooks for common issues (vendor sync failures, token expiration, etc.)</li>
                          <li>Document troubleshooting procedures</li>
                          <li>Add architecture decision records (ADRs)</li>
                          <li>Create onboarding documentation for new developers</li>
                        </ul>
                        <p className="text-sm text-muted-foreground mt-2">
                          <strong>✅ Status:</strong> Implemented - Available at <code className="bg-background px-1 rounded">/superadmin/documentation-runbooks</code> (DEVELOPER only)
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">20. Documentation & Runbooks</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Blast Radius:</strong> Operational efficiency
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                          <li>Create runbooks for common issues (vendor sync failures, token expiration, etc.)</li>
                          <li>Document troubleshooting procedures</li>
                          <li>Add architecture decision records (ADRs)</li>
                          <li>Create onboarding documentation for new developers</li>
                        </ul>
                        <p className="text-sm text-muted-foreground mt-2">
                          <strong>✅ Status:</strong> Implemented - Available at <code className="bg-background px-1 rounded">/superadmin/documentation-runbooks</code> (DEVELOPER only)
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
