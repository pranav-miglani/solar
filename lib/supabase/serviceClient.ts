import { createClient, SupabaseClient } from "@supabase/supabase-js"

/**
 * Main Database Client with Connection Pooling
 * 
 * This module provides a shared Supabase client instance for the MAIN database
 * that's reused across all API routes, enabling proper connection pooling.
 * 
 * Connection pooling benefits:
 * - Reuses existing database connections instead of creating new ones
 * - Reduces connection overhead and improves performance
 * - Prevents connection exhaustion under high load
 * - Better resource utilization
 */

let mainDBClient: SupabaseClient | null = null

/**
 * Get or create the singleton Main Database client
 * 
 * This client uses the service role key to bypass RLS policies.
 * It's configured with connection pooling enabled by default.
 * 
 * @returns Supabase client instance (singleton) for the main database
 */
export function getMainDBClient(): SupabaseClient {
  if (mainDBClient) {
    return mainDBClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase service role key for main database")
  }

  // Create client with connection pooling configuration
  mainDBClient = createClient(supabaseUrl, supabaseServiceKey, {
    // Connection pooling configuration
    db: {
      // Use connection pooling (Supabase handles this via connection string)
      // The service role key automatically uses pooled connections
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
        "x-client-info": "woms-main-db-client",
      },
    },
  })

  return mainDBClient
}

/**
 * @deprecated Use getMainDBClient() instead. This function is kept for backward compatibility.
 * Get or create the singleton Supabase service client (Main Database)
 * 
 * @returns Supabase client instance (singleton) for the main database
 */
export function getServiceClient(): SupabaseClient {
  return getMainDBClient()
}

/**
 * Reset the main database client (useful for testing or reconfiguration)
 */
export function resetMainDBClient(): void {
  if (mainDBClient) {
    // Close any open connections if needed
    mainDBClient = null
  }
}

/**
 * @deprecated Use resetMainDBClient() instead
 */
export function resetServiceClient(): void {
  resetMainDBClient()
}

/**
 * Get main database client information
 * Note: Supabase manages connection pooling internally,
 * so we can't directly access pool stats, but we can track client usage
 */
export function getMainDBClientInfo(): {
  initialized: boolean
  url: string | undefined
} {
  return {
    initialized: mainDBClient !== null,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  }
}

/**
 * @deprecated Use getMainDBClientInfo() instead
 */
export function getServiceClientInfo(): {
  initialized: boolean
  url: string | undefined
} {
  return getMainDBClientInfo()
}
