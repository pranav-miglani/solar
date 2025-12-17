'use strict'

/**
 * New Relic agent configuration for Solar Information System (SIS).
 * Values are intentionally driven by environment variables so that
 * secrets (license key) are never committed to the repository.
 *
 * Reference:
 * https://docs.newrelic.com/docs/apm/agents/nodejs-agent/configuration/nodejs-agent-configuration
 */

// Validate critical configuration
const isEnabled = process.env.NEW_RELIC_ENABLED === 'true'
const licenseKey = process.env.NEW_RELIC_LICENSE_KEY

// Warn if enabled but license key is missing
if (isEnabled && !licenseKey) {
  console.warn(
    '[WARN] New Relic is enabled but NEW_RELIC_LICENSE_KEY is not set. ' +
    'New Relic agent will not function properly.'
  )
}

exports.config = {
  /**
   * Application name as it should appear in the New Relic UI.
   * This will use NEW_RELIC_APP_NAME if provided, otherwise it falls
   * back to a sensible default.
   */
  app_name: [process.env.NEW_RELIC_APP_NAME || 'Solar Information System'],

  /**
   * New Relic license key.
   * NEVER hard-code this; always provide it via NEW_RELIC_LICENSE_KEY
   * in the deployment environment.
   */
  license_key: licenseKey,

  /**
   * Toggle agent based on environment. We only enable it when
   * NEW_RELIC_ENABLED=true. In local development this can remain off.
   */
  agent_enabled: isEnabled,

  /**
   * Enable distributed tracing so that vendor sync cron jobs and
   * API requests can be stitched together in traces.
   */
  distributed_tracing: {
    enabled: true,
  },

  /**
   * Logging configuration for the agent itself.
   */
  logging: {
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
    filepath: 'stdout',
  },

  /**
   * Error collection.
   */
  error_collector: {
    enabled: true,
    capture_events: true,
    max_event_samples_stored: 100,
  },

  /**
   * Transaction tracing configuration.
   */
  transaction_tracer: {
    enabled: true,
    record_sql: 'obfuscated',
    explain_threshold: 500, // ms
  },

  /**
   * Allow sending custom events for business metrics (VendorSync, PlantSync, etc.).
   */
  custom_insights_events: {
    enabled: true,
    max_samples_stored: 10000,
  },

  /**
   * Application logging forwarding into New Relic.
   */
  application_logging: {
    enabled: true,
    forwarding: {
      enabled: true,
      max_samples_stored: 10000,
    },
    local_decorating: {
      enabled: false,
    },
  },

  /**
   * Browser monitoring (disabled for API-only application).
   */
  browser_monitoring: {
    enable: false,
  },

  /**
   * Optional labels to help group this app in New Relic UI.
   * Format: 'key1:value1;key2:value2' (semicolon-separated, not comma)
   * Example: 'environment:production;deployment:ec2'
   */
  labels: process.env.NEW_RELIC_LABELS 
    ? process.env.NEW_RELIC_LABELS.replace(/,/g, ';') // Convert commas to semicolons
    : 'environment:production',
}


