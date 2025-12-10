"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ChevronDown, 
  ChevronRight, 
  BookOpen,
  FileText,
  AlertTriangle,
  RefreshCw,
  Key,
  Database,
  Code,
  Users,
  Terminal,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Settings,
  Server
} from "lucide-react"
import { cn } from "@/lib/utils"
// CodeBlock component (inline definition)
const CodeBlock = ({ code, language = "typescript", id }: { code: string; language?: string; id: string }) => (
  <div className="relative">
    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs">
      <code>{code}</code>
    </pre>
  </div>
)

interface SectionHeaderProps {
  id: string
  title: string
  icon: React.ElementType
}

function SectionHeader({ id, title, icon: Icon }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between p-6 border-b">
      <div className="flex items-center gap-3">
        <Icon className="h-6 w-6 text-primary" />
        <h2 id={id} className="text-2xl font-bold">
          {title}
        </h2>
      </div>
      <Badge variant="outline" className="flex items-center gap-1">
        <Terminal className="h-3 w-3" />
        Developer Access Only
      </Badge>
    </div>
  )

}

export function DocumentationRunbooks() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["runbooks", "troubleshooting", "vendor-config", "architecture", "adrs", "onboarding"])
  )

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent mb-2">
          Documentation & Runbooks
        </h1>
        <p className="text-muted-foreground">
          Comprehensive operational documentation, troubleshooting guides, architecture decisions, and developer onboarding resources.
        </p>
      </div>

      <Tabs defaultValue="runbooks" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="runbooks">
            <FileText className="h-4 w-4 mr-2" />
            Runbooks
          </TabsTrigger>
          <TabsTrigger value="troubleshooting">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Troubleshooting
          </TabsTrigger>
          <TabsTrigger value="vendor-config">
            <Settings className="h-4 w-4 mr-2" />
            Vendor Config
          </TabsTrigger>
          <TabsTrigger value="architecture">
            <Server className="h-4 w-4 mr-2" />
            Architecture
          </TabsTrigger>
          <TabsTrigger value="adrs">
            <Code className="h-4 w-4 mr-2" />
            ADRs
          </TabsTrigger>
          <TabsTrigger value="onboarding">
            <Users className="h-4 w-4 mr-2" />
            Onboarding
          </TabsTrigger>
        </TabsList>

        {/* Runbooks Tab */}
        <TabsContent value="runbooks" className="space-y-6">
          <Card className="overflow-hidden">
            <SectionHeader id="runbooks" title="Operational Runbooks" icon={FileText} />
            {expandedSections.has("runbooks") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                {/* Vendor Sync Failures */}
                <div className="space-y-4">
                  <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-900">
                    <h3 className="font-semibold text-red-900 dark:text-red-100 mb-3 flex items-center gap-2">
                      <RefreshCw className="h-5 w-5" />
                      Vendor Sync Failures
                    </h3>
                    <div className="space-y-3 text-sm text-red-800 dark:text-red-200">
                      <div>
                        <h4 className="font-semibold mb-2">Symptoms</h4>
                        <ul className="ml-4 list-disc space-y-1">
                          <li>Plants not updating in database</li>
                          <li>Last sync timestamp not updating</li>
                          <li>Error logs showing vendor API failures</li>
                          <li>Alerts not syncing for specific vendors</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Diagnosis Steps</h4>
                        <ol className="ml-4 list-decimal space-y-1">
                          <li>Check vendor status: <code className="bg-red-100 dark:bg-red-900 px-1 rounded">SELECT * FROM vendors WHERE id = {`{vendorId}`}</code></li>
                          <li>Verify <code className="bg-red-100 dark:bg-red-900 px-1 rounded">is_active = true</code> and <code className="bg-red-100 dark:bg-red-900 px-1 rounded">org_id IS NOT NULL</code></li>
                          <li>Check last sync timestamps: <code className="bg-red-100 dark:bg-red-900 px-1 rounded">last_plant_synced_at</code>, <code className="bg-red-100 dark:bg-red-900 px-1 rounded">last_alert_synced_at</code></li>
                          <li>Review application logs for vendor-specific errors</li>
                          <li>Test vendor authentication: <code className="bg-red-100 dark:bg-red-900 px-1 rounded">POST /api/vendors/{`{id}`}/sync-plants</code></li>
                        </ol>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Common Causes & Solutions</h4>
                        <div className="space-y-2">
                          <div>
                            <strong>Token Expiration:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Check <code className="bg-red-100 dark:bg-red-900 px-1 rounded">token_expires_at</code> in vendors table</li>
                              <li>Token should auto-refresh, but if expired, manual sync will trigger refresh</li>
                              <li>Solution: Trigger manual sync via UI or API</li>
                            </ul>
                          </div>
                          <div>
                            <strong>Invalid Credentials:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Check vendor credentials JSON for required fields (appId, appSecret, username, password, etc.)</li>
                              <li>Verify credentials haven&apos;t changed on vendor side</li>
                              <li>Solution: Update credentials in vendor settings</li>
                            </ul>
                          </div>
                          <div>
                            <strong>API Rate Limiting:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Vendor API may be rate-limiting requests</li>
                              <li>Check for 429 (Too Many Requests) errors in logs</li>
                              <li>Solution: Wait and retry, or reduce sync frequency</li>
                            </ul>
                          </div>
                          <div>
                            <strong>Network Issues:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Check server connectivity to vendor APIs</li>
                              <li>Verify firewall rules allow outbound connections</li>
                              <li>Solution: Check network configuration, DNS resolution</li>
                            </ul>
                          </div>
                          <div>
                            <strong>Restricted Sync Window:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Syncs are skipped during restricted window (8 PM - 5 AM IST by default)</li>
                              <li>Check vendor&apos;s <code className="bg-red-100 dark:bg-red-900 px-1 rounded">restricted_sync_window_start_ist</code> and <code className="bg-red-100 dark:bg-red-900 px-1 rounded">restricted_sync_window_end_ist</code></li>
                              <li>Solution: Manual sync bypasses window, or wait for window to pass</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Recovery Actions</h4>
                        <ol className="ml-4 list-decimal space-y-1">
                          <li>Trigger manual sync: <code className="bg-red-100 dark:bg-red-900 px-1 rounded">POST /api/vendors/{`{id}`}/sync-plants</code></li>
                          <li>If manual sync fails, check vendor adapter logs for specific error</li>
                          <li>Update vendor credentials if authentication is failing</li>
                          <li>Verify vendor API is accessible and responding</li>
                          <li>Check database connection and RLS policies</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  {/* Token Expiration */}
                  <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border border-orange-200 dark:border-orange-900">
                    <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-3 flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      Token Expiration & Refresh Issues
                    </h3>
                    <div className="space-y-3 text-sm text-orange-800 dark:text-orange-200">
                      <div>
                        <h4 className="font-semibold mb-2">Symptoms</h4>
                        <ul className="ml-4 list-disc space-y-1">
                          <li>401 Unauthorized errors from vendor APIs</li>
                          <li>Token refresh failures in logs</li>
                          <li>Sync operations failing with authentication errors</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Diagnosis Steps</h4>
                        <ol className="ml-4 list-decimal space-y-1">
                          <li>Check token expiration: <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">SELECT access_token, token_expires_at FROM vendors WHERE id = {`{vendorId}`}</code></li>
                          <li>Verify token is not expired: <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">token_expires_at &gt; NOW()</code></li>
                          <li>Check token metadata for refresh token availability</li>
                          <li>Review authentication logs for specific error messages</li>
                        </ol>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Token Storage</h4>
                        <ul className="ml-4 list-disc space-y-1">
                          <li>Tokens stored in <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">vendors.access_token</code></li>
                          <li>Expiration in <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">vendors.token_expires_at</code></li>
                          <li>Metadata in <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">vendors.token_metadata</code> (JSONB)</li>
                          <li>Tokens are validated with 5-minute buffer before expiration</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Recovery Actions</h4>
                        <ol className="ml-4 list-decimal space-y-1">
                          <li>Trigger manual sync - this will force token refresh if expired</li>
                          <li>If refresh fails, verify vendor credentials are correct</li>
                          <li>For Solarman: Check if token is JWT format (can decode to check expiry)</li>
                          <li>Clear token and force re-authentication: <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">UPDATE vendors SET access_token = NULL, token_expires_at = NULL WHERE id = {`{vendorId}`}</code></li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  {/* Database Connection Issues */}
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Database Connection & Performance Issues
                    </h3>
                    <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
                      <div>
                        <h4 className="font-semibold mb-2">Symptoms</h4>
                        <ul className="ml-4 list-disc space-y-1">
                          <li>Slow API responses</li>
                          <li>Connection pool exhaustion errors</li>
                          <li>Query timeouts</li>
                          <li>High database CPU/memory usage</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Diagnosis Steps</h4>
                        <ol className="ml-4 list-decimal space-y-1">
                          <li>Check active connections: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">SELECT count(*) FROM pg_stat_activity</code></li>
                          <li>Review slow queries: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10</code></li>
                          <li>Check connection pool settings in <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">lib/supabase/pooled.ts</code></li>
                          <li>Monitor database metrics (CPU, memory, connections)</li>
                        </ol>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Common Issues</h4>
                        <div className="space-y-2">
                          <div>
                            <strong>Missing Indexes:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Check for sequential scans on large tables</li>
                              <li>Add composite indexes for common query patterns</li>
                              <li>Example: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">CREATE INDEX idx_plants_org_vendor ON plants(org_id, vendor_id) WHERE is_active = true</code></li>
                            </ul>
                          </div>
                          <div>
                            <strong>Connection Pool Exhaustion:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Default pool size: 10 connections</li>
                              <li>Check for connection leaks (connections not being released)</li>
                              <li>Solution: Increase pool size or fix connection leaks</li>
                            </ul>
                          </div>
                          <div>
                            <strong>Large Batch Operations:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Plant sync processes in batches of 100</li>
                              <li>Live telemetry sync processes in batches of 100</li>
                              <li>If issues persist, reduce batch size</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cron Job Failures */}
                  <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-900">
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Cron Job Failures
                    </h3>
                    <div className="space-y-3 text-sm text-purple-800 dark:text-purple-200">
                      <div>
                        <h4 className="font-semibold mb-2">Symptoms</h4>
                        <ul className="ml-4 list-disc space-y-1">
                          <li>Scheduled syncs not running</li>
                          <li>No updates to last_synced_at timestamps</li>
                          <li>Cron job errors in logs</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Diagnosis Steps</h4>
                        <ol className="ml-4 list-decimal space-y-1">
                          <li>Check if cron is enabled: <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">ENABLE_PLANT_SYNC_CRON</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">ENABLE_ALERT_SYNC_CRON</code></li>
                          <li>Verify cron jobs are registered in <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">server.js</code></li>
                          <li>Check application logs for cron execution errors</li>
                          <li>Test cron endpoints manually: <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">GET /api/cron/sync-plants?secret={`{CRON_SECRET}`}</code></li>
                        </ol>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Cron Jobs</h4>
                        <ul className="ml-4 list-disc space-y-1">
                          <li><strong>Plant Sync:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">lib/cron/plantSyncCron.js</code> - Checks morning/evening sync times</li>
                          <li><strong>Live Telemetry Sync:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">lib/cron/liveTelemetrySyncCron.js</code> - Runs every 15 minutes</li>
                          <li><strong>Alert Sync:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">lib/cron/alertSyncCron.js</code> - Scheduled via external cron</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Recovery Actions</h4>
                        <ol className="ml-4 list-decimal space-y-1">
                          <li>Restart application server to re-register cron jobs</li>
                          <li>Use external cron service (cron-job.org, GitHub Actions) as backup</li>
                          <li>Trigger manual syncs via API endpoints</li>
                          <li>Check server logs for cron execution errors</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Troubleshooting Tab */}
        <TabsContent value="troubleshooting" className="space-y-6">
          <Card className="overflow-hidden">
            <SectionHeader id="troubleshooting" title="Troubleshooting Procedures" icon={AlertTriangle} />
            {expandedSections.has("troubleshooting") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="space-y-4">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">General Troubleshooting Workflow</h3>
                    <ol className="text-sm text-muted-foreground space-y-2 ml-4 list-decimal">
                      <li><strong>Identify the Issue:</strong> Check error messages, logs, and user reports</li>
                      <li><strong>Check System Status:</strong> Verify database connectivity, vendor API status, cron job execution</li>
                      <li><strong>Review Logs:</strong> Check application logs, database logs, and vendor API responses</li>
                      <li><strong>Isolate the Problem:</strong> Determine if issue is vendor-specific, system-wide, or data-related</li>
                      <li><strong>Apply Fix:</strong> Use appropriate runbook or manual intervention</li>
                      <li><strong>Verify Resolution:</strong> Confirm fix works and monitor for recurrence</li>
                    </ol>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">Log Locations & Access</h3>
                    <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                      <li><strong>Application Logs:</strong> Check server console output or log files (if configured)</li>
                      <li><strong>MDC Context:</strong> Structured logging with request IDs, vendor IDs, operation types</li>
                      <li><strong>Database Logs:</strong> Supabase dashboard → Logs section</li>
                      <li><strong>API Request/Response:</strong> Logged via <code className="bg-background px-1 rounded">lib/api-logger.ts</code></li>
                    </ul>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">Common Error Codes & Solutions</h3>
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <div>
                        <strong>401 Unauthorized:</strong>
                        <ul className="ml-4 list-disc mt-1">
                          <li>Token expired - trigger manual sync to refresh</li>
                          <li>Invalid credentials - update vendor credentials</li>
                          <li>Session expired - user needs to re-login</li>
                        </ul>
                      </div>
                      <div>
                        <strong>403 Forbidden:</strong>
                        <ul className="ml-4 list-disc mt-1">
                          <li>Insufficient permissions - check user role</li>
                          <li>RLS policy blocking access - verify organization membership</li>
                        </ul>
                      </div>
                      <div>
                        <strong>404 Not Found:</strong>
                        <ul className="ml-4 list-disc mt-1">
                          <li>Resource doesn&apos;t exist - verify ID</li>
                          <li>Vendor plant not mapped - check plant mapping</li>
                        </ul>
                      </div>
                      <div>
                        <strong>429 Too Many Requests:</strong>
                        <ul className="ml-4 list-disc mt-1">
                          <li>Vendor API rate limiting - wait and retry</li>
                          <li>Reduce sync frequency if persistent</li>
                        </ul>
                      </div>
                      <div>
                        <strong>500 Internal Server Error:</strong>
                        <ul className="ml-4 list-disc mt-1">
                          <li>Check application logs for specific error</li>
                          <li>Database connection issues - verify Supabase connection</li>
                          <li>Memory issues - check server resources</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Vendor Configuration Tab */}
        <TabsContent value="vendor-config" className="space-y-6">
          <Card className="overflow-hidden">
            <SectionHeader id="vendor-config" title="Vendor Configuration & Sync Modes" icon={Settings} />
            {expandedSections.has("vendor-config") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="space-y-6">
                  {/* Overview */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-6 rounded-lg border border-blue-200 dark:border-blue-900">
                    <h3 className="font-semibold text-lg mb-3">Overview</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      This guide explains all vendor configuration attributes and how the two sync modes work:
                    </p>
                    <ol className="text-sm text-muted-foreground space-y-2 ml-4 list-decimal">
                      <li><strong>Plant Sync Mode</strong> - Controls how plant listing and basic info is synced</li>
                      <li><strong>Live Telemetry Sync Mode</strong> - Controls how live telemetry (power, energy) is synced</li>
                    </ol>
                  </div>

                  {/* Vendor Configuration Attributes */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Vendor Configuration Attributes</h3>
                    
                    {/* Basic Vendor Information */}
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        1. Basic Vendor Information
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2 font-semibold">Field</th>
                              <th className="text-left p-2 font-semibold">Type</th>
                              <th className="text-left p-2 font-semibold">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">id</code></td>
                              <td className="p-2">SERIAL</td>
                              <td className="p-2">Primary key</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">name</code></td>
                              <td className="p-2">TEXT</td>
                              <td className="p-2">Vendor name (e.g., &quot;Solarman&quot;, &quot;SolarDM&quot;)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">vendor_type</code></td>
                              <td className="p-2">ENUM</td>
                              <td className="p-2">Vendor type: <code className="bg-background px-1 rounded">SOLARMAN</code>, <code className="bg-background px-1 rounded">SOLARDM</code>, <code className="bg-background px-1 rounded">SHINEMONITOR</code>, <code className="bg-background px-1 rounded">PVBLINK</code>, <code className="bg-background px-1 rounded">FOXESSCLOUD</code>, <code className="bg-background px-1 rounded">OTHER</code></td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">org_id</code></td>
                              <td className="p-2">INTEGER</td>
                              <td className="p-2">Organization this vendor belongs to (nullable for global vendors)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">credentials</code></td>
                              <td className="p-2">JSONB</td>
                              <td className="p-2">Encrypted API credentials (vendor-specific)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">is_active</code></td>
                              <td className="p-2">BOOLEAN</td>
                              <td className="p-2">Whether vendor is active (default: true)</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Token Storage */}
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        2. Token Storage (for API authentication)
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2 font-semibold">Field</th>
                              <th className="text-left p-2 font-semibold">Type</th>
                              <th className="text-left p-2 font-semibold">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">access_token</code></td>
                              <td className="p-2">TEXT</td>
                              <td className="p-2">Cached access token from vendor API</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">refresh_token</code></td>
                              <td className="p-2">TEXT</td>
                              <td className="p-2">Refresh token for token renewal (if supported)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">token_expires_at</code></td>
                              <td className="p-2">TIMESTAMPTZ</td>
                              <td className="p-2">Token expiration timestamp</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">token_metadata</code></td>
                              <td className="p-2">JSONB</td>
                              <td className="p-2">Additional token metadata (token_type, scope, expires_in, etc.)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">last_synced_at</code></td>
                              <td className="p-2">TIMESTAMPTZ</td>
                              <td className="p-2">Last time plants were synced from this vendor</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Plant Sync Mode Configuration */}
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <RefreshCw className="h-5 w-5" />
                        3. Plant Sync Mode Configuration
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2 font-semibold">Field</th>
                              <th className="text-left p-2 font-semibold">Type</th>
                              <th className="text-left p-2 font-semibold">Default</th>
                              <th className="text-left p-2 font-semibold">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">plant_sync_mode</code></td>
                              <td className="p-2">TEXT</td>
                              <td className="p-2"><code className="bg-background px-1 rounded">&apos;LIST_PLANTS&apos;</code></td>
                              <td className="p-2">Controls how plant sync runs: <code className="bg-background px-1 rounded">&apos;LIST_PLANTS&apos;</code> or <code className="bg-background px-1 rounded">&apos;PER_PLANT&apos;</code></td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">per_plant_sync_interval_minutes</code></td>
                              <td className="p-2">INTEGER</td>
                              <td className="p-2"><code className="bg-background px-1 rounded">15</code></td>
                              <td className="p-2">Interval for per-plant sync (reserved for future use)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">plant_list_sync_morning_ist</code></td>
                              <td className="p-2">TIME</td>
                              <td className="p-2"><code className="bg-background px-1 rounded">&apos;06:00&apos;</code></td>
                              <td className="p-2">Morning time (IST) for listPlants() sync when <code className="bg-background px-1 rounded">plant_sync_mode = PER_PLANT</code></td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">plant_list_sync_evening_ist</code></td>
                              <td className="p-2">TIME</td>
                              <td className="p-2"><code className="bg-background px-1 rounded">&apos;23:00&apos;</code></td>
                              <td className="p-2">Evening time (IST) for listPlants() sync when <code className="bg-background px-1 rounded">plant_sync_mode = PER_PLANT</code></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Live Telemetry Sync Mode Configuration */}
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Zap className="h-5 w-5" />
                        4. Live Telemetry Sync Mode Configuration
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2 font-semibold">Field</th>
                              <th className="text-left p-2 font-semibold">Type</th>
                              <th className="text-left p-2 font-semibold">Default</th>
                              <th className="text-left p-2 font-semibold">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">telemetry_sync_mode</code></td>
                              <td className="p-2">TEXT</td>
                              <td className="p-2"><code className="bg-background px-1 rounded">&apos;LIST_PLANTS&apos;</code></td>
                              <td className="p-2">Controls how live telemetry is synced: <code className="bg-background px-1 rounded">&apos;LIST_PLANTS&apos;</code> or <code className="bg-background px-1 rounded">&apos;PER_PLANT&apos;</code></td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">telemetry_sync_interval</code></td>
                              <td className="p-2">INTEGER</td>
                              <td className="p-2"><code className="bg-background px-1 rounded">15</code></td>
                              <td className="p-2">Interval in minutes (15, 30, or 45) for live telemetry sync</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Restricted Sync Window */}
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        5. Restricted Sync Window (Per-Vendor)
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2 font-semibold">Field</th>
                              <th className="text-left p-2 font-semibold">Type</th>
                              <th className="text-left p-2 font-semibold">Default</th>
                              <th className="text-left p-2 font-semibold">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">restricted_sync_window_start_ist</code></td>
                              <td className="p-2">TIME</td>
                              <td className="p-2"><code className="bg-background px-1 rounded">&apos;20:00&apos;</code></td>
                              <td className="p-2">Start time (IST) when syncs are skipped (default: 8 PM)</td>
                            </tr>
                            <tr className="border-b">
                              <td className="p-2"><code className="bg-background px-1 rounded">restricted_sync_window_end_ist</code></td>
                              <td className="p-2">TIME</td>
                              <td className="p-2"><code className="bg-background px-1 rounded">&apos;05:00&apos;</code></td>
                              <td className="p-2">End time (IST) when syncs are skipped (default: 5 AM)</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        <strong>Note:</strong> If sync window spans midnight (e.g., 20:00 to 05:00), syncs are skipped during that period.
                      </p>
                    </div>
                  </div>

                  {/* Sync Mode 1: Plant Sync Mode */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Sync Mode 1: Plant Sync Mode</h3>
                    
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">Purpose</h4>
                      <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                        Controls how <strong>plant listing and basic plant information</strong> is synced. This includes:
                      </p>
                      <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
                        <li>Plant topology (id, name, capacity, location)</li>
                        <li>Basic metadata (network status, created date, operating time)</li>
                        <li><strong>Does NOT include live telemetry</strong> (power, energy metrics)</li>
                      </ul>
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3">When It Runs</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><strong>Twice daily</strong> at configured times (morning and evening)</li>
                        <li><strong>Manual/force sync</strong> on user request</li>
                        <li>Runs via cron: <code className="bg-background px-1 rounded">lib/cron/plantSyncCron.js</code> → <code className="bg-background px-1 rounded">GET /api/cron/sync-plants</code></li>
                      </ul>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold">Mode Options</h4>
                      
                      {/* LIST_PLANTS Mode */}
                      <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-900">
                        <h5 className="font-semibold text-green-900 dark:text-green-100 mb-3">
                          <code className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded">LIST_PLANTS</code> Mode (Default for Solarman, ShineMonitor)
                        </h5>
                        <div className="space-y-3 text-sm text-green-800 dark:text-green-200">
                          <div>
                            <strong>How it works:</strong>
                            <ol className="ml-4 mt-1 list-decimal space-y-1">
                              <li>Calls <code className="bg-green-100 dark:bg-green-900 px-1 rounded">adapter.listPlants()</code> once to get all plants</li>
                              <li>Upserts all plants into database with topology and basic info</li>
                              <li>If live telemetry is available in <code className="bg-green-100 dark:bg-green-900 px-1 rounded">listPlants()</code> response, optionally enriches plants</li>
                              <li>Updates: <code className="bg-green-100 dark:bg-green-900 px-1 rounded">name</code>, <code className="bg-green-100 dark:bg-green-900 px-1 rounded">capacity_kw</code>, <code className="bg-green-100 dark:bg-green-900 px-1 rounded">location</code>, <code className="bg-green-100 dark:bg-green-900 px-1 rounded">network_status</code>, <code className="bg-green-100 dark:bg-green-900 px-1 rounded">vendor_created_date</code>, <code className="bg-green-100 dark:bg-green-900 px-1 rounded">start_operating_time</code></li>
                            </ol>
                          </div>
                          <div>
                            <strong>Used by:</strong>
                            <ul className="ml-4 mt-1 list-disc">
                              <li>Solarman</li>
                              <li>ShineMonitor</li>
                              <li>Foxesscloud</li>
                              <li>Default for most vendors</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* PER_PLANT Mode */}
                      <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border border-orange-200 dark:border-orange-900">
                        <h5 className="font-semibold text-orange-900 dark:text-orange-100 mb-3">
                          <code className="bg-orange-100 dark:bg-orange-900 px-2 py-1 rounded">PER_PLANT</code> Mode (Default for SolarDM, PVBlink)
                        </h5>
                        <div className="space-y-3 text-sm text-orange-800 dark:text-orange-200">
                          <div>
                            <strong>How it works:</strong>
                            <ol className="ml-4 mt-1 list-decimal space-y-1">
                              <li><strong>During regular cron (15-minute intervals):</strong> Skips plant sync entirely</li>
                              <li><strong>Twice daily (morning/evening):</strong> Calls <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">adapter.listPlants()</code> to refresh plant topology</li>
                              <li>Live telemetry is handled separately by Live Telemetry Sync Mode</li>
                              <li>Purpose: Avoid expensive <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">listPlants()</code> calls during regular syncs</li>
                            </ol>
                          </div>
                          <div>
                            <strong>Used by:</strong>
                            <ul className="ml-4 mt-1 list-disc">
                              <li>SolarDM</li>
                              <li>PVBlink</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sync Mode 2: Live Telemetry Sync Mode */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Sync Mode 2: Live Telemetry Sync Mode</h3>
                    
                    <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-900">
                      <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">Purpose</h4>
                      <p className="text-sm text-purple-800 dark:text-purple-200 mb-2">
                        Controls how <strong>live telemetry fields</strong> are synced. This includes:
                      </p>
                      <ul className="text-sm text-purple-800 dark:text-purple-200 space-y-1 ml-4 list-disc">
                        <li><code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">current_power_kw</code> - Current generation power</li>
                        <li><code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">daily_energy_kwh</code> - Daily energy generation</li>
                        <li><code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">monthly_energy_mwh</code> - Monthly energy generation</li>
                        <li><code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">yearly_energy_mwh</code> - Yearly energy generation</li>
                        <li><code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">total_energy_mwh</code> - Total cumulative energy</li>
                        <li><code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">network_status</code> - Network connectivity status</li>
                        <li><code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">last_update_time</code> - Last time data was updated from vendor</li>
                      </ul>
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3">When It Runs</h4>
                      <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><strong>Interval-based:</strong> Every 15, 30, or 45 minutes (configurable per vendor)</li>
                        <li>Syncs run at fixed clock times:
                          <ul className="ml-4 mt-1 list-disc">
                            <li>15 min: <code className="bg-background px-1 rounded">:00</code>, <code className="bg-background px-1 rounded">:15</code>, <code className="bg-background px-1 rounded">:30</code>, <code className="bg-background px-1 rounded">:45</code></li>
                            <li>30 min: <code className="bg-background px-1 rounded">:00</code>, <code className="bg-background px-1 rounded">:30</code></li>
                            <li>45 min: <code className="bg-background px-1 rounded">:00</code>, <code className="bg-background px-1 rounded">:45</code></li>
                          </ul>
                        </li>
                        <li>Runs via cron: <code className="bg-background px-1 rounded">lib/cron/liveTelemetrySyncCron.js</code> → <code className="bg-background px-1 rounded">GET /api/cron/sync-live-telemetry</code></li>
                        <li><strong>Respects restricted sync window</strong> (skips syncs during configured hours)</li>
                      </ul>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold">Mode Options</h4>
                      
                      {/* LIST_PLANTS Mode */}
                      <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-900">
                        <h5 className="font-semibold text-green-900 dark:text-green-100 mb-3">
                          <code className="bg-green-100 dark:bg-green-900 px-2 py-1 rounded">LIST_PLANTS</code> Mode (Efficient - Single API Call)
                        </h5>
                        <div className="space-y-3 text-sm text-green-800 dark:text-green-200">
                          <div>
                            <strong>How it works:</strong>
                            <ol className="ml-4 mt-1 list-decimal space-y-1">
                              <li>Calls <code className="bg-green-100 dark:bg-green-900 px-1 rounded">adapter.listPlants()</code> once to get all plants with live telemetry</li>
                              <li>Extracts telemetry fields from each plant&apos;s metadata</li>
                              <li>Updates all plants in database in batches (100 plants per transaction)</li>
                              <li><strong>Most efficient</strong> - single API call for all plants</li>
                            </ol>
                          </div>
                          <div>
                            <strong>Used by:</strong>
                            <ul className="ml-4 mt-1 list-disc">
                              <li>Solarman (when <code className="bg-green-100 dark:bg-green-900 px-1 rounded">listPlants()</code> provides live telemetry)</li>
                              <li>ShineMonitor</li>
                              <li>Default for most vendors</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* PER_PLANT Mode */}
                      <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border border-orange-200 dark:border-orange-900">
                        <h5 className="font-semibold text-orange-900 dark:text-orange-100 mb-3">
                          <code className="bg-orange-100 dark:bg-orange-900 px-2 py-1 rounded">PER_PLANT</code> Mode (Costly - Individual API Calls)
                        </h5>
                        <div className="space-y-3 text-sm text-orange-800 dark:text-orange-200">
                          <div>
                            <strong>How it works:</strong>
                            <ol className="ml-4 mt-1 list-decimal space-y-1">
                              <li>Fetches all active plants from database</li>
                              <li>For each plant, calls <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">adapter.listPlant(vendorPlantId)</code> individually</li>
                              <li>Fetches in batches of 50 plants (parallel API calls)</li>
                              <li>Updates database in batches of 100 plants per transaction</li>
                              <li><strong>More expensive</strong> - one API call per plant, but necessary for some vendors</li>
                            </ol>
                          </div>
                          <div>
                            <strong>Used by:</strong>
                            <ul className="ml-4 mt-1 list-disc">
                              <li>SolarDM (when <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">listPlants()</code> doesn&apos;t provide live telemetry)</li>
                              <li>PVBlink</li>
                              <li>Any vendor where <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">listPlants()</code> doesn&apos;t include telemetry</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Key Differences Summary */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Key Differences Summary</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2 font-semibold">Aspect</th>
                            <th className="text-left p-2 font-semibold">Plant Sync Mode</th>
                            <th className="text-left p-2 font-semibold">Live Telemetry Sync Mode</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="p-2"><strong>Purpose</strong></td>
                            <td className="p-2">Sync plant listing &amp; topology</td>
                            <td className="p-2">Sync live telemetry (power, energy)</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2"><strong>Frequency</strong></td>
                            <td className="p-2">Twice daily (morning/evening)</td>
                            <td className="p-2">Every 15/30/45 minutes</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2"><strong>Fields Updated</strong></td>
                            <td className="p-2"><code className="bg-background px-1 rounded">name</code>, <code className="bg-background px-1 rounded">capacity_kw</code>, <code className="bg-background px-1 rounded">location</code>, <code className="bg-background px-1 rounded">network_status</code>, <code className="bg-background px-1 rounded">vendor_created_date</code>, <code className="bg-background px-1 rounded">start_operating_time</code></td>
                            <td className="p-2"><code className="bg-background px-1 rounded">current_power_kw</code>, <code className="bg-background px-1 rounded">daily_energy_kwh</code>, <code className="bg-background px-1 rounded">monthly_energy_mwh</code>, <code className="bg-background px-1 rounded">yearly_energy_mwh</code>, <code className="bg-background px-1 rounded">total_energy_mwh</code>, <code className="bg-background px-1 rounded">network_status</code>, <code className="bg-background px-1 rounded">last_update_time</code></td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2"><strong>LIST_PLANTS Mode</strong></td>
                            <td className="p-2">Calls <code className="bg-background px-1 rounded">listPlants()</code> twice daily</td>
                            <td className="p-2">Calls <code className="bg-background px-1 rounded">listPlants()</code> every interval</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2"><strong>PER_PLANT Mode</strong></td>
                            <td className="p-2">Calls <code className="bg-background px-1 rounded">listPlants()</code> twice daily only</td>
                            <td className="p-2">Calls <code className="bg-background px-1 rounded">listPlant()</code> for each plant every interval</td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2"><strong>Default for Solarman</strong></td>
                            <td className="p-2"><code className="bg-background px-1 rounded">LIST_PLANTS</code></td>
                            <td className="p-2"><code className="bg-background px-1 rounded">LIST_PLANTS</code></td>
                          </tr>
                          <tr className="border-b">
                            <td className="p-2"><strong>Default for SolarDM</strong></td>
                            <td className="p-2"><code className="bg-background px-1 rounded">PER_PLANT</code></td>
                            <td className="p-2"><code className="bg-background px-1 rounded">PER_PLANT</code></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* How Syncs Work Together */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">How Syncs Work Together</h3>
                    
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3">Scenario 1: Solarman (LIST_PLANTS for both)</h4>
                      <ol className="text-sm text-muted-foreground space-y-2 ml-4 list-decimal">
                        <li><strong>Plant Sync (twice daily):</strong>
                          <ul className="ml-4 mt-1 list-disc">
                            <li>Calls <code className="bg-background px-1 rounded">listPlants()</code> → Gets all plants with topology</li>
                            <li>Upserts to database</li>
                          </ul>
                        </li>
                        <li><strong>Live Telemetry Sync (every 15 min):</strong>
                          <ul className="ml-4 mt-1 list-disc">
                            <li>Calls <code className="bg-background px-1 rounded">listPlants()</code> → Gets all plants with live telemetry</li>
                            <li>Updates telemetry fields in database</li>
                          </ul>
                        </li>
                      </ol>
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3">Scenario 2: SolarDM (PER_PLANT for both)</h4>
                      <ol className="text-sm text-muted-foreground space-y-2 ml-4 list-decimal">
                        <li><strong>Plant Sync (twice daily):</strong>
                          <ul className="ml-4 mt-1 list-disc">
                            <li>Morning (06:00): Calls <code className="bg-background px-1 rounded">listPlants()</code> → Refreshes plant topology</li>
                            <li>Evening (20:00): Calls <code className="bg-background px-1 rounded">listPlants()</code> → Refreshes plant topology</li>
                            <li>Regular cron (15-min): Skips (no API calls)</li>
                          </ul>
                        </li>
                        <li><strong>Live Telemetry Sync (every 15 min):</strong>
                          <ul className="ml-4 mt-1 list-disc">
                            <li>Fetches all active plants from database</li>
                            <li>For each plant: Calls <code className="bg-background px-1 rounded">listPlant(vendorPlantId)</code> → Gets live telemetry</li>
                            <li>Updates telemetry fields in database</li>
                          </ul>
                        </li>
                      </ol>
                    </div>
                  </div>

                  {/* Best Practices */}
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">Best Practices</h3>
                    <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2 ml-4 list-decimal">
                      <li><strong>Use LIST_PLANTS when possible</strong> - Most efficient (single API call)</li>
                      <li><strong>Use PER_PLANT only when necessary</strong> - When vendor doesn&apos;t provide telemetry in <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">listPlants()</code></li>
                      <li><strong>Set appropriate intervals</strong> - 15 min for critical systems, 30-45 min for less critical</li>
                      <li><strong>Configure restricted windows</strong> - Skip syncs during off-peak hours to reduce API load</li>
                      <li><strong>Monitor sync performance</strong> - Check logs for failed syncs and adjust accordingly</li>
                    </ol>
                  </div>

                  {/* Troubleshooting */}
                  <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-900">
                    <h3 className="font-semibold text-red-900 dark:text-red-100 mb-3">Troubleshooting</h3>
                    <div className="space-y-3 text-sm text-red-800 dark:text-red-200">
                      <div>
                        <h4 className="font-semibold mb-2">Plant Sync Not Running</h4>
                        <ul className="ml-4 list-disc space-y-1">
                          <li>Check <code className="bg-red-100 dark:bg-red-900 px-1 rounded">plant_sync_mode</code> configuration</li>
                          <li>Verify cron is enabled: <code className="bg-red-100 dark:bg-red-900 px-1 rounded">ENABLE_PLANT_SYNC_CRON=true</code></li>
                          <li>Check vendor <code className="bg-red-100 dark:bg-red-900 px-1 rounded">is_active</code> status</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Live Telemetry Not Updating</h4>
                        <ul className="ml-4 list-disc space-y-1">
                          <li>Check <code className="bg-red-100 dark:bg-red-900 px-1 rounded">telemetry_sync_mode</code> configuration</li>
                          <li>Verify cron is enabled: <code className="bg-red-100 dark:bg-red-900 px-1 rounded">ENABLE_LIVE_TELEMETRY_SYNC_CRON=true</code></li>
                          <li>Check <code className="bg-red-100 dark:bg-red-900 px-1 rounded">telemetry_sync_interval</code> matches current time (syncs at fixed clock times)</li>
                          <li>Verify restricted sync window isn&apos;t blocking syncs</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Too Many API Calls</h4>
                        <ul className="ml-4 list-disc space-y-1">
                          <li>Switch to <code className="bg-red-100 dark:bg-red-900 px-1 rounded">LIST_PLANTS</code> mode if vendor supports it</li>
                          <li>Increase <code className="bg-red-100 dark:bg-red-900 px-1 rounded">telemetry_sync_interval</code> (15 → 30 → 45 minutes)</li>
                          <li>Configure restricted sync window to skip off-peak hours</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Architecture Tab */}
        <TabsContent value="architecture" className="space-y-6">
          <Card className="overflow-hidden">
            <SectionHeader id="architecture" title="Serverless Migration Analysis" icon={Server} />
            {expandedSections.has("architecture") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="space-y-6">
                  {/* Overview */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-6 rounded-lg border border-blue-200 dark:border-blue-900">
                    <h3 className="font-semibold text-lg mb-3">Serverless Migration: Current vs Lambda Architecture</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      This document analyzes the changes required to migrate from the current monolithic Next.js server 
                      (with embedded cron jobs) to a serverless Lambda architecture with separate frontend deployment.
                    </p>
                  </div>

                  {/* Current Architecture */}
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Server className="h-5 w-5" />
                      Current Architecture
                    </h3>
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <div>
                        <strong>Deployment Model:</strong>
                        <ul className="ml-4 list-disc mt-1 space-y-1">
                          <li>Monolithic Next.js application (server + frontend)</li>
                          <li>Custom Node.js server (<code className="bg-background px-1 rounded">server.js</code>)</li>
                          <li>Embedded cron jobs using <code className="bg-background px-1 rounded">node-cron</code></li>
                          <li>Single deployment unit (Next.js SSR + API routes)</li>
                          <li>Long-running process (server stays alive)</li>
                        </ul>
                      </div>
                      <div>
                        <strong>Key Components:</strong>
                        <ul className="ml-4 list-disc mt-1 space-y-1">
                          <li><strong>Server:</strong> <code className="bg-background px-1 rounded">server.js</code> - Custom HTTP server with cron initialization</li>
                          <li><strong>Cron Jobs:</strong> 10 cron jobs running in-process (plant sync, telemetry sync, alerts, WMS site/insolation, disable plants, reset was_online, analytics config mirror, analytics energy snapshot, analytics grid downtime)</li>
                          <li><strong>API Routes:</strong> Next.js API routes (<code className="bg-background px-1 rounded">app/api/</code>)</li>
                          <li><strong>Frontend:</strong> Next.js SSR pages and React components</li>
                          <li><strong>Database:</strong> Supabase (connection pooling via <code className="bg-background px-1 rounded">lib/supabase/pooled.ts</code>)</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Required Changes */}
                  <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border border-orange-200 dark:border-orange-900">
                    <h3 className="font-semibold text-orange-900 dark:text-orange-100 mb-3 flex items-center gap-2">
                      <RefreshCw className="h-5 w-5" />
                      Required Changes for Serverless Migration
                    </h3>
                    <div className="space-y-4 text-sm text-orange-800 dark:text-orange-200">
                      
                      {/* 1. Cron Jobs */}
                      <div>
                        <h4 className="font-semibold mb-2">1. Cron Jobs → Event-Driven Functions</h4>
                        <div className="ml-4 space-y-2">
                          <p><strong>Current:</strong> 9 cron jobs running in-process via <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">node-cron</code></p>
                          <p><strong>Required Changes:</strong></p>
                          <ul className="ml-4 list-disc space-y-1">
                            <li>Replace <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">node-cron</code> with AWS EventBridge Rules (or CloudWatch Events)</li>
                            <li>Create separate Lambda function for each cron job:
                              <ul className="ml-4 list-disc mt-1">
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">lambda-plant-sync</code> (triggered every 15 min)</li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">lambda-telemetry-sync</code> (triggered every 15 min)</li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">lambda-alert-sync</code> (triggered every 15 min)</li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">lambda-wms-site-sync</code> (triggered twice daily)</li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">lambda-wms-insolation-sync</code> (triggered daily at 6 AM IST)</li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">lambda-disable-plants</code> (triggered daily at 2 AM IST)</li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">lambda-analytics-config-mirror</code> (triggered daily)</li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">lambda-analytics-snapshot</code> (triggered daily at 10 PM IST)</li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">lambda-analytics-grid-downtime</code> (triggered daily at ~10:15 PM IST)</li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">lambda-reset-was-online</code> (triggered daily at 12:05 AM IST)</li>
                              </ul>
                            </li>
                            <li>Each Lambda function imports and calls the existing service functions (<code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">syncAllPlants()</code>, <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">syncAllLiveTelemetry()</code>, etc.)</li>
                            <li>Remove <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">server.js</code> cron initialization logic</li>
                            <li>Remove <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">lib/cron/*.js</code> files (or convert to Lambda handlers)</li>
                          </ul>
                        </div>
                      </div>

                      {/* 2. API Routes */}
                      <div>
                        <h4 className="font-semibold mb-2">2. API Routes → Lambda Functions</h4>
                        <div className="ml-4 space-y-2">
                          <p><strong>Current:</strong> Next.js API routes in <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">app/api/</code></p>
                          <p><strong>Required Changes:</strong></p>
                          <ul className="ml-4 list-disc space-y-1">
                            <li>Convert each API route to a Lambda function handler</li>
                            <li>Use API Gateway or AWS Lambda Function URLs for HTTP endpoints</li>
                            <li>Maintain existing route structure:
                              <ul className="ml-4 list-disc mt-1">
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">/api/vendors</code> → Lambda function</li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">/api/plants</code> → Lambda function</li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">/api/alerts</code> → Lambda function</li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">/api/cron/*</code> → EventBridge-triggered Lambdas</li>
                                <li>All other API routes → Individual Lambda functions</li>
                              </ul>
                            </li>
                            <li>Use AWS SAM, Serverless Framework, or CDK for infrastructure as code</li>
                            <li>Configure CORS for frontend access</li>
                          </ul>
                        </div>
                      </div>

                      {/* 3. Frontend */}
                      <div>
                        <h4 className="font-semibold mb-2">3. Frontend → Static Site + API Gateway</h4>
                        <div className="ml-4 space-y-2">
                          <p><strong>Current:</strong> Next.js SSR with API routes</p>
                          <p><strong>Required Changes:</strong></p>
                          <ul className="ml-4 list-disc space-y-1">
                            <li>Convert to static export or deploy to separate hosting:
                              <ul className="ml-4 list-disc mt-1">
                                <li>Option A: Next.js static export → S3 + CloudFront</li>
                                <li>Option B: Keep Next.js but deploy frontend separately (Vercel, Netlify, etc.)</li>
                                <li>Option C: Use Next.js standalone build with minimal server</li>
                              </ul>
                            </li>
                            <li>Update API base URL in frontend to point to API Gateway/Lambda URLs</li>
                            <li>Remove server-side rendering dependencies (or use ISR/SSG only)</li>
                            <li>Handle authentication cookies across domains (CORS + cookie settings)</li>
                            <li>Update environment variables for frontend build</li>
                          </ul>
                        </div>
                      </div>

                      {/* 4. Database Connections */}
                      <div>
                        <h4 className="font-semibold mb-2">4. Database Connection Pooling</h4>
                        <div className="ml-4 space-y-2">
                          <p><strong>Current:</strong> Connection pooling via <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">lib/supabase/pooled.ts</code> (10 connections)</p>
                          <p><strong>Required Changes:</strong></p>
                          <ul className="ml-4 list-disc space-y-1">
                            <li>Lambda has connection limits (1000 concurrent executions)</li>
                            <li>Each Lambda invocation creates new connections (no persistent pool)</li>
                            <li><strong>Solutions:</strong>
                              <ul className="ml-4 list-disc mt-1">
                                <li>Use RDS Proxy (if using RDS) or Supabase connection pooling</li>
                                <li>Implement connection reuse within Lambda execution context (warm starts)</li>
                                <li>Use Supabase&apos;s built-in connection pooling (pgBouncer)</li>
                                <li>Consider using Supabase Edge Functions instead of Lambda for database-heavy operations</li>
                              </ul>
                            </li>
                            <li>Monitor connection count and implement connection limits</li>
                            <li>Add connection timeout handling</li>
                          </ul>
                        </div>
                      </div>

                      {/* 5. State Management */}
                      <div>
                        <h4 className="font-semibold mb-2">5. State Management (Stateless Architecture)</h4>
                        <div className="ml-4 space-y-2">
                          <p><strong>Current:</strong> In-memory state for cron jobs (<code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">let cronJob = null</code>)</p>
                          <p><strong>Required Changes:</strong></p>
                          <ul className="ml-4 list-disc space-y-1">
                            <li>Remove all in-memory state (Lambda is stateless)</li>
                            <li>Store state in external systems:
                              <ul className="ml-4 list-disc mt-1">
                                <li>Database (Supabase) for persistent state</li>
                                <li>DynamoDB for temporary state (if needed)</li>
                                <li>ElastiCache/Redis for shared state (if needed)</li>
                              </ul>
                            </li>
                            <li>Use Lambda execution context for temporary state (only during single invocation)</li>
                            <li>Remove singleton patterns that rely on persistent state</li>
                          </ul>
                        </div>
                      </div>

                      {/* 6. Long-Running Operations */}
                      <div>
                        <h4 className="font-semibold mb-2">6. Long-Running Operations</h4>
                        <div className="ml-4 space-y-2">
                          <p><strong>Current:</strong> No timeout limits (server runs indefinitely)</p>
                          <p><strong>Required Changes:</strong></p>
                          <ul className="ml-4 list-disc space-y-1">
                            <li>Lambda has 15-minute timeout limit</li>
                            <li><strong>Solutions for long-running syncs:</strong>
                              <ul className="ml-4 list-disc mt-1">
                                <li>Use AWS Step Functions for orchestration (chaining multiple Lambdas)</li>
                                <li>Break large syncs into smaller batches (process 100 plants per Lambda invocation)</li>
                                <li>Use SQS + Lambda for async processing (queue-based)</li>
                                <li>Use ECS Fargate for truly long-running tasks (if needed)</li>
                              </ul>
                            </li>
                            <li>Current syncs that might exceed 15 min:
                              <ul className="ml-4 list-disc mt-1">
                                <li>Plant sync (if many vendors/plants)</li>
                                <li>Analytics snapshot (processes all plants)</li>
                                <li>WMS insolation sync (100-day backfill)</li>
                              </ul>
                            </li>
                          </ul>
                        </div>
                      </div>

                      {/* 7. Environment Variables */}
                      <div>
                        <h4 className="font-semibold mb-2">7. Environment Variables & Secrets</h4>
                        <div className="ml-4 space-y-2">
                          <p><strong>Current:</strong> Environment variables in <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">.env.local</code> or deployment environment</p>
                          <p><strong>Required Changes:</strong></p>
                          <ul className="ml-4 list-disc space-y-1">
                            <li>Configure environment variables per Lambda function (not shared)</li>
                            <li>Use AWS Secrets Manager for sensitive data (API keys, database passwords)</li>
                            <li>Use AWS Systems Manager Parameter Store for non-sensitive config</li>
                            <li>Update Lambda function configurations via infrastructure as code</li>
                            <li>Frontend environment variables must be set at build time (not runtime)</li>
                          </ul>
                        </div>
                      </div>

                      {/* 8. File Structure */}
                      <div>
                        <h4 className="font-semibold mb-2">8. Project Structure & Build</h4>
                        <div className="ml-4 space-y-2">
                          <p><strong>Current:</strong> Monolithic Next.js app</p>
                          <p><strong>Required Changes:</strong></p>
                          <ul className="ml-4 list-disc space-y-1">
                            <li>Split into separate projects:
                              <ul className="ml-4 list-disc mt-1">
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">frontend/</code> - Next.js static export or separate deployment</li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">lambda/</code> - Individual Lambda functions</li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">shared/</code> - Shared code (adapters, services, types)</li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">infrastructure/</code> - CDK/SAM/Serverless config</li>
                              </ul>
                            </li>
                            <li>Use Lambda Layers for shared dependencies (reduce bundle size)</li>
                            <li>Optimize Lambda bundle size (tree-shaking, exclude unused dependencies)</li>
                            <li>Create separate build processes for frontend and Lambdas</li>
                          </ul>
                        </div>
                      </div>

                      {/* 9. Cold Starts */}
                      <div>
                        <h4 className="font-semibold mb-2">9. Cold Start Optimization</h4>
                        <div className="ml-4 space-y-2">
                          <p><strong>Issue:</strong> Lambda cold starts can add 1-5 seconds latency</p>
                          <p><strong>Required Changes:</strong></p>
                          <ul className="ml-4 list-disc space-y-1">
                            <li>Use Lambda Provisioned Concurrency for critical functions (eliminates cold starts)</li>
                            <li>Optimize Lambda initialization:
                              <ul className="ml-4 list-disc mt-1">
                                <li>Lazy load heavy dependencies</li>
                                <li>Initialize database connections outside handler (reuse in warm starts)</li>
                                <li>Minimize bundle size</li>
                              </ul>
                            </li>
                            <li>Use Lambda SnapStart (Java) or similar optimizations</li>
                            <li>Keep frequently-used functions warm (scheduled ping)</li>
                          </ul>
                        </div>
                      </div>

                      {/* 10. Monitoring & Logging */}
                      <div>
                        <h4 className="font-semibold mb-2">10. Monitoring & Logging</h4>
                        <div className="ml-4 space-y-2">
                          <p><strong>Current:</strong> Application logs + New Relic APM</p>
                          <p><strong>Required Changes:</strong></p>
                          <ul className="ml-4 list-disc space-y-1">
                            <li>Use CloudWatch Logs for Lambda logs (automatic)</li>
                            <li>Use CloudWatch Metrics for Lambda performance</li>
                            <li>Configure X-Ray for distributed tracing (if needed)</li>
                            <li>Update New Relic integration for Lambda (if keeping)</li>
                            <li>Set up CloudWatch Alarms for errors and timeouts</li>
                            <li>Configure log retention policies</li>
                          </ul>
                        </div>
                      </div>

                      {/* 11. Authentication & Sessions */}
                      <div>
                        <h4 className="font-semibold mb-2">11. Authentication & Session Management</h4>
                        <div className="ml-4 space-y-2">
                          <p><strong>Current:</strong> HTTP-only cookies with base64-encoded session</p>
                          <p><strong>Required Changes:</strong></p>
                          <ul className="ml-4 list-disc space-y-1">
                            <li>Maintain cookie-based authentication (works with API Gateway)</li>
                            <li>Configure CORS properly for cross-domain cookies</li>
                            <li>Ensure cookie domain/path settings work with API Gateway</li>
                            <li>Consider using JWT tokens stored in cookies (more stateless)</li>
                            <li>Use API Gateway authorizers if needed (Lambda authorizer)</li>
                          </ul>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Pros and Cons */}
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">Pros and Cons Analysis</h3>
                    
                    {/* Current Architecture Pros */}
                    <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-900">
                      <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3">✅ Current Architecture (Monolithic) - Pros</h4>
                      <ul className="text-sm text-green-800 dark:text-green-200 space-y-2 ml-4 list-disc">
                        <li><strong>Simplicity:</strong> Single deployment unit, easier to manage</li>
                        <li><strong>State Management:</strong> In-memory state for cron jobs (no external dependencies)</li>
                        <li><strong>Connection Pooling:</strong> Persistent database connections (efficient)</li>
                        <li><strong>No Cold Starts:</strong> Server stays warm, consistent performance</li>
                        <li><strong>Long-Running Tasks:</strong> No timeout limits for sync operations</li>
                        <li><strong>Cost Predictability:</strong> Fixed server costs (if using dedicated server)</li>
                        <li><strong>Easier Debugging:</strong> Single process, easier to trace issues</li>
                        <li><strong>Next.js Integration:</strong> Seamless SSR + API routes in one app</li>
                        <li><strong>Development Experience:</strong> Single <code className="bg-green-100 dark:bg-green-900 px-1 rounded">npm run dev</code> command</li>
                        <li><strong>Shared Code:</strong> No code duplication between frontend and backend</li>
                      </ul>
                    </div>

                    {/* Current Architecture Cons */}
                    <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-900">
                      <h4 className="font-semibold text-red-900 dark:text-red-100 mb-3">❌ Current Architecture (Monolithic) - Cons</h4>
                      <ul className="text-sm text-red-800 dark:text-red-200 space-y-2 ml-4 list-disc">
                        <li><strong>Scaling:</strong> Vertical scaling only (need larger server for more load)</li>
                        <li><strong>Resource Waste:</strong> Server runs 24/7 even during low traffic</li>
                        <li><strong>Single Point of Failure:</strong> Server crash affects all functionality</li>
                        <li><strong>Cost:</strong> Pay for server even when idle (if using dedicated server)</li>
                        <li><strong>Deployment:</strong> Full application restart for any change</li>
                        <li><strong>Resource Limits:</strong> Limited by server capacity (CPU, memory)</li>
                        <li><strong>Geographic Distribution:</strong> Single region deployment (higher latency for distant users)</li>
                        <li><strong>Maintenance:</strong> Server patching and updates require downtime</li>
                      </ul>
                    </div>

                    {/* Serverless Pros */}
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">✅ Serverless Architecture (Lambda) - Pros</h4>
                      <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2 ml-4 list-disc">
                        <li><strong>Auto-Scaling:</strong> Automatically scales to handle traffic spikes</li>
                        <li><strong>Cost Efficiency:</strong> Pay only for actual execution time (no idle costs)</li>
                        <li><strong>High Availability:</strong> Built-in redundancy across availability zones</li>
                        <li><strong>Independent Scaling:</strong> Each function scales independently</li>
                        <li><strong>Geographic Distribution:</strong> Deploy Lambdas in multiple regions (lower latency)</li>
                        <li><strong>Fault Isolation:</strong> One function failure doesn&apos;t affect others</li>
                        <li><strong>Granular Deployment:</strong> Deploy individual functions without full restart</li>
                        <li><strong>Managed Infrastructure:</strong> AWS handles server management, patching, monitoring</li>
                        <li><strong>Event-Driven:</strong> Perfect for cron jobs (EventBridge integration)</li>
                        <li><strong>Frontend Flexibility:</strong> Deploy frontend separately (S3, Vercel, Netlify, etc.)</li>
                        <li><strong>Resource Efficiency:</strong> Right-sized functions (no over-provisioning)</li>
                      </ul>
                    </div>

                    {/* Serverless Cons */}
                    <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border border-orange-200 dark:border-orange-900">
                      <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-3">❌ Serverless Architecture (Lambda) - Cons</h4>
                      <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-2 ml-4 list-disc">
                        <li><strong>Cold Starts:</strong> 1-5 second latency on first invocation (can be mitigated with provisioned concurrency)</li>
                        <li><strong>Timeout Limits:</strong> 15-minute maximum execution time (requires refactoring long-running tasks)</li>
                        <li><strong>Connection Management:</strong> No persistent connection pooling (need RDS Proxy or connection reuse)</li>
                        <li><strong>Complexity:</strong> More moving parts (Lambda, API Gateway, EventBridge, etc.)</li>
                        <li><strong>Debugging:</strong> Distributed system, harder to trace issues across functions</li>
                        <li><strong>Cost at Scale:</strong> Can be expensive at high request volumes (pay per invocation)</li>
                        <li><strong>Vendor Lock-in:</strong> Tied to AWS ecosystem (Lambda, EventBridge, API Gateway)</li>
                        <li><strong>State Management:</strong> Stateless by design (need external storage for state)</li>
                        <li><strong>Local Development:</strong> Harder to test locally (need SAM Local or similar)</li>
                        <li><strong>Bundle Size Limits:</strong> 50MB zipped, 250MB unzipped (may need Lambda Layers)</li>
                        <li><strong>Concurrent Execution Limits:</strong> Default 1000 concurrent executions per region</li>
                        <li><strong>Learning Curve:</strong> Team needs to learn AWS Lambda, API Gateway, EventBridge</li>
                      </ul>
                    </div>
                  </div>

                  {/* Migration Strategy */}
                  <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-900">
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">Migration Strategy Recommendations</h3>
                    <div className="space-y-3 text-sm text-purple-800 dark:text-purple-200">
                      <div>
                        <h4 className="font-semibold mb-2">Phased Approach (Recommended)</h4>
                        <ol className="ml-4 list-decimal space-y-1">
                          <li><strong>Phase 1:</strong> Migrate cron jobs first (low risk, high value)
                            <ul className="ml-4 list-disc mt-1">
                              <li>Convert cron jobs to EventBridge-triggered Lambdas</li>
                              <li>Keep API routes and frontend on current server</li>
                              <li>Test thoroughly before proceeding</li>
                            </ul>
                          </li>
                          <li><strong>Phase 2:</strong> Migrate API routes to Lambda
                            <ul className="ml-4 list-disc mt-1">
                              <li>Start with non-critical endpoints</li>
                              <li>Use API Gateway for HTTP routing</li>
                              <li>Update frontend to use new API endpoints</li>
                            </ul>
                          </li>
                          <li><strong>Phase 3:</strong> Migrate frontend to static hosting
                            <ul className="ml-4 list-disc mt-1">
                              <li>Convert to static export or deploy separately</li>
                              <li>Update API base URLs</li>
                              <li>Test end-to-end</li>
                            </ul>
                          </li>
                        </ol>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Hybrid Approach (Alternative)</h4>
                        <ul className="ml-4 list-disc space-y-1">
                          <li>Keep current server for API routes (familiar, works well)</li>
                          <li>Migrate only cron jobs to Lambda (best of both worlds)</li>
                          <li>Deploy frontend separately (S3 + CloudFront or Vercel)</li>
                          <li>Reduces migration risk while gaining some serverless benefits</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">When to Choose Serverless</h4>
                        <ul className="ml-4 list-disc space-y-1">
                          <li>Traffic is unpredictable or has spikes</li>
                          <li>Cost optimization is critical (pay-per-use)</li>
                          <li>Need multi-region deployment</li>
                          <li>Team is comfortable with AWS ecosystem</li>
                          <li>Willing to invest in refactoring long-running tasks</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">When to Stay Monolithic</h4>
                        <ul className="ml-4 list-disc space-y-1">
                          <li>Traffic is consistent and predictable</li>
                          <li>Current server costs are acceptable</li>
                          <li>Long-running syncs are critical (exceed 15 min)</li>
                          <li>Team prefers simplicity over scalability</li>
                          <li>Connection pooling is critical (many DB connections)</li>
                          <li>Cold start latency is unacceptable</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Cost Comparison */}
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">Cost Comparison (Rough Estimates)</h3>
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <div>
                        <strong>Current (Monolithic):</strong>
                        <ul className="ml-4 list-disc mt-1">
                          <li>EC2 instance (t3.medium): ~$30-50/month</li>
                          <li>Or Vercel Pro: ~$20/month + usage</li>
                          <li>Fixed cost regardless of traffic</li>
                        </ul>
                      </div>
                      <div>
                        <strong>Serverless (Lambda):</strong>
                        <ul className="ml-4 list-disc mt-1">
                          <li>Lambda: $0.20 per 1M requests + $0.0000166667 per GB-second</li>
                          <li>API Gateway: $3.50 per 1M requests</li>
                          <li>EventBridge: $1.00 per 1M custom events</li>
                          <li>CloudWatch Logs: $0.50 per GB ingested</li>
                          <li><strong>Low traffic:</strong> ~$5-10/month (very cheap)</li>
                          <li><strong>High traffic:</strong> Can exceed server costs (pay per use)</li>
                        </ul>
                      </div>
                      <p className="text-xs italic mt-2">
                        <strong>Note:</strong> Actual costs depend heavily on traffic patterns, function execution time, and data transfer.
                        Use AWS Cost Calculator for accurate estimates.
                      </p>
                    </div>
                  </div>

                  {/* Frontend Deployment Recommendations */}
                  <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-900">
                    <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-3">Frontend Deployment Recommendations</h3>
                    <div className="space-y-4 text-sm text-indigo-800 dark:text-indigo-200">
                      
                      <div>
                        <h4 className="font-semibold mb-2">Option 1: Vercel (Recommended for Next.js)</h4>
                        <div className="ml-4 space-y-2">
                          <div><strong>Pros:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Native Next.js support (zero-config)</li>
                              <li>Automatic CI/CD from GitHub</li>
                              <li>Edge functions for low latency</li>
                              <li>Built-in analytics and monitoring</li>
                              <li>Free tier: 100 GB bandwidth/month</li>
                              <li>Pro tier: $20/month (unlimited bandwidth)</li>
                            </ul>
                          </div>
                          <div><strong>Setup:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Connect GitHub repository</li>
                              <li>Set environment variables: <code className="bg-indigo-100 dark:bg-indigo-900 px-1 rounded">NEXT_PUBLIC_API_BASE_URL</code></li>
                              <li>Deploy automatically on push to main</li>
                              <li>Custom domain support</li>
                            </ul>
                          </div>
                          <div><strong>Configuration:</strong>
                            <div className="ml-4 mt-1 font-mono text-xs bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded">
                              vercel.json:<br/>
                              {'{'}<br/>
                              &nbsp;&nbsp;&quot;buildCommand&quot;: &quot;npm run build&quot;,<br/>
                              &nbsp;&nbsp;&quot;outputDirectory&quot;: &quot;.next&quot;,<br/>
                              &nbsp;&nbsp;&quot;framework&quot;: &quot;nextjs&quot;<br/>
                              {'}'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Option 2: Netlify</h4>
                        <div className="ml-4 space-y-2">
                          <div><strong>Pros:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Excellent Next.js support</li>
                              <li>Free tier: 100 GB bandwidth/month</li>
                              <li>Pro tier: $19/month (unlimited bandwidth)</li>
                              <li>Built-in form handling and serverless functions</li>
                              <li>Easy custom domain setup</li>
                            </ul>
                          </div>
                          <div><strong>Setup:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Connect GitHub repository</li>
                              <li>Set build command: <code className="bg-indigo-100 dark:bg-indigo-900 px-1 rounded">npm run build</code></li>
                              <li>Set publish directory: <code className="bg-indigo-100 dark:bg-indigo-900 px-1 rounded">.next</code></li>
                              <li>Set environment variables in Netlify dashboard</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Option 3: AWS S3 + CloudFront</h4>
                        <div className="ml-4 space-y-2">
                          <div><strong>Pros:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Full AWS ecosystem integration</li>
                              <li>Global CDN (CloudFront)</li>
                              <li>Very low cost (~$4-5/month for moderate traffic)</li>
                              <li>High scalability</li>
                            </ul>
                          </div>
                          <div><strong>Cons:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>More setup complexity</li>
                              <li>Requires static export or separate Next.js server</li>
                              <li>Manual CI/CD setup</li>
                            </ul>
                          </div>
                          <div><strong>Setup:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Build static export: <code className="bg-indigo-100 dark:bg-indigo-900 px-1 rounded">next build && next export</code></li>
                              <li>Upload to S3 bucket</li>
                              <li>Configure CloudFront distribution</li>
                              <li>Set up GitHub Actions for CI/CD</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Option 4: Cloudflare Pages</h4>
                        <div className="ml-4 space-y-2">
                          <div><strong>Pros:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Free tier: Unlimited bandwidth</li>
                              <li>Global edge network</li>
                              <li>Built-in DDoS protection</li>
                              <li>Excellent performance</li>
                            </ul>
                          </div>
                          <div><strong>Setup:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Connect GitHub repository</li>
                              <li>Set build command and output directory</li>
                              <li>Configure environment variables</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="bg-indigo-100 dark:bg-indigo-900/30 p-3 rounded">
                        <h4 className="font-semibold mb-2">Recommendation: Vercel</h4>
                        <p className="text-xs">
                          For Next.js applications, Vercel provides the best developer experience with zero-config deployment, 
                          automatic CI/CD, and excellent performance. The $20/month Pro tier is cost-effective and provides 
                          unlimited bandwidth, making it ideal for production deployments.
                        </p>
                      </div>

                    </div>
                  </div>

                  {/* Backend Serverless Deployment */}
                  <div className="bg-teal-50 dark:bg-teal-950/20 p-4 rounded-lg border border-teal-200 dark:border-teal-900">
                    <h3 className="font-semibold text-teal-900 dark:text-teal-100 mb-3">Backend Serverless Deployment Strategy</h3>
                    <div className="space-y-4 text-sm text-teal-800 dark:text-teal-200">
                      
                      <div>
                        <h4 className="font-semibold mb-2">AWS Lambda + API Gateway Architecture</h4>
                        <div className="ml-4 space-y-2">
                          <div><strong>API Routes → Lambda Functions:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Each API route becomes a Lambda function</li>
                              <li>Use API Gateway REST API for HTTP routing</li>
                              <li>Configure CORS for frontend access</li>
                              <li>Set up custom authorizers (optional) for authentication</li>
                            </ul>
                          </div>
                          <div><strong>Cron Jobs → EventBridge Rules:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Replace <code className="bg-teal-100 dark:bg-teal-900 px-1 rounded">node-cron</code> with EventBridge Rules</li>
                              <li>Each cron job becomes an EventBridge-triggered Lambda</li>
                              <li>Schedule using cron expressions (supports IST timezone)</li>
                            </ul>
                          </div>
                          <div><strong>Lambda Layers:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Create shared layer for vendor adapters, services, repositories</li>
                              <li>Reduces bundle size for individual functions</li>
                              <li>Easier to update shared code</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Infrastructure as Code Options</h4>
                        <div className="ml-4 space-y-2">
                          <div><strong>Option A: AWS CDK (TypeScript) - Recommended</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Type-safe infrastructure code</li>
                              <li>Excellent IDE support</li>
                              <li>Reusable constructs</li>
                              <li>Best for complex architectures</li>
                            </ul>
                          </div>
                          <div><strong>Option B: Serverless Framework</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Simpler YAML configuration</li>
                              <li>Faster to get started</li>
                              <li>Good for standard Lambda deployments</li>
                            </ul>
                          </div>
                          <div><strong>Option C: AWS SAM</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>YAML-based</li>
                              <li>Good for simple applications</li>
                              <li>Native AWS tooling</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Authentication in Serverless</h4>
                        <div className="ml-4 space-y-2">
                          <div><strong>Keep Cookie-Based Authentication:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Cookies work with API Gateway</li>
                              <li>Configure CORS: <code className="bg-teal-100 dark:bg-teal-900 px-1 rounded">Access-Control-Allow-Credentials: true</code></li>
                              <li>Set cookie: <code className="bg-teal-100 dark:bg-teal-900 px-1 rounded">SameSite=None; Secure</code> for cross-domain</li>
                              <li>Validate session in each Lambda function</li>
                            </ul>
                          </div>
                          <div><strong>Alternative: Lambda Authorizer</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Create separate Lambda authorizer function</li>
                              <li>Validates session before main Lambda execution</li>
                              <li>Returns IAM policy for API Gateway</li>
                              <li>More efficient but adds complexity</li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-2">Environment Variables & Secrets</h4>
                        <div className="ml-4 space-y-2">
                          <div><strong>AWS Secrets Manager:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Store sensitive data (API keys, database passwords)</li>
                              <li>Automatic rotation support</li>
                              <li>Access via IAM roles</li>
                            </ul>
                          </div>
                          <div><strong>AWS Systems Manager Parameter Store:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Store non-sensitive configuration</li>
                              <li>Free tier: 10,000 parameters</li>
                              <li>Hierarchical organization</li>
                            </ul>
                          </div>
                          <div><strong>Lambda Environment Variables:</strong>
                            <ul className="ml-4 list-disc mt-1">
                              <li>Set per-function in infrastructure code</li>
                              <li>Encrypted at rest</li>
                              <li>Accessible via <code className="bg-teal-100 dark:bg-teal-900 px-1 rounded">process.env</code></li>
                            </ul>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Conclusion */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-6 rounded-lg border border-blue-200 dark:border-blue-900">
                    <h3 className="font-semibold text-lg mb-3">Conclusion</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      The decision to migrate to serverless depends on your specific requirements:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                      <li><strong>If cost optimization and auto-scaling are priorities:</strong> Serverless is a good fit</li>
                      <li><strong>If simplicity and predictable performance are priorities:</strong> Current architecture may be better</li>
                      <li><strong>Hybrid approach:</strong> Consider migrating only cron jobs to Lambda while keeping API routes on current server</li>
                      <li><strong>Recommendation:</strong> Start with a phased migration of cron jobs to validate the approach before full migration</li>
                      <li><strong>Frontend:</strong> Deploy to Vercel for best Next.js experience</li>
                      <li><strong>Backend:</strong> Use AWS Lambda + API Gateway + EventBridge for serverless architecture</li>
                      <li><strong>Database:</strong> Migrate configuration data to DynamoDB, keep time-series in Supabase (hybrid approach)</li>
                    </ul>
                  </div>

                  {/* DynamoDB Architecture Analysis */}
                  <div className="mt-8 space-y-6 border-t pt-6">
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-6 rounded-lg border border-green-200 dark:border-green-900">
                      <h3 className="font-semibold text-lg mb-3">DynamoDB Cost-Free Architecture Analysis</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        This section analyzes migrating configuration data to DynamoDB to achieve near-zero database costs 
                        using AWS Free Tier (25 GB storage, 25 read/write units permanently free).
                      </p>
                      <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded border border-blue-200 dark:border-blue-900 text-xs text-muted-foreground">
                        <strong>Grid downtime note:</strong> Grid downtime analytics (100-day rolling daily + total seconds) currently lives in the Analytics Supabase DB (`plant_grid_downtime_readings`) with cumulative totals continuing from the last known baseline. If we ever move this to DynamoDB, mirror the PK (`plant_id`, `reading_date`) and store a running total per plant to avoid recomputing older windows.
                      </div>
                    </div>

                    {/* DynamoDB Free Tier */}
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        DynamoDB Free Tier Benefits
                      </h4>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <ul className="ml-4 list-disc space-y-1">
                          <li><strong>25 GB Storage:</strong> Permanently free (sufficient for configuration data)</li>
                          <li><strong>25 Read Units:</strong> ~200 million reads/month free (on-demand pricing)</li>
                          <li><strong>25 Write Units:</strong> ~200 million writes/month free (on-demand pricing)</li>
                          <li><strong>On-Demand Pricing:</strong> $1.25 per million reads, $1.25 per million writes (very cheap beyond free tier)</li>
                          <li><strong>No Server Management:</strong> Fully managed, auto-scaling</li>
                          <li><strong>Global Tables:</strong> Multi-region replication (optional, paid)</li>
                        </ul>
                      </div>
                    </div>

                    {/* Current Database Tables */}
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3">Current Database Tables (Supabase PostgreSQL)</h4>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        <div>
                          <strong>Main Database (12 tables):</strong>
                          <ul className="ml-4 list-disc mt-1 space-y-1">
                            <li><code className="bg-background px-1 rounded">accounts</code> - Authentication (UUID, ~100-1000 records)</li>
                            <li><code className="bg-background px-1 rounded">organizations</code> - Organizations (~10-100 records)</li>
                            <li><code className="bg-background px-1 rounded">vendors</code> - Vendor configs (~10-50 records)</li>
                            <li><code className="bg-background px-1 rounded">plants</code> - Plant configs (~100-10,000 records)</li>
                            <li><code className="bg-background px-1 rounded">work_orders</code> - Work orders (~100-1,000 records)</li>
                            <li><code className="bg-background px-1 rounded">work_order_plants</code> - Junction table (~1,000-10,000 records)</li>
                            <li><code className="bg-background px-1 rounded">alerts</code> - Alerts (time-series, ~10K-100K records)</li>
                            <li><code className="bg-background px-1 rounded">disabled_plants</code> - Disabled plants (~100-1,000 records)</li>
                            <li><code className="bg-background px-1 rounded">wms_vendors</code> - WMS vendors (~5-20 records)</li>
                            <li><code className="bg-background px-1 rounded">wms_sites</code> - WMS sites (~50-500 records)</li>
                            <li><code className="bg-background px-1 rounded">wms_devices</code> - WMS devices (~100-1,000 records)</li>
                            <li><code className="bg-background px-1 rounded">insolation_readings</code> - Time-series (100-day rolling, ~10K-100K records)</li>
                          </ul>
                        </div>
                        <div>
                          <strong>Analytics Database (5 tables):</strong>
                          <ul className="ml-4 list-disc mt-1 space-y-1">
                            <li><code className="bg-background px-1 rounded">organizations</code> - Mirror (~10-100 records)</li>
                            <li><code className="bg-background px-1 rounded">vendors</code> - Mirror (~10-50 records)</li>
                            <li><code className="bg-background px-1 rounded">plants</code> - Mirror (~100-10,000 records)</li>
                            <li><code className="bg-background px-1 rounded">analytics_snapshot_runs</code> - Snapshot tracking (~100-1,000 records)</li>
                            <li><code className="bg-background px-1 rounded">plant_energy_readings</code> - Time-series (100-day rolling, ~10K-100K records)</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Current PostgreSQL Structure */}
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3">Current PostgreSQL Database Structure</h4>
                      <div className="space-y-3 text-sm text-muted-foreground">
                        <div>
                          <strong>Main Database (12 tables):</strong>
                          <ol className="ml-4 list-decimal space-y-2 mt-1">
                            <li><code className="bg-background px-1 rounded">accounts</code> - Authentication (UUID id, account_type, email, password_hash, org_id, display_name, logo_url, is_active)</li>
                            <li><code className="bg-background px-1 rounded">organizations</code> - Organizations (SERIAL id, name, auto_sync_enabled, sync_interval_minutes)</li>
                            <li><code className="bg-background px-1 rounded">vendors</code> - Vendor configs (SERIAL id, name, vendor_type, credentials JSONB, org_id, tokens, sync configs)</li>
                            <li><code className="bg-background px-1 rounded">plants</code> - Plant configs (SERIAL id, org_id, vendor_id, vendor_plant_id, name, capacity_kw, location JSONB, telemetry fields, is_active)</li>
                            <li><code className="bg-background px-1 rounded">work_orders</code> - Work orders (SERIAL id, title, description, location, org_id, priority, created_by)</li>
                            <li><code className="bg-background px-1 rounded">work_order_plants</code> - Junction table (work_order_id, plant_id, is_active)</li>
                            <li><code className="bg-background px-1 rounded">alerts</code> - Alerts (SERIAL id, plant_id, vendor_id, vendor_alert_id, vendor_plant_id, alert_time, end_time, title, description, severity, status)</li>
                            <li><code className="bg-background px-1 rounded">disabled_plants</code> - Disabled plants snapshot (similar to plants)</li>
                            <li><code className="bg-background px-1 rounded">wms_vendors</code> - WMS vendors (SERIAL id, name, vendor_type, credentials, org_id, tokens)</li>
                            <li><code className="bg-background px-1 rounded">wms_sites</code> - WMS sites (SERIAL id, wms_vendor_id, org_id, vendor_site_id, site_name, address, location, elevation, status, metadata)</li>
                            <li><code className="bg-background px-1 rounded">wms_devices</code> - WMS devices (SERIAL id, wms_site_id, vendor_device_id, device_name, mac_address, serial_no, metadata)</li>
                            <li><code className="bg-background px-1 rounded">insolation_readings</code> - Time-series (SERIAL id, wms_device_id, reading_date, insolation_value, reading_count, metadata)</li>
                          </ol>
                        </div>
                        <div>
                          <strong>Analytics Database (5 tables):</strong>
                          <ol className="ml-4 list-decimal space-y-1 mt-1">
                            <li><code className="bg-background px-1 rounded">organizations</code> - Mirror with config hash</li>
                            <li><code className="bg-background px-1 rounded">vendors</code> - Mirror with config hash</li>
                            <li><code className="bg-background px-1 rounded">plants</code> - Mirror</li>
                            <li><code className="bg-background px-1 rounded">analytics_snapshot_runs</code> - Snapshot tracking</li>
                            <li><code className="bg-background px-1 rounded">plant_energy_readings</code> - Time-series (100-day retention)</li>
                          </ol>
                        </div>
                        <div>
                          <strong>Key Relationships:</strong>
                          <ul className="ml-4 list-disc mt-1">
                            <li>accounts.org_id → organizations.id</li>
                            <li>vendors.org_id → organizations.id</li>
                            <li>plants.org_id → organizations.id, plants.vendor_id → vendors.id</li>
                            <li>alerts.plant_id → plants.id, alerts.vendor_id → vendors.id</li>
                            <li>work_order_plants.work_order_id → work_orders.id, work_order_plants.plant_id → plants.id</li>
                            <li>wms_sites.wms_vendor_id → wms_vendors.id, wms_sites.org_id → organizations.id</li>
                            <li>wms_devices.wms_site_id → wms_sites.id</li>
                            <li>insolation_readings.wms_device_id → wms_devices.id</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* DynamoDB Table Design */}
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">Proposed DynamoDB Table Structure</h4>
                      <div className="space-y-6 text-sm text-blue-800 dark:text-blue-200">
                        
                        {/* Table 1: Config Data */}
                        <div>
                          <h5 className="font-semibold mb-3">Table 1: <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">woms-config</code> (Single Table Design)</h5>
                          <p className="mb-3">Stores all configuration data: organizations, vendors, plants, accounts, work orders, WMS vendors/sites/devices, disabled plants</p>
                          
                          <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded mb-3">
                            <div className="font-semibold mb-2">Primary Key Structure:</div>
                            <div className="space-y-2">
                              <div>
                                <strong>Partition Key (PK):</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">entity_type</code>
                                <div className="ml-4 mt-1 text-xs">
                                  Format: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">ENTITY_TYPE</code><br/>
                                  Examples: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">ORG</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">VENDOR</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PLANT</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">ACCOUNT</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">WORK_ORDER</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">WMS_VENDOR</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">WMS_SITE</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">WMS_DEVICE</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">DISABLED_PLANT</code>
                                </div>
                              </div>
                              <div>
                                <strong>Sort Key (SK):</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">entity_id</code>
                                <div className="ml-4 mt-1 text-xs">
                                  Format: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">ID</code> (numeric ID as string, or UUID)<br/>
                                  Examples: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">1</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">123</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">d816d896-b60b-4e24-884c-785926d6c2c0</code>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <strong>GSI 1: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">org-index</code></strong>
                              <div className="ml-4 mt-1 text-xs space-y-1">
                                <div><strong>GSI1PK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">org_id</code> (INTEGER as string, e.g., <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">1</code>)</div>
                                <div><strong>GSI1SK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">entity_type#entity_id</code> (e.g., <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PLANT#123</code>)</div>
                                <div><strong>Purpose:</strong> Query all entities (plants, vendors, work orders, WMS) for an organization</div>
                                <div><strong>Query Pattern:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">Query GSI1 where GSI1PK = org_id</code></div>
                              </div>
                            </div>

                            <div>
                              <strong>GSI 2: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">vendor-index</code></strong>
                              <div className="ml-4 mt-1 text-xs space-y-1">
                                <div><strong>GSI2PK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">vendor_id</code> (INTEGER as string)</div>
                                <div><strong>GSI2SK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">entity_type#entity_id</code> (e.g., <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PLANT#456</code>)</div>
                                <div><strong>Purpose:</strong> Query all plants for a vendor</div>
                                <div><strong>Query Pattern:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">Query GSI2 where GSI2PK = vendor_id AND GSI2SK begins_with &quot;PLANT#&quot;</code></div>
                              </div>
                            </div>

                            <div>
                              <strong>GSI 3: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">email-index</code></strong>
                              <div className="ml-4 mt-1 text-xs space-y-1">
                                <div><strong>GSI3PK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">email</code> (TEXT, e.g., <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">admin@woms.com</code>)</div>
                                <div><strong>GSI3SK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">ACCOUNT#entity_id</code> (e.g., <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">ACCOUNT#d816d896-b60b-4e24-884c-785926d6c2c0</code>)</div>
                                <div><strong>Purpose:</strong> Query account by email (for login authentication)</div>
                                <div><strong>Query Pattern:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">Query GSI3 where GSI3PK = email</code></div>
                              </div>
                            </div>

                            <div>
                              <strong>GSI 4: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">wms-vendor-index</code></strong>
                              <div className="ml-4 mt-1 text-xs space-y-1">
                                <div><strong>GSI4PK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">wms_vendor_id</code> (INTEGER as string)</div>
                                <div><strong>GSI4SK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">entity_type#entity_id</code> (e.g., <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">WMS_SITE#789</code>)</div>
                                <div><strong>Purpose:</strong> Query all sites/devices for a WMS vendor</div>
                                <div><strong>Query Pattern:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">Query GSI4 where GSI4PK = wms_vendor_id</code></div>
                              </div>
                            </div>

                            <div>
                              <strong>GSI 5: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">wms-site-index</code></strong>
                              <div className="ml-4 mt-1 text-xs space-y-1">
                                <div><strong>GSI5PK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">wms_site_id</code> (INTEGER as string)</div>
                                <div><strong>GSI5SK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">WMS_DEVICE#entity_id</code></div>
                                <div><strong>Purpose:</strong> Query all devices for a WMS site</div>
                                <div><strong>Query Pattern:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">Query GSI5 where GSI5PK = wms_site_id</code></div>
                              </div>
                            </div>

                            <div>
                              <strong>GSI 6: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">vendor-plant-unique-index</code></strong>
                              <div className="ml-4 mt-1 text-xs space-y-1">
                                <div><strong>GSI6PK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">vendor_id</code> (INTEGER as string)</div>
                                <div><strong>GSI6SK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">vendor_plant_id</code> (TEXT, e.g., <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">STATION123</code>)</div>
                                <div><strong>Purpose:</strong> Enforce unique constraint (vendor_id, vendor_plant_id) and lookup plant by vendor_plant_id</div>
                                <div><strong>Query Pattern:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">Query GSI6 where GSI6PK = vendor_id AND GSI6SK = vendor_plant_id</code></div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 bg-blue-100 dark:bg-blue-900/30 p-3 rounded">
                            <div className="font-semibold mb-2">Item Examples:</div>
                            <div className="text-xs space-y-2 font-mono">
                              <div>
                                <strong>Organization:</strong><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PK: ORG</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">SK: 1</code><br/>
                                Attributes: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">name</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">auto_sync_enabled</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">sync_interval_minutes</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">created_at</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">updated_at</code>
                              </div>
                              <div>
                                <strong>Vendor:</strong><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PK: VENDOR</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">SK: 5</code><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI1PK: 1</code> (org_id), <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI1SK: VENDOR#5</code><br/>
                                Attributes: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">name</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">vendor_type</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">credentials</code> (JSON), <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">org_id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">access_token</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">token_expires_at</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">telemetry_sync_mode</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">telemetry_sync_interval</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">plant_sync_time_ist</code>, etc.
                              </div>
                              <div>
                                <strong>Plant:</strong><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PK: PLANT</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">SK: 123</code><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI1PK: 1</code> (org_id), <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI1SK: PLANT#123</code><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI2PK: 5</code> (vendor_id), <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI2SK: PLANT#123</code><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI6PK: 5</code> (vendor_id), <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI6SK: STATION123</code> (vendor_plant_id)<br/>
                                Attributes: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">name</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">vendor_plant_id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">org_id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">vendor_id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">capacity_kw</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">location</code> (JSON), <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">current_power_kw</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">daily_energy_kwh</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">network_status</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">is_active</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">was_online_today</code>, etc.
                              </div>
                              <div>
                                <strong>Account:</strong><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PK: ACCOUNT</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">SK: d816d896-b60b-4e24-884c-785926d6c2c0</code><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI1PK: 1</code> (org_id, nullable), <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI1SK: ACCOUNT#d816d896-b60b-4e24-884c-785926d6c2c0</code><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI3PK: admin@woms.com</code> (email), <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI3SK: ACCOUNT#d816d896-b60b-4e24-884c-785926d6c2c0</code><br/>
                                Attributes: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">account_type</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">email</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">password_hash</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">org_id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">display_name</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">logo_url</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">is_active</code>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Table 2: Time-Series Data */}
                        <div>
                          <h5 className="font-semibold mb-3">Table 2: <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">woms-timeseries</code> (Time-Series Data)</h5>
                          <p className="mb-3">Stores alerts, insolation readings, plant energy readings (with TTL for auto-cleanup)</p>
                          
                          <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded mb-3">
                            <div className="font-semibold mb-2">Primary Key Structure:</div>
                            <div className="space-y-2">
                              <div>
                                <strong>Partition Key (PK):</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">entity_type#entity_id</code>
                                <div className="ml-4 mt-1 text-xs">
                                  Format: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">ENTITY_TYPE#ID</code><br/>
                                  <strong>For Alerts:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PLANT#plant_id</code> (distributes across partitions for 10K+ plants)<br/>
                                  <strong>For Readings:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">DEVICE#device_id</code> or <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PLANT_ENERGY#plant_id</code><br/>
                                  Examples: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PLANT#123</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">DEVICE#456</code>
                                </div>
                              </div>
                              <div>
                                <strong>Sort Key (SK):</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">timestamp</code> or <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">timestamp#unique_id</code>
                                <div className="ml-4 mt-1 text-xs">
                                  Format: ISO 8601 timestamp or date<br/>
                                  <strong>For Alerts:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">alert_time#alert_id</code> (e.g., <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">2025-12-08T14:30:00Z#789</code>) - enables sorting by time, unique per alert<br/>
                                  <strong>For Readings:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">reading_date</code> (e.g., <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">2025-12-08</code>)<br/>
                                  Enables range queries: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">SK BETWEEN start_date AND end_date</code>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <strong>GSI 1: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">date-index</code></strong>
                              <div className="ml-4 mt-1 text-xs space-y-1">
                                <div><strong>GSI1PK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">reading_date</code> (DATE format: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">2025-12-08</code>)</div>
                                <div><strong>GSI1SK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">entity_type#entity_id</code></div>
                                <div><strong>Purpose:</strong> Query all readings/alerts for a specific date across all entities</div>
                                <div><strong>Query Pattern:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">Query GSI1 where GSI1PK = reading_date</code></div>
                              </div>
                            </div>

                            <div>
                              <strong>GSI 2: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">plant-alert-index</code></strong>
                              <div className="ml-4 mt-1 text-xs space-y-1">
                                <div><strong>GSI2PK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">plant_id</code> (INTEGER as string)</div>
                                <div><strong>GSI2SK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">alert_time</code> (ISO 8601 timestamp, DESC order)</div>
                                <div><strong>Purpose:</strong> Query all alerts for a plant, sorted by alert_time descending</div>
                                <div><strong>Query Pattern:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">Query GSI2 where GSI2PK = plant_id AND GSI2SK begins_with &quot;ALERT#&quot;</code></div>
                              </div>
                            </div>

                            <div>
                              <strong>GSI 3: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">vendor-alert-index</code></strong>
                              <div className="ml-4 mt-1 text-xs space-y-1">
                                <div><strong>GSI3PK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">vendor_id#vendor_plant_id</code> (e.g., <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">5#STATION123</code>)</div>
                                <div><strong>GSI3SK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">vendor_alert_id#alert_time</code></div>
                                <div><strong>Purpose:</strong> Deduplicate alerts by (vendor_id, vendor_alert_id, plant_id)</div>
                                <div><strong>Query Pattern:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">Query GSI3 where GSI3PK = vendor_id#vendor_plant_id AND GSI3SK begins_with vendor_alert_id</code></div>
                              </div>
                            </div>

                            <div>
                              <strong>GSI 4: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">alert-id-index</code></strong>
                              <div className="ml-4 mt-1 text-xs space-y-1">
                                <div><strong>GSI4PK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">id</code> (alert_id, INTEGER as string)</div>
                                <div><strong>GSI4SK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PLANT#plant_id</code></div>
                                <div><strong>Purpose:</strong> Direct lookup of alert by ID (for updates/deletes)</div>
                                <div><strong>Query Pattern:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">Query GSI4 where GSI4PK = alert_id</code></div>
                              </div>
                            </div>

                            <div>
                              <strong>TTL Attribute:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">ttl</code>
                              <div className="ml-4 mt-1 text-xs">
                                <div>Unix timestamp (seconds since epoch) for automatic item expiration</div>
                                <div><strong>Insolation readings:</strong> TTL = reading_date + 100 days (auto-cleanup)</div>
                                <div><strong>Alerts:</strong> TTL = alert_time + 365 days (1 year retention)</div>
                                <div><strong>Plant energy readings:</strong> TTL = reading_date + 100 days</div>
                                <div>DynamoDB automatically deletes expired items (no manual cleanup needed)</div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 bg-blue-100 dark:bg-blue-900/30 p-3 rounded">
                            <div className="font-semibold mb-2">Item Examples:</div>
                            <div className="text-xs space-y-2 font-mono">
                              <div>
                                <strong>Alert:</strong><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PK: PLANT#123</code> (plant_id for distribution), <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">SK: 2025-12-08T14:30:00Z#789</code> (alert_time#alert_id)<br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI2PK: 123</code> (plant_id), <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI2SK: 2025-12-08T14:30:00Z#789</code> (same as SK for consistency)<br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI3PK: 5#STATION123</code> (vendor_id#vendor_plant_id), <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI3SK: ALERT123#2025-12-08T14:30:00Z</code> (vendor_alert_id#alert_time)<br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI4PK: 789</code> (alert_id), <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI4SK: PLANT#123</code> (for direct alert lookup by ID)<br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">ttl: 1736359800</code> (alert_time + 365 days)<br/>
                                Attributes: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">id</code> (alert_id), <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">plant_id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">vendor_id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">vendor_alert_id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">vendor_plant_id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">alert_time</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">end_time</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">title</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">description</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">severity</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">status</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">grid_down_seconds</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">grid_down_benefit_kwh</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">created_at</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">updated_at</code>
                              </div>
                              <div>
                                <strong>Insolation Reading:</strong><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PK: DEVICE#456</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">SK: 2025-12-08</code><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI1PK: 2025-12-08</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI1SK: DEVICE#456</code><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">ttl: 1736359800</code> (reading_date + 100 days)<br/>
                                Attributes: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">wms_device_id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">reading_date</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">insolation_value</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">reading_count</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">metadata</code> (JSON)
                              </div>
                              <div>
                                <strong>Plant Energy Reading (Analytics):</strong><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PK: PLANT_ENERGY#123</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">SK: 2025-12-08</code><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI1PK: 2025-12-08</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI1SK: PLANT_ENERGY#123</code><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">ttl: 1736359800</code> (reading_date + 100 days)<br/>
                                Attributes: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">plant_id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">org_id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">vendor_id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">vendor_plant_id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">reading_date</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">daily_energy_kwh</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">monthly_energy_kwh</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">yearly_energy_mwh</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">total_energy_mwh</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">was_online</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">metadata</code> (JSON)
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Table 3: Junction Tables */}
                        <div>
                          <h5 className="font-semibold mb-3">Table 3: <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">woms-junctions</code> (Junction/Relationship Data)</h5>
                          <p className="mb-3">Stores many-to-many relationships: work_order_plants</p>
                          
                          <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded mb-3">
                            <div className="font-semibold mb-2">Primary Key Structure:</div>
                            <div className="space-y-2">
                              <div>
                                <strong>Partition Key (PK):</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">parent_type#parent_id</code>
                                <div className="ml-4 mt-1 text-xs">
                                  Examples: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">WORK_ORDER#100</code>
                                </div>
                              </div>
                              <div>
                                <strong>Sort Key (SK):</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">child_type#child_id</code>
                                <div className="ml-4 mt-1 text-xs">
                                  Examples: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PLANT#123</code>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <strong>GSI 1: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">plant-workorder-index</code></strong>
                            <div className="ml-4 mt-1 text-xs space-y-1">
                              <div><strong>GSI1PK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">child_type#child_id</code> (e.g., <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PLANT#123</code>)</div>
                              <div><strong>GSI1SK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">parent_type#parent_id</code> (e.g., <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">WORK_ORDER#100</code>)</div>
                              <div><strong>Purpose:</strong> Query all work orders for a plant (reverse lookup)</div>
                              <div><strong>Query Pattern:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">Query GSI1 where GSI1PK = PLANT#plant_id AND GSI1SK begins_with &quot;WORK_ORDER#&quot;</code></div>
                              <div><strong>Unique Constraint:</strong> Use conditional write to enforce one active work order per plant (check GSI1 for existing active work order)</div>
                            </div>
                          </div>

                          <div className="mt-4 bg-blue-100 dark:bg-blue-900/30 p-3 rounded">
                            <div className="font-semibold mb-2">Item Example:</div>
                            <div className="text-xs font-mono">
                              <strong>Work Order Plant:</strong><br/>
                              <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PK: WORK_ORDER#100</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">SK: PLANT#123</code><br/>
                              <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI1PK: PLANT#123</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI1SK: WORK_ORDER#100</code><br/>
                              Attributes: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">work_order_id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">plant_id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">is_active</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">added_at</code>
                            </div>
                          </div>
                        </div>

                        {/* Table 4: Analytics Config Mirror */}
                        <div>
                          <h5 className="font-semibold mb-3">Table 4: <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">woms-analytics-config</code> (Analytics DB Mirror)</h5>
                          <p className="mb-3">Stores mirrored configuration from main DB for analytics (organizations, vendors, plants, snapshot runs)</p>
                          
                          <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded mb-3">
                            <div className="font-semibold mb-2">Primary Key Structure:</div>
                            <div className="space-y-2">
                              <div>
                                <strong>Partition Key (PK):</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">entity_type</code>
                                <div className="ml-4 mt-1 text-xs">
                                  Values: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">ANALYTICS_ORG</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">ANALYTICS_VENDOR</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">ANALYTICS_PLANT</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">SNAPSHOT_RUN</code>
                                </div>
                              </div>
                              <div>
                                <strong>Sort Key (SK):</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">entity_id</code>
                                <div className="ml-4 mt-1 text-xs">
                                  Numeric ID as string, or composite key for snapshot runs: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">vendor_id#started_at</code>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <strong>GSI 1: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">analytics-org-index</code></strong>
                              <div className="ml-4 mt-1 text-xs space-y-1">
                                <div><strong>GSI1PK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">org_id</code></div>
                                <div><strong>GSI1SK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">entity_type#entity_id</code></div>
                                <div><strong>Purpose:</strong> Query all analytics entities for an organization</div>
                              </div>
                            </div>

                            <div>
                              <strong>GSI 2: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">analytics-vendor-index</code></strong>
                              <div className="ml-4 mt-1 text-xs space-y-1">
                                <div><strong>GSI2PK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">vendor_id</code></div>
                                <div><strong>GSI2SK:</strong> <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">entity_type#entity_id</code> or <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">started_at</code> (for snapshot runs)</div>
                                <div><strong>Purpose:</strong> Query analytics plants and snapshot runs for a vendor</div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 bg-blue-100 dark:bg-blue-900/30 p-3 rounded">
                            <div className="font-semibold mb-2">Item Examples:</div>
                            <div className="text-xs space-y-2 font-mono">
                              <div>
                                <strong>Analytics Organization:</strong><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PK: ANALYTICS_ORG</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">SK: 1</code><br/>
                                Attributes: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">name</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">config</code> (JSONB), <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">config_hash</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">config_ready</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">config_last_status</code>
                              </div>
                              <div>
                                <strong>Analytics Snapshot Run:</strong><br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">PK: SNAPSHOT_RUN</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">SK: 5#2025-12-08T22:00:00Z</code> (vendor_id#started_at)<br/>
                                <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI2PK: 5</code> (vendor_id), <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">GSI2SK: 2025-12-08T22:00:00Z</code><br/>
                                Attributes: <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">vendor_id</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">started_at</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">completed_at</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">status</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">error_message</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">plants_processed</code>, <code className="bg-blue-200 dark:bg-blue-800 px-1 rounded">rows_upserted</code>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Mapping Table */}
                        <div className="mt-6 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 p-4 rounded border border-blue-300 dark:border-blue-700">
                          <h5 className="font-semibold mb-3">PostgreSQL → DynamoDB Mapping Summary</h5>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse border border-blue-300 dark:border-blue-700">
                              <thead>
                                <tr className="bg-blue-200 dark:bg-blue-800">
                                  <th className="border p-2 text-left">PostgreSQL Table</th>
                                  <th className="border p-2 text-left">DynamoDB Table</th>
                                  <th className="border p-2 text-left">PK</th>
                                  <th className="border p-2 text-left">SK</th>
                                  <th className="border p-2 text-left">GSI Used</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="border p-2"><code>accounts</code></td>
                                  <td className="border p-2">woms-config</td>
                                  <td className="border p-2">ACCOUNT</td>
                                  <td className="border p-2">uuid</td>
                                  <td className="border p-2">GSI1 (org_id), GSI3 (email)</td>
                                </tr>
                                <tr>
                                  <td className="border p-2"><code>organizations</code></td>
                                  <td className="border p-2">woms-config</td>
                                  <td className="border p-2">ORG</td>
                                  <td className="border p-2">id</td>
                                  <td className="border p-2">GSI1 (org_id)</td>
                                </tr>
                                <tr>
                                  <td className="border p-2"><code>vendors</code></td>
                                  <td className="border p-2">woms-config</td>
                                  <td className="border p-2">VENDOR</td>
                                  <td className="border p-2">id</td>
                                  <td className="border p-2">GSI1 (org_id)</td>
                                </tr>
                                <tr>
                                  <td className="border p-2"><code>plants</code></td>
                                  <td className="border p-2">woms-config</td>
                                  <td className="border p-2">PLANT</td>
                                  <td className="border p-2">id</td>
                                  <td className="border p-2">GSI1 (org_id), GSI2 (vendor_id), GSI6 (vendor_plant_id)</td>
                                </tr>
                                <tr>
                                  <td className="border p-2"><code>work_orders</code></td>
                                  <td className="border p-2">woms-config</td>
                                  <td className="border p-2">WORK_ORDER</td>
                                  <td className="border p-2">id</td>
                                  <td className="border p-2">GSI1 (org_id)</td>
                                </tr>
                                <tr>
                                  <td className="border p-2"><code>work_order_plants</code></td>
                                  <td className="border p-2">woms-junctions</td>
                                  <td className="border p-2">WORK_ORDER#id</td>
                                  <td className="border p-2">PLANT#id</td>
                                  <td className="border p-2">GSI1 (reverse lookup)</td>
                                </tr>
                                <tr>
                                  <td className="border p-2"><code>alerts</code></td>
                                  <td className="border p-2">woms-timeseries</td>
                                  <td className="border p-2">ALERT#id</td>
                                  <td className="border p-2">alert_time</td>
                                  <td className="border p-2">GSI2 (plant_id), GSI3 (vendor_alert_id)</td>
                                </tr>
                                <tr>
                                  <td className="border p-2"><code>disabled_plants</code></td>
                                  <td className="border p-2">woms-config</td>
                                  <td className="border p-2">DISABLED_PLANT</td>
                                  <td className="border p-2">id</td>
                                  <td className="border p-2">GSI1 (org_id), GSI2 (vendor_id)</td>
                                </tr>
                                <tr>
                                  <td className="border p-2"><code>wms_vendors</code></td>
                                  <td className="border p-2">woms-config</td>
                                  <td className="border p-2">WMS_VENDOR</td>
                                  <td className="border p-2">id</td>
                                  <td className="border p-2">GSI1 (org_id)</td>
                                </tr>
                                <tr>
                                  <td className="border p-2"><code>wms_sites</code></td>
                                  <td className="border p-2">woms-config</td>
                                  <td className="border p-2">WMS_SITE</td>
                                  <td className="border p-2">id</td>
                                  <td className="border p-2">GSI1 (org_id), GSI4 (wms_vendor_id)</td>
                                </tr>
                                <tr>
                                  <td className="border p-2"><code>wms_devices</code></td>
                                  <td className="border p-2">woms-config</td>
                                  <td className="border p-2">WMS_DEVICE</td>
                                  <td className="border p-2">id</td>
                                  <td className="border p-2">GSI5 (wms_site_id)</td>
                                </tr>
                                <tr>
                                  <td className="border p-2"><code>insolation_readings</code></td>
                                  <td className="border p-2">woms-timeseries</td>
                                  <td className="border p-2">DEVICE#id</td>
                                  <td className="border p-2">reading_date</td>
                                  <td className="border p-2">GSI1 (reading_date)</td>
                                </tr>
                                <tr>
                                  <td className="border p-2"><code>plant_energy_readings</code></td>
                                  <td className="border p-2">woms-timeseries</td>
                                  <td className="border p-2">PLANT_ENERGY#id</td>
                                  <td className="border p-2">reading_date</td>
                                  <td className="border p-2">GSI1 (reading_date)</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Detailed Field Mapping */}
                        <div className="mt-6 bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-900">
                          <h5 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">Detailed Field Mapping: PostgreSQL → DynamoDB</h5>
                          <div className="space-y-4 text-sm text-purple-800 dark:text-purple-200">
                            
                            {/* Accounts */}
                            <div>
                              <h6 className="font-semibold mb-2">accounts → woms-config</h6>
                              <div className="ml-4 space-y-1 text-xs">
                                <div><strong>PK:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">ACCOUNT</code></div>
                                <div><strong>SK:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">id</code> (UUID as string)</div>
                                <div><strong>Attributes:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">account_type</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">email</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">password_hash</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">org_id</code> (nullable), <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">display_name</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">logo_url</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">is_active</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">created_at</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">updated_at</code></div>
                                <div><strong>GSI1:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">org_id</code> → <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">ACCOUNT#id</code> (if org_id is not null)</div>
                                <div><strong>GSI3:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">email</code> → <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">ACCOUNT#id</code> (for login lookup)</div>
                              </div>
                            </div>

                            {/* Organizations */}
                            <div>
                              <h6 className="font-semibold mb-2">organizations → woms-config</h6>
                              <div className="ml-4 space-y-1 text-xs">
                                <div><strong>PK:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">ORG</code></div>
                                <div><strong>SK:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">id</code> (SERIAL as string)</div>
                                <div><strong>Attributes:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">name</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">auto_sync_enabled</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">sync_interval_minutes</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">created_at</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">updated_at</code></div>
                                <div><strong>GSI1:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">org_id</code> → <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">ORG#id</code> (self-reference for consistency)</div>
                              </div>
                            </div>

                            {/* Vendors */}
                            <div>
                              <h6 className="font-semibold mb-2">vendors → woms-config</h6>
                              <div className="ml-4 space-y-1 text-xs">
                                <div><strong>PK:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">VENDOR</code></div>
                                <div><strong>SK:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">id</code> (SERIAL as string)</div>
                                <div><strong>Attributes:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">name</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">vendor_type</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">credentials</code> (JSON), <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">org_id</code> (nullable), <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">access_token</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">refresh_token</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">token_expires_at</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">token_metadata</code> (JSON), <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">is_active</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">last_synced_at</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">last_alert_synced_at</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">telemetry_sync_mode</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">telemetry_sync_interval</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">plant_sync_time_ist</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">per_plant_sync_interval_minutes</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">created_at</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">updated_at</code></div>
                                <div><strong>GSI1:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">org_id</code> → <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">VENDOR#id</code></div>
                              </div>
                            </div>

                            {/* Plants */}
                            <div>
                              <h6 className="font-semibold mb-2">plants → woms-config</h6>
                              <div className="ml-4 space-y-1 text-xs">
                                <div><strong>PK:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">PLANT</code></div>
                                <div><strong>SK:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">id</code> (SERIAL as string)</div>
                                <div><strong>Attributes:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">name</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">vendor_plant_id</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">org_id</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">vendor_id</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">capacity_kw</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">location</code> (JSON), <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">current_power_kw</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">daily_energy_kwh</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">monthly_energy_mwh</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">yearly_energy_mwh</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">total_energy_mwh</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">last_update_time</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">last_refreshed_at</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">network_status</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">vendor_created_date</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">start_operating_time</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">is_active</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">was_online_today</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">created_at</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">updated_at</code></div>
                                <div><strong>GSI1:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">org_id</code> → <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">PLANT#id</code></div>
                                <div><strong>GSI2:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">vendor_id</code> → <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">PLANT#id</code></div>
                                <div><strong>GSI6:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">vendor_id</code> → <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">vendor_plant_id</code> (enforce unique constraint)</div>
                              </div>
                            </div>

                            {/* Alerts */}
                            <div>
                              <h6 className="font-semibold mb-2">alerts → woms-timeseries</h6>
                              <div className="ml-4 space-y-1 text-xs">
                                <div><strong>PK:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">PLANT#plant_id</code> (distributes across partitions for 10K+ plants)</div>
                                <div><strong>SK:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">alert_time#alert_id</code> (e.g., <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">2025-12-08T14:30:00Z#789</code>) - enables sorting by time, unique per alert</div>
                                <div><strong>Attributes:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">id</code> (alert_id), <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">plant_id</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">vendor_id</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">vendor_alert_id</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">vendor_plant_id</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">alert_time</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">end_time</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">grid_down_seconds</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">grid_down_benefit_kwh</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">title</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">description</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">severity</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">status</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">created_at</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">updated_at</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">ttl</code> (alert_time + 365 days)</div>
                                <div><strong>GSI2:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">plant_id</code> → <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">alert_time#alert_id</code> (same as SK for consistency, DESC order for recent alerts)</div>
                                <div><strong>GSI3:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">vendor_id#vendor_plant_id</code> → <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">vendor_alert_id#alert_time</code> (deduplication)</div>
                                <div><strong>GSI4:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">id</code> (alert_id) → <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">PLANT#plant_id</code> (direct lookup by alert ID)</div>
                                <div><strong>Note:</strong> Using <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">PLANT#plant_id</code> as PK distributes alerts across partitions (better for 10K+ plants). SK includes alert_id for uniqueness.</div>
                              </div>
                            </div>

                            {/* Insolation Readings */}
                            <div>
                              <h6 className="font-semibold mb-2">insolation_readings → woms-timeseries</h6>
                              <div className="ml-4 space-y-1 text-xs">
                                <div><strong>PK:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">DEVICE#wms_device_id</code></div>
                                <div><strong>SK:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">reading_date</code> (DATE format: <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">2025-12-08</code>)</div>
                                <div><strong>Attributes:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">wms_device_id</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">insolation_value</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">reading_count</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">metadata</code> (JSON), <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">created_at</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">updated_at</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">ttl</code> (reading_date + 100 days)</div>
                                <div><strong>GSI1:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">reading_date</code> → <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">DEVICE#wms_device_id</code> (query all readings for a date)</div>
                                <div><strong>Query Pattern:</strong> Query PK = DEVICE#id, SK BETWEEN start_date AND end_date (last 100 days)</div>
                              </div>
                            </div>

                            {/* Work Order Plants */}
                            <div>
                              <h6 className="font-semibold mb-2">work_order_plants → woms-junctions</h6>
                              <div className="ml-4 space-y-1 text-xs">
                                <div><strong>PK:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">WORK_ORDER#work_order_id</code></div>
                                <div><strong>SK:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">PLANT#plant_id</code></div>
                                <div><strong>Attributes:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">work_order_id</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">plant_id</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">is_active</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">added_at</code></div>
                                <div><strong>GSI1:</strong> <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">PLANT#plant_id</code> → <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">WORK_ORDER#work_order_id</code> (reverse lookup)</div>
                                <div><strong>Unique Constraint:</strong> Use conditional write (ConditionExpression) to enforce one active work order per plant</div>
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* Query Pattern Examples */}
                        <div className="mt-6 bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-900">
                          <h5 className="font-semibold text-green-900 dark:text-green-100 mb-3">Common Query Patterns</h5>
                          <div className="space-y-3 text-sm text-green-800 dark:text-green-200">
                            
                            <div>
                              <strong>1. Get all plants for an organization:</strong>
                              <div className="ml-4 mt-1 text-xs font-mono bg-green-100 dark:bg-green-900/30 p-2 rounded">
                                Query GSI1 (org-index) where GSI1PK = org_id AND GSI1SK begins_with &quot;PLANT#&quot;
                              </div>
                            </div>

                            <div>
                              <strong>2. Get all plants for a vendor:</strong>
                              <div className="ml-4 mt-1 text-xs font-mono bg-green-100 dark:bg-green-900/30 p-2 rounded">
                                Query GSI2 (vendor-index) where GSI2PK = vendor_id AND GSI2SK begins_with &quot;PLANT#&quot;
                              </div>
                            </div>

                            <div>
                              <strong>3. Get account by email (login):</strong>
                              <div className="ml-4 mt-1 text-xs font-mono bg-green-100 dark:bg-green-900/30 p-2 rounded">
                                Query GSI3 (email-index) where GSI3PK = email
                              </div>
                            </div>

                            <div>
                              <strong>4. Get plant by vendor_plant_id:</strong>
                              <div className="ml-4 mt-1 text-xs font-mono bg-green-100 dark:bg-green-900/30 p-2 rounded">
                                Query GSI6 (vendor-plant-unique-index) where GSI6PK = vendor_id AND GSI6SK = vendor_plant_id
                              </div>
                            </div>

                            <div>
                              <strong>5. Get all alerts for a plant (recent first):</strong>
                              <div className="ml-4 mt-1 text-xs font-mono bg-green-100 dark:bg-green-900/30 p-2 rounded">
                                Query woms-timeseries where PK = PLANT#plant_id, ScanIndexForward = false (DESC order by SK)
                              </div>
                            </div>

                            <div>
                              <strong>5b. Get alert by ID:</strong>
                              <div className="ml-4 mt-1 text-xs font-mono bg-green-100 dark:bg-green-900/30 p-2 rounded">
                                Query GSI4 (alert-id-index) where GSI4PK = alert_id
                              </div>
                            </div>

                            <div>
                              <strong>6. Get insolation readings for a device (last 100 days):</strong>
                              <div className="ml-4 mt-1 text-xs font-mono bg-green-100 dark:bg-green-900/30 p-2 rounded">
                                Query woms-timeseries where PK = DEVICE#device_id AND SK BETWEEN start_date AND end_date
                              </div>
                            </div>

                            <div>
                              <strong>7. Get all work orders for a plant:</strong>
                              <div className="ml-4 mt-1 text-xs font-mono bg-green-100 dark:bg-green-900/30 p-2 rounded">
                                Query GSI1 (plant-workorder-index) where GSI1PK = PLANT#plant_id AND GSI1SK begins_with &quot;WORK_ORDER#&quot;
                              </div>
                            </div>

                            <div>
                              <strong>8. Deduplicate alert by vendor_alert_id:</strong>
                              <div className="ml-4 mt-1 text-xs font-mono bg-green-100 dark:bg-green-900/30 p-2 rounded">
                                Query GSI3 (vendor-alert-index) where GSI3PK = vendor_id#vendor_plant_id AND GSI3SK begins_with vendor_alert_id
                              </div>
                            </div>

                            <div>
                              <strong>9. Get alerts by org_id (through plants):</strong>
                              <div className="ml-4 mt-1 text-xs font-mono bg-green-100 dark:bg-green-900/30 p-2 rounded">
                                Step 1: Query woms-config GSI1 where GSI1PK = org_id AND GSI1SK begins_with &quot;PLANT#&quot;<br/>
                                Step 2: For each plant_id, Query woms-timeseries where PK = PLANT#plant_id<br/>
                                Step 3: Merge and sort results in application layer
                              </div>
                            </div>

                            <div>
                              <strong>10. Get alerts by status (ACTIVE):</strong>
                              <div className="ml-4 mt-1 text-xs font-mono bg-green-100 dark:bg-green-900/30 p-2 rounded">
                                Filter in application layer after querying (DynamoDB doesn&apos;t support filtering by non-key attributes efficiently)<br/>
                                Alternative: Create GSI5 with status as PK (if needed frequently)
                              </div>
                            </div>

                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Required Changes */}
                    <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg border border-orange-200 dark:border-orange-900">
                      <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-3">Required Changes for DynamoDB Migration</h4>
                      <div className="space-y-4 text-sm text-orange-800 dark:text-orange-200">
                        
                        {/* 1. Database Client */}
                        <div>
                          <h5 className="font-semibold mb-2">1. Database Client Abstraction</h5>
                          <ul className="ml-4 list-disc space-y-1">
                            <li>Create <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">lib/dynamodb/client.ts</code> - AWS SDK v3 DynamoDB client</li>
                            <li>Create <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">lib/dynamodb/repository.ts</code> - Repository pattern for DynamoDB operations</li>
                            <li>Update <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">lib/supabase/pooled.ts</code> - Add DynamoDB client alongside Supabase</li>
                            <li>Create abstraction layer to support both Supabase and DynamoDB (for gradual migration)</li>
                          </ul>
                        </div>

                        {/* 2. Data Access Layer */}
                        <div>
                          <h5 className="font-semibold mb-2">2. Data Access Layer Refactoring</h5>
                          <ul className="ml-4 list-disc space-y-1">
                            <li>Create repository interfaces:
                              <ul className="ml-4 list-disc mt-1">
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">OrganizationRepository</code></li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">VendorRepository</code></li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">PlantRepository</code></li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">AccountRepository</code></li>
                                <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">AlertRepository</code></li>
                              </ul>
                            </li>
                            <li>Implement DynamoDB versions of each repository</li>
                            <li>Update service layer to use repositories (not direct DB calls)</li>
                            <li>Support both Supabase and DynamoDB implementations (feature flag)</li>
                          </ul>
                        </div>

                        {/* 3. Query Patterns */}
                        <div>
                          <h5 className="font-semibold mb-2">3. Query Pattern Changes</h5>
                          <ul className="ml-4 list-disc space-y-1">
                            <li><strong>Get by ID:</strong> Direct GetItem (PK + SK)</li>
                            <li><strong>Get by Org:</strong> Query GSI1 (org_id → entities)</li>
                            <li><strong>Get by Vendor:</strong> Query GSI2 (vendor_id → plants)</li>
                            <li><strong>Get by Email:</strong> Query GSI3 (email → account)</li>
                            <li><strong>Time Range Queries:</strong> Query with SK range (timestamp BETWEEN)</li>
                            <li><strong>List All:</strong> Scan (expensive, use sparingly) or maintain count/index</li>
                            <li><strong>Complex Joins:</strong> Not supported - fetch separately and join in application</li>
                          </ul>
                        </div>

                        {/* 4. Data Migration */}
                        <div>
                          <h5 className="font-semibold mb-2">4. Data Migration Strategy</h5>
                          <ul className="ml-4 list-disc space-y-1">
                            <li>Create migration script: <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">scripts/migrate-to-dynamodb.ts</code></li>
                            <li>Export data from Supabase (JSON format)</li>
                            <li>Transform to DynamoDB item format (PK/SK structure)</li>
                            <li>Batch write to DynamoDB (25 items per batch)</li>
                            <li>Validate data integrity (compare counts, sample records)</li>
                            <li>Run in parallel for faster migration</li>
                          </ul>
                        </div>

                        {/* 5. Environment Variables */}
                        <div>
                          <h5 className="font-semibold mb-2">5. Environment Variables</h5>
                          <ul className="ml-4 list-disc space-y-1">
                            <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">AWS_REGION</code> - AWS region (e.g., ap-south-1)</li>
                            <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">AWS_ACCESS_KEY_ID</code> - AWS access key</li>
                            <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">AWS_SECRET_ACCESS_KEY</code> - AWS secret key</li>
                            <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">DYNAMODB_CONFIG_TABLE</code> - Table name (default: woms-config)</li>
                            <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">DYNAMODB_TIMESERIES_TABLE</code> - Table name (default: woms-timeseries)</li>
                            <li><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">USE_DYNAMODB</code> - Feature flag (true/false)</li>
                          </ul>
                        </div>

                        {/* 6. Type Definitions */}
                        <div>
                          <h5 className="font-semibold mb-2">6. Type Definitions</h5>
                          <ul className="ml-4 list-disc space-y-1">
                            <li>Create <code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">types/dynamodb.ts</code> - DynamoDB item types</li>
                            <li>Define PK/SK structure types</li>
                            <li>Define GSI key types</li>
                            <li>Create mapper functions (Supabase → DynamoDB format)</li>
                          </ul>
                        </div>

                        {/* 7. Testing */}
                        <div>
                          <h5 className="font-semibold mb-2">7. Testing Strategy</h5>
                          <ul className="ml-4 list-disc space-y-1">
                            <li>Use DynamoDB Local for local testing</li>
                            <li>Create integration tests for repository layer</li>
                            <li>Test query patterns (GSI queries, range queries)</li>
                            <li>Test TTL expiration (time-series cleanup)</li>
                            <li>Performance testing (compare Supabase vs DynamoDB)</li>
                          </ul>
                        </div>

                      </div>
                    </div>

                    {/* Cost Analysis */}
                    <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-900">
                      <h4 className="font-semibold text-green-900 dark:text-green-100 mb-3">Detailed Cost Analysis: Current vs Serverless + DynamoDB</h4>
                      <div className="space-y-4 text-sm text-green-800 dark:text-green-200">
                        
                        {/* Scenario Definition */}
                        <div>
                          <h5 className="font-semibold mb-2">Scenario: 10,000 Plants (Scaled Production)</h5>
                          <ul className="ml-4 list-disc mt-1 space-y-1">
                            <li><strong>Organizations:</strong> 100 orgs</li>
                            <li><strong>Vendors:</strong> 300 vendors (SOLARMAN, SolarDM, etc.)</li>
                            <li><strong>Plants:</strong> 10,000 plants</li>
                            <li><strong>WMS Sites:</strong> 500 sites</li>
                            <li><strong>WMS Devices:</strong> 1,000 devices</li>
                            <li><strong>Accounts:</strong> 150 accounts</li>
                            <li><strong>Work Orders:</strong> 2,000 work orders</li>
                          </ul>
                        </div>

                        {/* Alert Projections */}
                        <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded">
                          <h5 className="font-semibold mb-2">Alert Volume Projections (Per Site Basis)</h5>
                          <div className="space-y-2">
                            <div>
                              <strong>Alert Sync Frequency:</strong> Every 15 minutes = 96 syncs/day = 2,880 syncs/month
                            </div>
                            <div>
                              <strong>Alerts per Plant:</strong>
                              <ul className="ml-4 list-disc mt-1">
                                <li>Average: 3 alerts per plant per day (mix of active/resolved)</li>
                                <li>Peak: 10 alerts per plant per day (during outages/maintenance)</li>
                                <li>With 10K plants: <strong>30K-100K alerts per day</strong></li>
                              </ul>
                            </div>
                            <div>
                              <strong>Monthly Alert Volume:</strong>
                              <ul className="ml-4 list-disc mt-1">
                                <li>Conservative: 30K/day × 30 = <strong>900K alerts/month</strong></li>
                                <li>Realistic: 50K/day × 30 = <strong>1.5M alerts/month</strong></li>
                                <li>Peak: 100K/day × 30 = <strong>3M alerts/month</strong></li>
                              </ul>
                            </div>
                            <div>
                              <strong>Alert Retention:</strong> 1 year (365 days) = ~18M-36M total alerts stored
                            </div>
                          </div>
                        </div>

                        {/* Read/Write Operations Breakdown */}
                        <div>
                          <h5 className="font-semibold mb-2">Monthly Read/Write Operations Breakdown</h5>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse border border-green-300 dark:border-green-700">
                              <thead>
                                <tr className="bg-green-200 dark:bg-green-800">
                                  <th className="border p-2 text-left">Operation</th>
                                  <th className="border p-2 text-right">Frequency</th>
                                  <th className="border p-2 text-right">Reads/Month</th>
                                  <th className="border p-2 text-right">Writes/Month</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="border p-2">Alert Sync (every 15 min)</td>
                                  <td className="border p-2 text-right">2,880 syncs</td>
                                  <td className="border p-2 text-right">2.88M</td>
                                  <td className="border p-2 text-right">1.5M</td>
                                </tr>
                                <tr>
                                  <td className="border p-2">Telemetry Sync (every 15 min)</td>
                                  <td className="border p-2 text-right">2,880 syncs</td>
                                  <td className="border p-2 text-right">28.8M</td>
                                  <td className="border p-2 text-right">2.88M</td>
                                </tr>
                                <tr>
                                  <td className="border p-2">Plant Sync (daily)</td>
                                  <td className="border p-2 text-right">30 syncs</td>
                                  <td className="border p-2 text-right">300K</td>
                                  <td className="border p-2 text-right">30K</td>
                                </tr>
                                <tr>
                                  <td className="border p-2">WMS Insolation Sync (daily)</td>
                                  <td className="border p-2 text-right">30 syncs</td>
                                  <td className="border p-2 text-right">30K</td>
                                  <td className="border p-2 text-right">30K</td>
                                </tr>
                                <tr>
                                  <td className="border p-2">Analytics Snapshot (daily)</td>
                                  <td className="border p-2 text-right">30 syncs</td>
                                  <td className="border p-2 text-right">300K</td>
                                  <td className="border p-2 text-right">300K</td>
                                </tr>
                                <tr>
                                  <td className="border p-2">API Requests (dashboard, queries)</td>
                                  <td className="border p-2 text-right">~100K requests</td>
                                  <td className="border p-2 text-right">5M</td>
                                  <td className="border p-2 text-right">50K</td>
                                </tr>
                                <tr className="bg-green-100 dark:bg-green-900/30 font-semibold">
                                  <td className="border p-2">TOTAL</td>
                                  <td className="border p-2 text-right">-</td>
                                  <td className="border p-2 text-right"><strong>37.6M reads</strong></td>
                                  <td className="border p-2 text-right"><strong>4.79M writes</strong></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <p className="text-xs italic mt-2">
                            <strong>Note:</strong> Reads include GSI queries, config lookups, and time-series queries. 
                            Writes include inserts, updates, and upserts.
                          </p>
                        </div>

                        {/* Current Architecture Costs */}
                        <div>
                          <h5 className="font-semibold mb-2">Current Architecture Costs (Supabase)</h5>
                          <div className="space-y-2">
                            <div>
                              <strong>Main Database (Supabase Pro):</strong>
                              <ul className="ml-4 list-disc mt-1">
                                <li>Plan: Pro ($25/month)</li>
                                <li>Storage: 8 GB included (estimated usage: ~15 GB with 10K plants + alerts)</li>
                                <li>Bandwidth: 50 GB included (estimated usage: ~200 GB/month)</li>
                                <li>Additional storage: 15 GB - 8 GB = 7 GB × $0.125/GB = <strong>$0.88/month</strong></li>
                                <li>Additional bandwidth: 200 GB - 50 GB = 150 GB × $0.09/GB = <strong>$13.50/month</strong></li>
                                <li><strong>Subtotal: $25 + $0.88 + $13.50 = $39.38/month</strong></li>
                              </ul>
                            </div>
                            <div>
                              <strong>Analytics Database (Supabase Pro):</strong>
                              <ul className="ml-4 list-disc mt-1">
                                <li>Plan: Pro ($25/month)</li>
                                <li>Storage: 8 GB included (estimated usage: ~5 GB)</li>
                                <li>Bandwidth: 50 GB included (estimated usage: ~30 GB/month)</li>
                                <li><strong>Subtotal: $25/month</strong></li>
                              </ul>
                            </div>
                            <div>
                              <strong>Server/Hosting (Vercel Pro or EC2):</strong>
                              <ul className="ml-4 list-disc mt-1">
                                <li>Vercel Pro: $20/month + usage</li>
                                <li>Or EC2 t3.medium: ~$30/month</li>
                                <li><strong>Estimated: $25/month</strong></li>
                              </ul>
                            </div>
                            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded font-semibold">
                              <strong>Total Current Architecture: $39.38 + $25 + $25 = $89.38/month ($1,072/year)</strong>
                            </div>
                          </div>
                        </div>

                        {/* Serverless + DynamoDB Costs */}
                        <div>
                          <h5 className="font-semibold mb-2">Serverless + DynamoDB Architecture Costs</h5>
                          <div className="space-y-2">
                            <div>
                              <strong>DynamoDB (On-Demand Pricing):</strong>
                              <ul className="ml-4 list-disc mt-1">
                                <li><strong>Storage:</strong>
                                  <ul className="ml-4 list-disc mt-1">
                                    <li>Config data: ~2 GB (orgs, vendors, plants, accounts)</li>
                                    <li>Time-series (alerts): ~18 GB (1.5M alerts/month × 12 months retention)</li>
                                    <li>Time-series (insolation): ~1 GB (100-day retention)</li>
                                    <li>Total: ~21 GB</li>
                                    <li>Cost: 21 GB × $0.25/GB = <strong>$5.25/month</strong></li>
                                    <li>Free tier: 25 GB free → <strong>$0.00/month</strong> ✅</li>
                                  </ul>
                                </li>
                                <li><strong>Read Units:</strong>
                                  <ul className="ml-4 list-disc mt-1">
                                    <li>Total: 37.6M reads/month</li>
                                    <li>Free tier: 25 read units = ~200M reads/month free</li>
                                    <li>37.6M reads &lt; 200M free → <strong>$0.00/month</strong> ✅</li>
                                  </ul>
                                </li>
                                <li><strong>Write Units:</strong>
                                  <ul className="ml-4 list-disc mt-1">
                                    <li>Total: 4.79M writes/month</li>
                                    <li>Free tier: 25 write units = ~200M writes/month free</li>
                                    <li>4.79M writes &lt; 200M free → <strong>$0.00/month</strong> ✅</li>
                                  </ul>
                                </li>
                                <li><strong>GSI Queries:</strong> Included in read units (no additional cost)</li>
                                <li><strong>DynamoDB Subtotal: $0.00/month</strong> (completely within free tier!)</li>
                              </ul>
                            </div>
                            <div>
                              <strong>AWS Lambda (Serverless Functions):</strong>
                              <ul className="ml-4 list-disc mt-1">
                                <li><strong>Requests:</strong> ~6M requests/month (syncs + API calls)</li>
                                <li>Free tier: 1M requests/month free</li>
                                <li>Additional: 5M requests × $0.20/1M = <strong>$1.00/month</strong></li>
                                <li><strong>Compute Time:</strong> ~100M GB-seconds/month</li>
                                <li>Free tier: 400K GB-seconds/month free</li>
                                <li>Additional: ~99.6M GB-seconds × $0.0000166667/GB-second = <strong>$1.66/month</strong></li>
                                <li><strong>Lambda Subtotal: $2.66/month</strong></li>
                              </ul>
                            </div>
                            <div>
                              <strong>API Gateway:</strong>
                              <ul className="ml-4 list-disc mt-1">
                                <li>Requests: ~100K API requests/month</li>
                                <li>Free tier: 1M requests/month free</li>
                                <li><strong>API Gateway Subtotal: $0.00/month</strong> ✅</li>
                              </ul>
                            </div>
                            <div>
                              <strong>EventBridge (Cron Triggers):</strong>
                              <ul className="ml-4 list-disc mt-1">
                                <li>Custom events: ~2,880 events/month (alert sync)</li>
                                <li>Free tier: 1M custom events/month free</li>
                                <li><strong>EventBridge Subtotal: $0.00/month</strong> ✅</li>
                              </ul>
                            </div>
                            <div>
                              <strong>CloudWatch Logs:</strong>
                              <ul className="ml-4 list-disc mt-1">
                                <li>Log ingestion: ~5 GB/month</li>
                                <li>Free tier: 5 GB/month free</li>
                                <li><strong>CloudWatch Subtotal: $0.00/month</strong> ✅</li>
                              </ul>
                            </div>
                            <div>
                              <strong>Frontend Hosting (S3 + CloudFront):</strong>
                              <ul className="ml-4 list-disc mt-1">
                                <li>S3 storage: ~500 MB × $0.023/GB = <strong>$0.01/month</strong></li>
                                <li>CloudFront: ~50 GB transfer × $0.085/GB = <strong>$4.25/month</strong></li>
                                <li><strong>Frontend Subtotal: $4.26/month</strong></li>
                              </ul>
                            </div>
                            <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded font-semibold">
                              <strong>Total Serverless Architecture: $0.00 + $2.66 + $0.00 + $0.00 + $0.00 + $4.26 = $6.92/month ($83/year)</strong>
                            </div>
                          </div>
                        </div>

                        {/* Cost Comparison Summary */}
                        <div className="bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 p-4 rounded border-2 border-green-300 dark:border-green-700">
                          <h5 className="font-semibold text-lg mb-3">💰 Cost Comparison Summary</h5>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <strong>Current Architecture:</strong>
                              <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">$89.38/month</div>
                              <div className="text-sm mt-1">$1,072/year</div>
                            </div>
                            <div>
                              <strong>Serverless + DynamoDB:</strong>
                              <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">$6.92/month</div>
                              <div className="text-sm mt-1">$83/year</div>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-green-300 dark:border-green-700">
                            <div className="text-xl font-bold text-green-700 dark:text-green-300">
                              💵 Annual Savings: $989/year (92% cost reduction!)
                            </div>
                            <div className="text-sm mt-2">
                              <strong>Breakdown:</strong>
                              <ul className="ml-4 list-disc mt-1">
                                <li>DynamoDB: $0/month (within free tier)</li>
                                <li>Lambda: $2.66/month</li>
                                <li>Frontend: $4.26/month</li>
                                <li>All other AWS services: $0/month (within free tier)</li>
                              </ul>
                            </div>
                          </div>
                        </div>

                        {/* Scaling Projections */}
                        <div>
                          <h5 className="font-semibold mb-2">Scaling Projections (Future Growth)</h5>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse border border-green-300 dark:border-green-700">
                              <thead>
                                <tr className="bg-green-200 dark:bg-green-800">
                                  <th className="border p-2 text-left">Scale</th>
                                  <th className="border p-2 text-right">Plants</th>
                                  <th className="border p-2 text-right">Alerts/Month</th>
                                  <th className="border p-2 text-right">Current Cost</th>
                                  <th className="border p-2 text-right">Serverless Cost</th>
                                  <th className="border p-2 text-right">Savings</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="border p-2">Small</td>
                                  <td className="border p-2 text-right">1,000</td>
                                  <td className="border p-2 text-right">150K</td>
                                  <td className="border p-2 text-right">$50</td>
                                  <td className="border p-2 text-right">$3</td>
                                  <td className="border p-2 text-right text-green-600">$47</td>
                                </tr>
                                <tr>
                                  <td className="border p-2">Medium</td>
                                  <td className="border p-2 text-right">5,000</td>
                                  <td className="border p-2 text-right">750K</td>
                                  <td className="border p-2 text-right">$70</td>
                                  <td className="border p-2 text-right">$5</td>
                                  <td className="border p-2 text-right text-green-600">$65</td>
                                </tr>
                                <tr className="bg-green-100 dark:bg-green-900/30 font-semibold">
                                  <td className="border p-2">Large (Current)</td>
                                  <td className="border p-2 text-right">10,000</td>
                                  <td className="border p-2 text-right">1.5M</td>
                                  <td className="border p-2 text-right">$89</td>
                                  <td className="border p-2 text-right">$7</td>
                                  <td className="border p-2 text-right text-green-600">$82</td>
                                </tr>
                                <tr>
                                  <td className="border p-2">X-Large</td>
                                  <td className="border p-2 text-right">25,000</td>
                                  <td className="border p-2 text-right">3.75M</td>
                                  <td className="border p-2 text-right">$150</td>
                                  <td className="border p-2 text-right">$15</td>
                                  <td className="border p-2 text-right text-green-600">$135</td>
                                </tr>
                                <tr>
                                  <td className="border p-2">XX-Large</td>
                                  <td className="border p-2 text-right">50,000</td>
                                  <td className="border p-2 text-right">7.5M</td>
                                  <td className="border p-2 text-right">$250</td>
                                  <td className="border p-2 text-right">$30</td>
                                  <td className="border p-2 text-right text-green-600">$220</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                          <p className="text-xs italic mt-2">
                            <strong>Note:</strong> Serverless costs scale linearly with usage, while Supabase costs jump at plan tiers. 
                            DynamoDB remains cost-effective even at very large scales due to on-demand pricing.
                          </p>
                        </div>

                      </div>
                    </div>

                    {/* Pros and Cons */}
                    <div className="space-y-4">
                      <h4 className="font-semibold">DynamoDB Migration: Pros and Cons</h4>
                      
                      <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-900">
                        <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">✅ DynamoDB Pros</h5>
                        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2 ml-4 list-disc">
                          <li><strong>Cost-Free:</strong> 25 GB storage + 25 read/write units permanently free</li>
                          <li><strong>Auto-Scaling:</strong> Handles traffic spikes automatically</li>
                          <li><strong>Low Latency:</strong> Single-digit millisecond response times</li>
                          <li><strong>TTL Support:</strong> Automatic cleanup of expired time-series data</li>
                          <li><strong>No Server Management:</strong> Fully managed service</li>
                          <li><strong>Global Tables:</strong> Multi-region replication (optional)</li>
                          <li><strong>On-Demand Pricing:</strong> Pay only for what you use</li>
                          <li><strong>Durable:</strong> 99.999999999% (11 9&apos;s) durability</li>
                        </ul>
                      </div>

                      <div className="bg-red-50 dark:bg-red-950/20 p-4 rounded-lg border border-red-200 dark:border-red-900">
                        <h5 className="font-semibold text-red-900 dark:text-red-100 mb-3">❌ DynamoDB Cons</h5>
                        <ul className="text-sm text-red-800 dark:text-red-200 space-y-2 ml-4 list-disc">
                          <li><strong>No SQL Joins:</strong> Must fetch related data separately and join in application</li>
                          <li><strong>Limited Query Flexibility:</strong> Can only query by PK/SK or GSI (no ad-hoc queries)</li>
                          <li><strong>Scan Operations:</strong> Expensive and slow (avoid for large tables)</li>
                          <li><strong>GSI Costs:</strong> Additional storage and read/write capacity (but still within free tier for small apps)</li>
                          <li><strong>Learning Curve:</strong> Team needs to learn DynamoDB patterns</li>
                          <li><strong>Migration Complexity:</strong> Requires significant refactoring</li>
                          <li><strong>No Transactions:</strong> Limited transaction support (only within single item or same partition)</li>
                          <li><strong>Vendor Lock-in:</strong> Tied to AWS ecosystem</li>
                        </ul>
                      </div>
                    </div>

                    {/* Hybrid Approach */}
                    <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-900">
                      <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">Recommended Hybrid Approach</h4>
                      <div className="space-y-3 text-sm text-purple-800 dark:text-purple-200">
                        <div>
                          <strong>Option 1: Configuration in DynamoDB, Time-Series in Supabase</strong>
                          <ul className="ml-4 list-disc mt-1 space-y-1">
                            <li>Move config tables to DynamoDB: <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">organizations</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">vendors</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">plants</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">accounts</code></li>
                            <li>Keep time-series in Supabase: <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">alerts</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">insolation_readings</code>, <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">plant_energy_readings</code></li>
                            <li><strong>Benefit:</strong> Best of both worlds - cost savings + SQL flexibility for analytics</li>
                            <li><strong>Complexity:</strong> Medium (need to support both databases)</li>
                          </ul>
                        </div>
                        <div>
                          <strong>Option 2: Everything in DynamoDB</strong>
                          <ul className="ml-4 list-disc mt-1 space-y-1">
                            <li>Migrate all tables to DynamoDB</li>
                            <li>Use TTL for time-series auto-cleanup</li>
                            <li><strong>Benefit:</strong> Maximum cost savings, single database</li>
                            <li><strong>Complexity:</strong> High (significant refactoring, lose SQL capabilities)</li>
                          </ul>
                        </div>
                        <div>
                          <strong>Option 3: Stay with Supabase</strong>
                          <ul className="ml-4 list-disc mt-1 space-y-1">
                            <li>Keep current architecture</li>
                            <li>Optimize queries and indexes</li>
                            <li><strong>Benefit:</strong> No migration effort, SQL flexibility</li>
                            <li><strong>Complexity:</strong> Low (no changes)</li>
                          </ul>
                        </div>
                        <p className="mt-3 font-semibold">
                          <strong>Recommendation:</strong> Start with Option 1 (Hybrid) - migrate only configuration data to DynamoDB. 
                          This provides cost savings while maintaining SQL capabilities for analytics queries.
                        </p>
                      </div>
                    </div>

                    {/* Implementation Checklist */}
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-3">Implementation Checklist</h4>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-start gap-2">
                          <input type="checkbox" className="mt-1" disabled />
                          <span>Set up AWS account and DynamoDB tables</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <input type="checkbox" className="mt-1" disabled />
                          <span>Create DynamoDB client and repository layer</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <input type="checkbox" className="mt-1" disabled />
                          <span>Implement repository interfaces for each entity type</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <input type="checkbox" className="mt-1" disabled />
                          <span>Create data migration script</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <input type="checkbox" className="mt-1" disabled />
                          <span>Update service layer to use repositories</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <input type="checkbox" className="mt-1" disabled />
                          <span>Add feature flag for DynamoDB/Supabase selection</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <input type="checkbox" className="mt-1" disabled />
                          <span>Test query patterns and performance</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <input type="checkbox" className="mt-1" disabled />
                          <span>Migrate data and validate integrity</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <input type="checkbox" className="mt-1" disabled />
                          <span>Update API routes to use new repositories</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <input type="checkbox" className="mt-1" disabled />
                          <span>Monitor costs and performance</span>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ADRs Tab */}
        <TabsContent value="adrs" className="space-y-6">
          <Card className="overflow-hidden">
            <SectionHeader id="adrs" title="Architecture Decision Records (ADRs)" icon={Code} />
            {expandedSections.has("adrs") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="space-y-4">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">ADR-001: Custom Authentication System</h3>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p><strong>Status:</strong> <Badge variant="outline">Accepted</Badge></p>
                      <p><strong>Date:</strong> 2024-01-15</p>
                      <p><strong>Context:</strong> Need for custom authentication system separate from Supabase Auth</p>
                      <p><strong>Decision:</strong> Implemented custom session management using HTTP-only cookies with base64-encoded JSON</p>
                      <p><strong>Consequences:</strong> Full control over session management, but requires manual implementation of security features (token rotation, session invalidation, etc.)</p>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">ADR-002: Vendor Adapter Pattern</h3>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p><strong>Status:</strong> <Badge variant="outline">Accepted</Badge></p>
                      <p><strong>Date:</strong> 2024-01-20</p>
                      <p><strong>Context:</strong> Need to support multiple vendor APIs with different authentication and data formats</p>
                      <p><strong>Decision:</strong> Implemented adapter pattern with <code className="bg-background px-1 rounded">BaseVendorAdapter</code> abstract class and vendor-specific implementations</p>
                      <p><strong>Consequences:</strong> Easy to add new vendors, but requires implementing all abstract methods for each vendor</p>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">ADR-003: Telemetry Storage Strategy</h3>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p><strong>Status:</strong> <Badge variant="outline">Accepted</Badge></p>
                      <p><strong>Date:</strong> 2024-02-01</p>
                      <p><strong>Context:</strong> Need to handle both historical telemetry (graphs) and live telemetry (real-time metrics)</p>
                      <p><strong>Decision:</strong> Historical telemetry fetched on-demand from vendor APIs, live telemetry stored in main database (<code className="bg-background px-1 rounded">plants</code> table)</p>
                      <p><strong>Consequences:</strong> Reduces database storage requirements, but requires vendor API availability for historical data</p>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">ADR-004: Batch Processing for Sync Operations</h3>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p><strong>Status:</strong> <Badge variant="outline">Accepted</Badge></p>
                      <p><strong>Date:</strong> 2024-02-15</p>
                      <p><strong>Context:</strong> Need to sync large numbers of plants/alerts efficiently</p>
                      <p><strong>Decision:</strong> Process in batches (100 plants per database transaction, 50 plants per API batch for parallel calls)</p>
                      <p><strong>Consequences:</strong> Reduces database load and transaction count, but requires careful batch size tuning</p>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">ADR-005: Twice-Daily Plant Sync Strategy</h3>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p><strong>Status:</strong> <Badge variant="outline">Accepted</Badge></p>
                      <p><strong>Date:</strong> 2024-03-01</p>
                      <p><strong>Context:</strong> Plant list changes infrequently, but need to detect newly added plants</p>
                      <p><strong>Decision:</strong> Plant sync runs twice daily (morning and evening) instead of continuous syncing</p>
                      <p><strong>Consequences:</strong> Reduces API calls and database load, but new plants may not appear immediately</p>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">ADR-006: Restricted Sync Window</h3>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p><strong>Status:</strong> <Badge variant="outline">Accepted</Badge></p>
                      <p><strong>Date:</strong> 2024-03-10</p>
                      <p><strong>Context:</strong> Need to prevent unnecessary API calls during off-peak hours</p>
                      <p><strong>Decision:</strong> Implement per-vendor restricted sync window (default: 8 PM - 5 AM IST) where all syncs are skipped</p>
                      <p><strong>Consequences:</strong> Reduces API costs and vendor load, but syncs are delayed during restricted hours</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Onboarding Tab */}
        <TabsContent value="onboarding" className="space-y-6">
          <Card className="overflow-hidden">
            <SectionHeader id="onboarding" title="Developer Onboarding" icon={Users} />
            {expandedSections.has("onboarding") && (
              <div className="p-6 pt-0 space-y-6 border-t">
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 p-6 rounded-lg border border-blue-200 dark:border-blue-900">
                    <h3 className="font-semibold text-lg mb-4">Welcome to Solar Information System Development</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      This guide will help you get started with the codebase and understand the system architecture.
                    </p>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">Prerequisites</h3>
                    <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                      <li>Node.js 18+ and npm</li>
                      <li>Supabase account and project</li>
                      <li>Git for version control</li>
                      <li>Basic knowledge of React, Next.js, TypeScript, and PostgreSQL</li>
                    </ul>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">Initial Setup</h3>
                    <ol className="text-sm text-muted-foreground space-y-2 ml-4 list-decimal">
                      <li>Clone the repository</li>
                      <li>Install dependencies: <code className="bg-background px-1 rounded">npm install</code></li>
                      <li>Set up environment variables (see <code className="bg-background px-1 rounded">.env.example</code>)</li>
                      <li>Run database migrations: <code className="bg-background px-1 rounded">supabase migration up</code></li>
                      <li>Start development server: <code className="bg-background px-1 rounded">npm run dev</code></li>
                    </ol>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">Key Concepts</h3>
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <div>
                        <strong>Vendor Adapters:</strong>
                        <ul className="ml-4 list-disc mt-1">
                          <li>Located in <code className="bg-background px-1 rounded">lib/vendors/</code></li>
                          <li>Each vendor has its own adapter extending <code className="bg-background px-1 rounded">BaseVendorAdapter</code></li>
                          <li>Must implement: <code className="bg-background px-1 rounded">authenticate()</code>, <code className="bg-background px-1 rounded">listPlants()</code>, <code className="bg-background px-1 rounded">listPlant()</code>, <code className="bg-background px-1 rounded">getTelemetry()</code>, <code className="bg-background px-1 rounded">getAlerts()</code></li>
                        </ul>
                      </div>
                      <div>
                        <strong>Sync Services:</strong>
                        <ul className="ml-4 list-disc mt-1">
                          <li><code className="bg-background px-1 rounded">plantSyncService.ts</code> - Plant synchronization (twice daily)</li>
                          <li><code className="bg-background px-1 rounded">liveTelemetrySyncService.ts</code> - Live telemetry updates (15/30/45 min intervals)</li>
                          <li><code className="bg-background px-1 rounded">alertSyncService.ts</code> - Alert synchronization</li>
                        </ul>
                      </div>
                      <div>
                        <strong>Authentication:</strong>
                        <ul className="ml-4 list-disc mt-1">
                          <li>Custom session management via HTTP-only cookies</li>
                          <li>Session contains base64-encoded JSON with account info</li>
                          <li>RBAC implemented in <code className="bg-background px-1 rounded">lib/rbac.ts</code></li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">Development Workflow</h3>
                    <ol className="text-sm text-muted-foreground space-y-2 ml-4 list-decimal">
                      <li>Create feature branch from <code className="bg-background px-1 rounded">main</code></li>
                      <li>Make changes following code style guidelines</li>
                      <li>Test locally with development server</li>
                      <li>Run type checking: <code className="bg-background px-1 rounded">npm run type-check</code></li>
                      <li>Run linter: <code className="bg-background px-1 rounded">npm run lint</code></li>
                      <li>Create pull request with description of changes</li>
                    </ol>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">Useful Resources</h3>
                    <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                      <li><strong>System Flow Documentation:</strong> <code className="bg-background px-1 rounded">/superadmin/system-flow</code> (DEVELOPER only)</li>
                      <li><strong>API Documentation:</strong> <code className="bg-background px-1 rounded">/api-docs</code> (Swagger UI)</li>
                      <li><strong>Database Schema:</strong> Check <code className="bg-background px-1 rounded">supabase/migrations/</code> for schema definitions</li>
                      <li><strong>Vendor Onboarding Guide:</strong> <code className="bg-background px-1 rounded">docs/VENDOR_ONBOARDING.md</code></li>
                    </ul>
                  </div>

                  <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-900">
                    <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">⚠️ Important Notes</h3>
                    <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1 ml-4 list-disc">
                      <li>Always test vendor adapter changes with real vendor APIs before deploying</li>
                      <li>Be careful with database migrations - test on staging first</li>
                      <li>Follow the existing code patterns and conventions</li>
                      <li>Document any new vendor-specific behaviors or edge cases</li>
                    </ul>
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

