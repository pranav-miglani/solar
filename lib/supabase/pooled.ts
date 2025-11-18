/**
 * Pooled Supabase clients with connection pooling
 * Reuses client instances and HTTP connections for better performance
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { pooledFetch } from "../vendors/httpClient"

// Singleton instances for pooled clients
let mainClient: SupabaseClient | null = null
let telemetryClient: SupabaseClient | null = null

/**
 * Get or create the main database client with connection pooling
 * Uses service role key to bypass RLS
 * Connects to: NEXT_PUBLIC_SUPABASE_URL (Main Supabase instance)
 */
export function getMainClient(): SupabaseClient {
  if (mainClient) {
    return mainClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase service role key. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.")
  }

  // Validate that main and telemetry URLs are different
  const telemetryUrl = process.env.TELEMETRY_SUPABASE_URL
  if (telemetryUrl && supabaseUrl === telemetryUrl) {
    console.warn(
      "⚠️ WARNING: Main and Telemetry Supabase URLs are the same!",
      `Both pointing to: ${supabaseUrl}`,
      "They should be different Supabase instances."
    )
  }

  console.log(`📊 [Main DB] Connecting to: ${supabaseUrl}`)

  // Create client with custom fetch that uses connection pooling
  mainClient = createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      fetch: pooledFetch as typeof fetch,
    },
    db: {
      schema: "public",
    },
    auth: {
      persistSession: false, // Service role clients don't need session persistence
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  return mainClient
}

/**
 * Get or create the telemetry database client with connection pooling
 * Uses service role key to bypass RLS
 * Connects to: TELEMETRY_SUPABASE_URL (Separate Telemetry Supabase instance)
 */
export function getTelemetryClient(): SupabaseClient {
  if (telemetryClient) {
    return telemetryClient
  }

  const telemetrySupabaseUrl = process.env.TELEMETRY_SUPABASE_URL
  const telemetrySupabaseServiceKey = process.env.TELEMETRY_SUPABASE_SERVICE_ROLE_KEY

  if (!telemetrySupabaseUrl || !telemetrySupabaseServiceKey) {
    throw new Error("Missing Telemetry Supabase service role key. Ensure TELEMETRY_SUPABASE_URL and TELEMETRY_SUPABASE_SERVICE_ROLE_KEY are set.")
  }

  // Validate that main and telemetry URLs are different
  const mainUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (mainUrl && telemetrySupabaseUrl === mainUrl) {
    console.warn(
      "⚠️ WARNING: Main and Telemetry Supabase URLs are the same!",
      `Both pointing to: ${telemetrySupabaseUrl}`,
      "They should be different Supabase instances."
    )
  }

  console.log(`📊 [Telemetry DB] Connecting to: ${telemetrySupabaseUrl}`)

  // Create client with custom fetch that uses connection pooling
  telemetryClient = createClient(telemetrySupabaseUrl, telemetrySupabaseServiceKey, {
    global: {
      fetch: pooledFetch as typeof fetch,
    },
    db: {
      schema: "public",
    },
    auth: {
      persistSession: false, // Service role clients don't need session persistence
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  return telemetryClient
}

/**
 * Reset pooled clients (useful for testing or reconfiguration)
 */
export function resetPooledClients(): void {
  mainClient = null
  telemetryClient = null
}

