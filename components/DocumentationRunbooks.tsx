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
  Zap
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
    new Set(["runbooks", "troubleshooting", "adrs", "onboarding"])
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="runbooks">
            <FileText className="h-4 w-4 mr-2" />
            Runbooks
          </TabsTrigger>
          <TabsTrigger value="troubleshooting">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Troubleshooting
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

