/**
 * Pooled Supabase clients with connection pooling
 * Reuses client instances and HTTP connections for better performance
 * Includes automatic query logging for debugging (via fetch wrapper)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js"
import { pooledFetch } from "../vendors/httpClient"
import { logger } from "../context/logger"

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

  console.log(`📊 [Main DB] Connecting to: ${supabaseUrl}`)

  // Create client with custom fetch that uses connection pooling and logging
  mainClient = createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      fetch: createLoggingFetch(pooledFetch, "main"),
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

  console.log(`📊 [Analytics DB] Connecting to: ${analyticsUrl}`)

  analyticsClient = createClient(analyticsUrl, analyticsServiceKey, {
    global: {
      fetch: createLoggingFetch(pooledFetch, "analytics"),
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
 * Create a fetch wrapper that logs all Supabase PostgREST API calls
 * This is much simpler than wrapping the entire client - we just log HTTP requests
 */
function createLoggingFetch(fetchFn: typeof fetch, dbName: string): typeof fetch {
  // Check if SQL logging is enabled via environment variable
  const enableSqlLogging = process.env.ENABLE_SQL_LOGGING !== "false" // Default to true
  
  if (!enableSqlLogging) {
    return fetchFn as typeof fetch
  }
  
  return async function (url: string | URL, options?: RequestInit): Promise<Response> {
    const startTime = Date.now()
    const urlObj = typeof url === "string" ? new URL(url) : url
    const pathname = urlObj.pathname
    
    // Extract table name and operation from PostgREST URL
    // Format: /rest/v1/table_name or /rest/v1/rpc/function_name
    const restMatch = pathname.match(/\/rest\/v1\/(.+)$/)
    const resource = restMatch ? restMatch[1] : pathname
    
    // Determine operation from HTTP method
    const method = options?.method || "GET"
    let operation = method
    
    // Log the request
    logger.debug(`[SQL:${dbName}] ${method} ${pathname}${urlObj.search ? `?${urlObj.search}` : ""}`)
    
    // Log request body for POST/PATCH/PUT
    if (options?.body && (method === "POST" || method === "PATCH" || method === "PUT")) {
      try {
        const bodyStr = typeof options.body === "string" 
          ? options.body 
          : JSON.stringify(options.body)
        const truncatedBody = bodyStr.length > 500 ? bodyStr.substring(0, 500) + "..." : bodyStr
        logger.debug(`[SQL:${dbName}] Request body: ${truncatedBody}`)
      } catch (e) {
        // Ignore body logging errors
      }
    }
    
    try {
      const response = await fetchFn(url, options)
      const duration = Date.now() - startTime
      
      // Clone response to read body without consuming it
      const clonedResponse = response.clone()
      
      // Log response status and size
      const contentType = response.headers.get("content-type") || ""
      const contentLength = response.headers.get("content-length")
      
      if (!response.ok) {
        // For errors, log the error response
        try {
          const errorData = await clonedResponse.json().catch(() => null)
          logger.error(
            `[SQL:${dbName}] ${method} ${pathname} FAILED (${duration}ms): ${response.status} ${response.statusText}`,
            errorData
          )
        } catch (e) {
          logger.error(
            `[SQL:${dbName}] ${method} ${pathname} FAILED (${duration}ms): ${response.status} ${response.statusText}`
          )
        }
      } else {
        // For success, log summary
        if (contentType.includes("application/json")) {
          try {
            const data = await clonedResponse.json().catch(() => null)
            if (data) {
              const rowCount = Array.isArray(data) ? data.length : (data?.count || (data ? 1 : 0))
              logger.debug(
                `[SQL:${dbName}] ${method} ${pathname} SUCCESS: ${rowCount} row(s) in ${duration}ms`
              )
            } else {
              logger.debug(`[SQL:${dbName}] ${method} ${pathname} SUCCESS in ${duration}ms`)
            }
          } catch (e) {
            logger.debug(`[SQL:${dbName}] ${method} ${pathname} SUCCESS in ${duration}ms`)
          }
        } else {
          logger.debug(`[SQL:${dbName}] ${method} ${pathname} SUCCESS in ${duration}ms`)
        }
      }
      
      return response
    } catch (error) {
      const duration = Date.now() - startTime
      logger.error(`[SQL:${dbName}] ${method} ${pathname} ERROR (${duration}ms):`, error)
      throw error
    }
  } as typeof fetch
}

/**
 * Reset pooled clients (useful for testing or reconfiguration)
 */
export function resetPooledClients(): void {
  mainClient = null
  analyticsClient = null
}

