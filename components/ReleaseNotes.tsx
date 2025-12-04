"use client";

import { Card } from "@/components/ui/card";

export function ReleaseNotes() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto p-6">
      <header className="mb-4">
        <h1 className="text-3xl font-bold mb-2">Solar Information System - Release Notes</h1>
        <p className="text-sm text-muted-foreground">
          HTML release notes for Developer users. This page summarizes major functional changes
          and architecture updates implemented so far.
        </p>
      </header>

      <Card className="p-6 space-y-4">
        <section>
          <h2 className="text-xl font-semibold mb-2">Previous Work (High-Level Summary)</h2>
          <h3 className="font-semibold mt-3 mb-1">Alert Synchronization</h3>
          <ul className="list-disc ml-6 text-sm space-y-1">
            <li>
              Implemented vendor-level alert sync starting with <strong>Solarman</strong> using the PRO API,
              filtered to <em>No Mains Voltage</em> alerts on INVERTER devices, with proper pagination and
              1-year (or vendor-configured) lookback.
            </li>
            <li>
              Alerts are mapped into the unified <code className="bg-muted px-1 rounded">alerts</code> table
              with vendor IDs, plant IDs, severity, status, timestamps, and computed
              <code className="bg-muted px-1 rounded">grid_down_seconds</code> and
              <code className="bg-muted px-1 rounded">grid_down_benefit_kwh</code>.
            </li>
            <li>
              Added <strong>SolarDM</strong> alert sync with equivalent behavior, including date parsing for
              <code className="bg-muted px-1 rounded">YYYY-MM-DD HH:mm:ss</code> timestamps and severity from
              <code className="bg-muted px-1 rounded">faultLevel</code>.
            </li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">Alerts UI</h3>
          <ul className="list-disc ml-6 text-sm space-y-1">
            <li>
              Added <code className="bg-muted px-1 rounded">/alerts</code> overview by organization and vendor
              with vendor cards, last alert sync timestamps, and navigation down to vendor plants and
              plant-level alert timelines.
            </li>
            <li>
              Implemented vendor and plant alert views with month-by-month grid-down metrics and
              role-based visibility (GOVT/ORG scoped, vendor type visible only to SUPERADMIN/DEVELOPER).
            </li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">Telemetry & Plant Dashboard</h3>
          <ul className="list-disc ml-6 text-sm space-y-1">
            <li>
              Integrated Solarman telemetry for day, month, year, and total views; standardized plant
              telemetry API at <code className="bg-muted px-1 rounded">/api/plants/[id]/telemetry</code>
              using <code className="bg-muted px-1 rounded">vendor_plant_id</code>.
            </li>
            <li>
              Updated graphs to Solarman-style area charts with on-demand loading, loaders, and
              defensive handling of null or sparse vendor data.
            </li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">Vendor Onboarding & Integrations</h3>
          <ul className="list-disc ml-6 text-sm space-y-1">
            <li>
              <strong>SolarDM</strong>: email-based auth, token caching, plant listing, alert and telemetry
              mapping documented in the vendor onboarding guide.
            </li>
            <li>
              <strong>PVBlink</strong>: email/password auth with retry logic, plant listing with pagination
              and network status, telemetry for all time ranges wired into the plant dashboard.
            </li>
            <li>
              <strong>Foxesscloud (PV Hub)</strong>: username + MD5 password auth, token caching, retry
              logic, adapter registered for future listPlants/telemetry/alerts work.
            </li>
            <li>
              <strong>ShineMonitor</strong>: signature-based auth flow implemented, adapter scaffolded for
              future plant and telemetry endpoints.
            </li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">RBAC, GOVT/ORG Flows, Branding</h3>
          <ul className="list-disc ml-6 text-sm space-y-1">
            <li>
              GOVT and ORG roles with scoped access to organizations, plants, work orders, and an
              aggregated work-order level dashboard.
            </li>
            <li>
              Shared <code className="bg-muted px-1 rounded">/orgs</code> view with GOVT read-only behavior
              and per-organization work-order navigation.
            </li>
            <li>
              Display name and logo support for SUPERADMIN/GOVT/ORG, with sidebar branding and
              a dark-mode friendly UI across core pages.
            </li>
          </ul>
        </section>

        <section className="pt-4 border-t">
          <h2 className="text-xl font-semibold mb-2">
            Current Release – Vendor Plant Sync Strategy & Configuration
          </h2>
          <p className="text-sm mb-3">
            <strong>Goal:</strong> Make periodic sync behavior explicitly vendor-driven by allowing each
            vendor to choose between <strong>plant list</strong> and <strong>per-plant</strong> telemetry modes,
            and by controlling when <code className="bg-muted px-1 rounded">listPlants()</code> runs.
          </p>

          <h3 className="font-semibold mt-2 mb-1">Backend Changes</h3>
          <ul className="list-disc ml-6 text-sm space-y-1">
            <li>
              Added vendor fields via migration
              <code className="bg-muted px-1 rounded">021_add_vendor_plant_sync_config.sql</code>:
              <code className="bg-muted px-1 rounded">plant_sync_mode</code>,
              <code className="bg-muted px-1 rounded">plant_list_sync_morning_ist</code>, and
              <code className="bg-muted px-1 rounded">plant_list_sync_evening_ist</code> with sensible
              defaults.
            </li>
            <li>
              Added <strong>Live Telemetry Sync Mode</strong> configuration via migration
              <code className="bg-muted px-1 rounded">025_add_telemetry_sync_mode.sql</code>:
              <code className="bg-muted px-1 rounded">telemetry_sync_mode</code> and
              <code className="bg-muted px-1 rounded">telemetry_sync_interval</code> (15, 30, or 45 minutes).
              This allows vendors to choose between <code className="bg-muted px-1 rounded">LIST_PLANTS</code> (efficient, single API call) or <code className="bg-muted px-1 rounded">PER_PLANT</code> (individual API calls per plant) for live telemetry updates.
            </li>
            <li>
              Updated <code className="bg-muted px-1 rounded">VendorConfig</code> types and `/api/vendors`
              (GET/POST/PUT) to surface and persist these fields for the UI.
            </li>
            <li>
              Updated <code className="bg-muted px-1 rounded">plantSyncService</code> with
              <code className="bg-muted px-1 rounded">getPlantSyncMode(vendor)</code> and vendor-type-based
              defaults (Solarman/ShineMonitor → list mode; SolarDM/PVBlink → per-plant mode).
            </li>
            <li>
              Updated <code className="bg-muted px-1 rounded">liveTelemetrySyncService</code> to respect
              <code className="bg-muted px-1 rounded">telemetry_sync_mode</code> configuration, supporting both
              <code className="bg-muted px-1 rounded">LIST_PLANTS</code> (bulk fetch) and <code className="bg-muted px-1 rounded">PER_PLANT</code> (individual fetch) modes.
            </li>
            <li>
              For <strong>LIST_PLANTS</strong> vendors, cron behavior is unchanged (interval-based
              <code className="bg-muted px-1 rounded">listPlants()</code> syncs).
            </li>
            <li>
              For <strong>PER_PLANT</strong> vendors, the main cron run skips <code className="bg-muted px-1 rounded">listPlants()</code>
              and expects per-plant telemetry plus twice-daily list refresh at the configured
              morning/evening IST times.
            </li>
            <li>
              Live telemetry sync runs at fixed clock times based on interval (e.g., 15 min = :00, :15, :30, :45)
              and respects restricted sync windows per vendor.
            </li>
          </ul>

          <h3 className="font-semibold mt-3 mb-1">UI Changes – Vendor Configuration</h3>
          <ul className="list-disc ml-6 text-sm space-y-1">
            <li>
              Extended the vendor form model to include
              <code className="bg-muted px-1 rounded">plant_sync_mode</code>,
              <code className="bg-muted px-1 rounded">plant_list_sync_morning_ist</code>, and
              <code className="bg-muted px-1 rounded">plant_list_sync_evening_ist</code> with vendor-type
              specific defaults for existing records.
            </li>
            <li>
              Added a <strong>Plant Sync Strategy</strong> section to the vendor dialog with explicit
              buttons for &quot;Sync via plant list (listPlants)&quot; and &quot;Sync via individual plants&quot;, plus
              time pickers for twice-daily list sync when using per-plant mode.
            </li>
            <li>
              Updated inline copy to clearly document which vendors are typically list-based vs
              per-plant based and how SUPERADMIN/DEVELOPER can override defaults per vendor.
            </li>
          </ul>
        </section>

        <section className="pt-4 border-t">
          <h2 className="text-xl font-semibold mb-2">
            Recent Updates – Security, Performance & Documentation
          </h2>

          <h3 className="font-semibold mt-3 mb-1">Security Enhancements</h3>
          <ul className="list-disc ml-6 text-sm space-y-1">
            <li>
              <strong>RLS Enabled on disabled_plants Table:</strong> Fixed critical security vulnerability by enabling Row Level Security (RLS) on the <code className="bg-muted px-1 rounded">disabled_plants</code> table.
              Added appropriate access policies for SUPERADMIN, DEVELOPER, GOVT, and ORG roles via migration <code className="bg-muted px-1 rounded">028_enable_rls_disabled_plants.sql</code>.
              Policies ensure proper access control: SUPERADMIN and DEVELOPER have full access, GOVT has read-only access to all, and ORG accounts can only view disabled plants in their organization.
            </li>
            <li>
              <strong>Swagger/OpenAPI Documentation Protection:</strong> API documentation endpoints (<code className="bg-muted px-1 rounded">/api-docs</code>, <code className="bg-muted px-1 rounded">/api/docs</code>) are now disabled in production environments to prevent unauthorized access to API details.
              Documentation is only available in development/staging environments.
            </li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">SolarDM listPlant() Implementation - Optimized</h3>
          <ul className="list-disc ml-6 text-sm space-y-1">
            <li>
              <strong>Complete Rewrite:</strong> Completely rewrote <code className="bg-muted px-1 rounded">listPlant()</code> for SolarDM to eliminate inefficient <code className="bg-muted px-1 rounded">listPlants()</code> calls.
              Previously, the method would fetch all plants and filter client-side, which was extremely inefficient for PER_PLANT mode.
            </li>
            <li>
              <strong>New Direct API Endpoints:</strong> Now uses two dedicated SolarDM endpoints:
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li><code className="bg-muted px-1 rounded">GET /dms/plant/{`{vendorPlantId}`}</code> - Fetches plant info (name, network status via <code className="bg-muted px-1 rounded">communicateStatus</code>, last update time)</li>
                <li><code className="bg-muted px-1 rounded">GET /dms/data_panel/metering/sub_v2/{`{vendorPlantId}`}</code> - Fetches live telemetry (power, energy metrics in string format)</li>
              </ul>
            </li>
            <li>
              <strong>String Format Parsing:</strong> Implements <code className="bg-muted px-1 rounded">parseSolarDmValue()</code> helper to parse SolarDM&apos;s unique string format values:
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li>Energy values: <code className="bg-muted px-1 rounded">&quot;12.8_kWh&quot;</code> → extracts <code className="bg-muted px-1 rounded">12.8</code></li>
                <li>Power values: <code className="bg-muted px-1 rounded">&quot;0_KW&quot;</code> → extracts <code className="bg-muted px-1 rounded">0</code></li>
                <li>Handles <code className="bg-muted px-1 rounded">currDay</code>, <code className="bg-muted px-1 rounded">currMonth</code>, <code className="bg-muted px-1 rounded">currYear</code>, <code className="bg-muted px-1 rounded">total</code>, and <code className="bg-muted px-1 rounded">power</code> fields</li>
              </ul>
            </li>
            <li>
              <strong>Live Telemetry Mapping:</strong> Correctly maps all live telemetry fields:
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li><code className="bg-muted px-1 rounded">current_power_kw</code> ← <code className="bg-muted px-1 rounded">energy.power</code> (already in kW)</li>
                <li><code className="bg-muted px-1 rounded">daily_energy_kwh</code> ← <code className="bg-muted px-1 rounded">energy.currDay</code> (kWh)</li>
                <li><code className="bg-muted px-1 rounded">monthly_energy_mwh</code> ← <code className="bg-muted px-1 rounded">energy.currMonth</code> (kWh → MWh conversion)</li>
                <li><code className="bg-muted px-1 rounded">yearly_energy_mwh</code> ← <code className="bg-muted px-1 rounded">energy.currYear</code> (kWh → MWh conversion)</li>
                <li><code className="bg-muted px-1 rounded">total_energy_mwh</code> ← <code className="bg-muted px-1 rounded">energy.total</code> (kWh → MWh conversion)</li>
              </ul>
            </li>
            <li>
              <strong>Network Status Mapping:</strong> Extracts <code className="bg-muted px-1 rounded">communicateStatus</code> from plant info endpoint and maps to standardized <code className="bg-muted px-1 rounded">networkStatus</code>:
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li><code className="bg-muted px-1 rounded">1</code> → <code className="bg-muted px-1 rounded">&quot;NORMAL&quot;</code></li>
                <li><code className="bg-muted px-1 rounded">2</code> → <code className="bg-muted px-1 rounded">&quot;ALL_OFFLINE&quot;</code></li>
                <li><code className="bg-muted px-1 rounded">3</code> → <code className="bg-muted px-1 rounded">&quot;PARTIAL_OFFLINE&quot;</code></li>
              </ul>
            </li>
            <li>
              <strong>Performance Improvement:</strong> 
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li><strong>Before:</strong> Called <code className="bg-muted px-1 rounded">listPlants()</code> for every <code className="bg-muted px-1 rounded">listPlant()</code> call (fetching all plants just to find one)</li>
                <li><strong>After:</strong> Makes exactly 2 direct API calls per plant (plant info + metering)</li>
                <li><strong>Result:</strong> ~75% reduction in API calls for PER_PLANT mode, significantly faster sync times</li>
              </ul>
            </li>
            <li>
              <strong>Error Handling:</strong> Graceful fallback - if plant info fetch fails, still attempts metering endpoint. If metering fails but plant info succeeds, returns minimal plant object with network status.
            </li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">Developer Documentation Portal</h3>
          <ul className="list-disc ml-6 text-sm space-y-1">
            <li>
              <strong>Vendor Configuration Guide:</strong> Added comprehensive &quot;Vendor Config&quot; tab to Documentation &amp; Runbooks page (<code className="bg-muted px-1 rounded">/superadmin/documentation-runbooks</code>) accessible only to DEVELOPER users. The guide includes:
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li>Complete vendor configuration attributes reference (basic info, token storage, sync modes, restricted windows)</li>
                <li>Detailed explanation of Plant Sync Mode vs Live Telemetry Sync Mode</li>
                <li>LIST_PLANTS vs PER_PLANT mode explanations with examples</li>
                <li>How syncs work together for different vendor types (Solarman vs SolarDM scenarios)</li>
                <li>Key differences summary table</li>
                <li>Best practices for configuration</li>
                <li>Troubleshooting guides for common sync issues</li>
              </ul>
            </li>
            <li>
              <strong>System Flow Documentation Updates:</strong> 
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li>Updated SolarDM <code className="bg-muted px-1 rounded">listPlant()</code> API documentation with correct endpoints and response format examples</li>
                <li>Added detailed database field mappings with conversion logic</li>
                <li>Documented the optimization (no longer calls <code className="bg-muted px-1 rounded">listPlants()</code>)</li>
                <li>Added code blocks showing actual API responses from SolarDM</li>
              </ul>
            </li>
            <li>
              <strong>Alert Sync Flow Documentation:</strong> Added comprehensive Alert Sync Flow section under the &quot;Flows&quot; tab in System Flow documentation, covering:
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li>Entry points (auto cron, manual trigger, external cron)</li>
                <li>Complete flow diagram and step-by-step process</li>
                <li>Vendor-specific implementations (Solarman, SolarDM)</li>
                <li>Alert processing details (mapping, grid-down calculations, status determination)</li>
                <li>Important notes about date parsing and filtering</li>
              </ul>
            </li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">Database & Schema Updates</h3>
          <ul className="list-disc ml-6 text-sm space-y-1">
            <li>
              <strong>Disabled Plants Logic:</strong> Updated from 15 days to 3 days proactively - plants inactive for 3+ days are now marked as disabled (migration <code className="bg-muted px-1 rounded">027_update_disable_plants_to_3_days.sql</code>).
              This provides faster detection of inactive plants and more responsive system behavior.
            </li>
            <li>
              <strong>Unused Tables Removed:</strong> Dropped deprecated <code className="bg-muted px-1 rounded">work_order_plant_eff</code> table and unused telemetry database tables via migration <code className="bg-muted px-1 rounded">026_drop_unused_tables.sql</code>.
              Removed all references to PR (Performance Ratio) calculations from the codebase.
            </li>
            <li>
              <strong>RLS Security Fix:</strong> Added migration <code className="bg-muted px-1 rounded">028_enable_rls_disabled_plants.sql</code> to enable Row Level Security on <code className="bg-muted px-1 rounded">disabled_plants</code> table with proper access policies for all roles.
            </li>
          </ul>

          <h3 className="font-semibold mt-4 mb-1">Excel Import/Export Features</h3>
          <ul className="list-disc ml-6 text-sm space-y-1">
            <li>
              <strong>Work Orders Export/Import:</strong> Added Excel export and import functionality for work orders (SUPERADMIN/DEVELOPER only). 
              Export includes all work order details with associated plant information using <code className="bg-muted px-1 rounded">Vendor Plant ID</code> and <code className="bg-muted px-1 rounded">Plant Name</code> instead of internal IDs.
              Import supports bulk creation with validation (prevents duplicates, validates plant mappings, reports processing results).
            </li>
            <li>
              <strong>Vendors Export/Import:</strong> Added Excel export and import functionality for vendors (SUPERADMIN/DEVELOPER only). 
              Export includes vendor configuration, credentials (JSON format), sync settings, and token metadata. 
              Import supports bulk vendor management with mandatory fields validation (Name, Vendor Type, Organization ID, Credentials).
            </li>
            <li>
              <strong>Accounts Management:</strong> Excel import/export capabilities for account management, enabling bulk operations for user accounts across organizations.
              Export includes account details (excluding passwords for security). Import supports bulk account creation with password hashing and role validation.
            </li>
          </ul>
        </section>

        <section className="pt-4 border-t">
          <h2 className="text-xl font-semibold mb-2">New Relic APM Onboarding (Developer View)</h2>
          <p className="text-sm mb-3">
            These are the concrete steps we will follow to bring New Relic APM into the Solar
            Information System. Use this as a checklist while you complete your New Relic account
            setup; once that is done, we will wire the agent and custom metrics into the codebase.
          </p>

          <ol className="list-decimal ml-6 text-sm space-y-2">
            <li>
              <strong>Create / verify New Relic account</strong>
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li>
                  Sign up at{" "}
                  <code className="bg-muted px-1 rounded">https://newrelic.com/signup</code> and
                  choose the Free tier.
                </li>
                <li>
                  In <em>APM &amp; Services</em>, create an application entry (e.g.{" "}
                  <code className="bg-muted px-1 rounded">Solar Information System</code>).
                </li>
                <li>
                  Copy the <strong>license key</strong> from Account settings → API keys.
                </li>
              </ul>
            </li>

            <li>
              <strong>Prepare environment configuration</strong>
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li>
                  Add the following vars to the deployment environment (not committed to git):
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">
                    NEW_RELIC_LICENSE_KEY=&lt;your-license-key&gt;
                  </code>
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">
                    NEW_RELIC_APP_NAME=Solar Information System
                  </code>
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">NEW_RELIC_ENABLED=true</code>
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">
                    NEW_RELIC_LABELS=environment:production,team:engineering
                  </code>
                </li>
              </ul>
            </li>

            <li>
              <strong>Agent installation &amp; bootstrap (to be wired after onboarding)</strong>
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li>
                  Install the agent with{" "}
                  <code className="bg-muted px-1 rounded">npm install newrelic --save</code>.
                </li>
                <li>
                  Create <code className="bg-muted px-1 rounded">newrelic.js</code> at the project
                  root with app name, license key, logging and distributed tracing enabled.
                </li>
                <li>
                  Require <code className="bg-muted px-1 rounded">newrelic</code> first in{" "}
                  <code className="bg-muted px-1 rounded">server.js</code> (and optionally
                  <code className="bg-muted px-1 rounded">next.config.js</code>) so the agent wraps
                  all Next.js and cron requests.
                </li>
              </ul>
            </li>

            <li>
              <strong>Custom business metrics (sync + telemetry)</strong>
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li>
                  Introduce <code className="bg-muted px-1 rounded">
                    lib/monitoring/newrelic.ts
                  </code>{" "}
                  with helpers:
                  <code className="bg-muted px-1 rounded">recordVendorSyncMetrics</code>,{" "}
                  <code className="bg-muted px-1 rounded">recordPlantSyncMetrics</code>,{" "}
                  <code className="bg-muted px-1 rounded">recordLiveTelemetrySyncMetrics</code>,{" "}
                  <code className="bg-muted px-1 rounded">recordAlertSyncMetrics</code>, and{" "}
                  <code className="bg-muted px-1 rounded">recordApiMetrics</code>.
                </li>
                <li>
                  Call these from <code className="bg-muted px-1 rounded">
                    plantSyncService
                  </code>
                  ,{" "}
                  <code className="bg-muted px-1 rounded">
                    liveTelemetrySyncService
                  </code>
                  ,{" "}
                  <code className="bg-muted px-1 rounded">alertSyncService</code> and key API
                  routes to capture duration, success/failure and counts.
                </li>
              </ul>
            </li>

            <li>
              <strong>Dashboards, SLOs and alerts inside New Relic</strong>
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li>
                  Create dashboards for: vendor sync duration, plants processed, live telemetry
                  latency and API error rate using NRQL on{" "}
                  <code className="bg-muted px-1 rounded">VendorSync</code>,{" "}
                  <code className="bg-muted px-1 rounded">PlantSync</code>,{" "}
                  <code className="bg-muted px-1 rounded">LiveTelemetrySync</code> and{" "}
                  <code className="bg-muted px-1 rounded">ApiRequest</code> events.
                </li>
                <li>
                  Define SLOs: plant sync success &gt;= 99.5%, API P95 &lt; 500ms, vendor sync
                  duration &lt; 60s for 90% of runs, each with alert conditions wired to email/Slack.
                </li>
              </ul>
            </li>
          </ol>

          <p className="text-xs text-muted-foreground mt-4">
            A more exhaustive step-by-step version of this plan also lives in the repository as{" "}
            <code className="bg-muted px-1 rounded">docs/NEW_RELIC_APM_SETUP.md</code> for offline
            reference. The portal view above is the canonical checklist for Developer onboarding.
          </p>
        </section>
      </Card>
    </div>
  );
}

export default ReleaseNotes;

