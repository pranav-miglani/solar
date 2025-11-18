import { createClient, SupabaseClient } from "@supabase/supabase-js"

/**
 * Telemetry Database Client with Connection Pooling
 * 
 * This module provides a shared Supabase client instance for the TELEMETRY database
 * that's reused across all telemetry API routes, enabling proper connection pooling.
 * 
 * This is a SEPARATE client from the main database client. Both implement
 * independent connection pooling for optimal performance.
 * 
 * Connection pooling benefits:
 * - Reuses existing database connections instead of creating new ones
 * - Reduces connection overhead and improves performance
 * - Prevents connection exhaustion under high load
 * - Better resource utilization
 * 
 * Note: If TELEMETRY_SUPABASE_URL is not configured, this will use the main database
 * URL but maintain a separate client instance for connection pooling.
 */

let telemetryDBClient: SupabaseClient | null = null

/**
 * Get or create the singleton Telemetry Database client
 * 
 * This client uses the service role key to bypass RLS policies.
 * It's configured with connection pooling enabled by default.
 * 
 * This is a SEPARATE client from the main database client, ensuring
 * independent connection pools for telemetry operations.
 * 
 * @returns Supabase client instance (singleton) for telemetry database
 */
export function getTelemetryDBClient(): SupabaseClient {
  if (telemetryDBClient) {
    return telemetryDBClient
  }

  // Check if separate telemetry database is configured
  const telemetryUrl = process.env.TELEMETRY_SUPABASE_URL
  const telemetryServiceKey = process.env.TELEMETRY_SUPABASE_SERVICE_ROLE_KEY

  // If telemetry DB is configured, use it; otherwise use main DB URL (but separate client)
  const supabaseUrl = telemetryUrl || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = telemetryServiceKey || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase service role key for telemetry database")
  }

  // Create client with connection pooling configuration
  // This is a SEPARATE client instance from the main DB client
  telemetryDBClient = createClient(supabaseUrl, supabaseServiceKey, {
    db: {
      schema: "public",
    },
    auth: {
      // Auto-refresh session is not needed for service role
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      // Headers to include with all requests
      headers: {
        "x-client-info": "woms-telemetry-db-client",
      },
    },
  })

  return telemetryDBClient
}

/**
 * @deprecated Use getTelemetryDBClient() instead. This function is kept for backward compatibility.
 */
export function getTelemetryClient(): SupabaseClient {
  return getTelemetryDBClient()
}

/**
 * Reset the telemetry database client (useful for testing or reconfiguration)
 */
export function resetTelemetryDBClient(): void {
  if (telemetryDBClient) {
    telemetryDBClient = null
  }
}

/**
 * @deprecated Use resetTelemetryDBClient() instead
 */
export function resetTelemetryClient(): void {
  resetTelemetryDBClient()
}

/**
 * Get telemetry database client information
 */
export function getTelemetryDBClientInfo(): {
  initialized: boolean
  url: string | undefined
  isSeparateDatabase: boolean
} {
  return {
    initialized: telemetryDBClient !== null,
    url: process.env.TELEMETRY_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    isSeparateDatabase: !!process.env.TELEMETRY_SUPABASE_URL,
  }
}

/**
 * @deprecated Use getTelemetryDBClientInfo() instead
 */
export function getTelemetryClientInfo(): {
  initialized: boolean
  url: string | undefined
  isSeparateDatabase: boolean
} {
  return getTelemetryDBClientInfo()
}

