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
  // Cast pooledFetch to match fetch signature (pooledFetch accepts string | URL, but fetch accepts RequestInfo | URL)
  const loggingFetch = createLoggingFetch(pooledFetch as typeof fetch, "main")
  mainClient = createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      fetch: loggingFetch,
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

  // Cast pooledFetch to match fetch signature
  const analyticsLoggingFetch = createLoggingFetch(pooledFetch as typeof fetch, "analytics")
  analyticsClient = createClient(analyticsUrl, analyticsServiceKey, {
    global: {
      fetch: analyticsLoggingFetch,
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
  
  return async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const startTime = Date.now()
    
    // Extract URL from input (handles string, URL, or Request)
    let urlStr: string
    if (typeof input === "string") {
      urlStr = input
    } else if (input instanceof URL) {
      urlStr = input.toString()
    } else {
      // It's a Request object
      urlStr = input.url
    }
    
    const urlObj = new URL(urlStr)
    const pathname = urlObj.pathname
    
    // Determine operation from HTTP method
    const method = init?.method || (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET") || "GET"
    
    // Log the request
    logger.debug(`[SQL:${dbName}] ${method} ${pathname}${urlObj.search ? `?${urlObj.search}` : ""}`)
    
    // Log request body for POST/PATCH/PUT
    if (init?.body && (method === "POST" || method === "PATCH" || method === "PUT")) {
      try {
        const bodyStr = typeof init.body === "string" 
          ? init.body 
          : JSON.stringify(init.body)
        const truncatedBody = bodyStr.length > 500 ? bodyStr.substring(0, 500) + "..." : bodyStr
        logger.debug(`[SQL:${dbName}] Request body: ${truncatedBody}`)
      } catch (e) {
        // Ignore body logging errors
      }
    }
    
    try {
      const response = await fetchFn(input, init)
      const duration = Date.now() - startTime
      
      // Clone response to read body without consuming it
      const clonedResponse = response.clone()
      
      // Log response status and size
      const contentType = response.headers.get("content-type") || ""
      
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

