/**
 * Pooled Supabase clients with connection pooling
 * Reuses client instances and HTTP connections for better performance
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { pooledFetch } from "../vendors/httpClient"

// Singleton instances for pooled clients
let mainClient: SupabaseClient | null = null
let analyticsClient: SupabaseClient | null = null

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
 * Get or create the analytics database client with connection pooling
 * Uses service role key to bypass RLS
 * Connects to: ANALYTICS_SUPABASE_URL (separate analytics Supabase instance)
 */
export function getAnalyticsClient(): SupabaseClient {
  if (analyticsClient) {
    return analyticsClient
  }

  const analyticsUrl = process.env.ANALYTICS_SUPABASE_URL
  const analyticsServiceKey = process.env.ANALYTICS_SUPABASE_SERVICE_ROLE_KEY

  if (!analyticsUrl || !analyticsServiceKey) {
    throw new Error("Missing analytics Supabase service role key. Ensure ANALYTICS_SUPABASE_URL and ANALYTICS_SUPABASE_SERVICE_ROLE_KEY are set.")
  }

  analyticsClient = createClient(analyticsUrl, analyticsServiceKey, {
    global: {
      fetch: pooledFetch as typeof fetch,
    },
    db: {
      schema: "public",
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  return analyticsClient
}

/**
 * Reset pooled clients (useful for testing or reconfiguration)
 */
export function resetPooledClients(): void {
  mainClient = null
  analyticsClient = null
}

