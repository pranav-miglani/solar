/**
 * Pooled Supabase clients with connection pooling
 * Reuses client instances and HTTP connections for better performance
 * Includes automatic query logging for debugging
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

  // Create client with custom fetch that uses connection pooling
  const client = createClient(supabaseUrl, supabaseServiceKey, {
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

  // Wrap the client to log all queries
  mainClient = createQueryLoggingClient(client, "main")

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

  const client = createClient(analyticsUrl, analyticsServiceKey, {
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

  // Wrap the client to log all queries
  analyticsClient = createQueryLoggingClient(client, "analytics")

  return analyticsClient
}

/**
 * Create a Supabase client wrapper that logs all queries
 */
function createQueryLoggingClient(client: SupabaseClient, dbName: string): SupabaseClient {
  return new Proxy(client, {
    get(target, prop) {
      const original = target[prop as keyof SupabaseClient]
      
      // Intercept the 'from' method to log table queries
      if (prop === "from") {
        const fromMethod = original as (table: string) => any
        return function (table: string) {
          const queryBuilder = fromMethod.call(target, table)
          
          // Wrap the query builder to log operations
          return new Proxy(queryBuilder, {
            get(queryTarget, queryProp) {
              const queryOriginal = queryTarget[queryProp as keyof typeof queryTarget]
              
              if (typeof queryOriginal === "function") {
                return function (this: any, ...args: any[]) {
                  const startTime = Date.now()
                  
                  // Log SELECT queries
                  if (queryProp === "select") {
                    const selectArg = args[0] || "*"
                    const options = args[1] || {}
                    const selectFields = typeof selectArg === "string" 
                      ? (selectArg === "*" ? ["*"] : [selectArg])
                      : selectArg
                    
                    logger.debug(
                      `[SQL:${dbName}] SELECT ${selectFields.join(", ")} FROM ${table}` +
                      (options.count ? ` COUNT=${options.count}` : "") +
                      (options.head ? " HEAD" : "") +
                      (options.single ? " SINGLE" : "") +
                      (options.maybeSingle ? " MAYBE_SINGLE" : "")
                    )
                    
                    const result = queryOriginal.apply(queryTarget, args)
                    
                    if (result && typeof result.then === "function") {
                      return result.then(
                        (data: any) => {
                          const duration = Date.now() - startTime
                          const rowCount = Array.isArray(data?.data) 
                            ? data.data.length 
                            : (data?.data ? 1 : (data?.count || 0))
                          
                          if (data?.error) {
                            logger.error(
                              `[SQL:${dbName}] SELECT FROM ${table} FAILED (${duration}ms):`,
                              data.error,
                              { code: data.error.code, message: data.error.message }
                            )
                          } else {
                            logger.debug(
                              `[SQL:${dbName}] SELECT FROM ${table} SUCCESS: ${rowCount} row(s) in ${duration}ms`
                            )
                          }
                          return data
                        },
                        (error: any) => {
                          const duration = Date.now() - startTime
                          logger.error(`[SQL:${dbName}] SELECT FROM ${table} ERROR (${duration}ms):`, error)
                          throw error
                        }
                      )
                    }
                    
                    return result
                  }
                  
                  // Log INSERT/UPSERT queries
                  if (queryProp === "insert" || queryProp === "upsert") {
                    const data = args[0]
                    const options = args[1] || {}
                    const isUpsert = queryProp === "upsert" || options.upsert
                    const rowCount = Array.isArray(data) ? data.length : 1
                    
                    logger.debug(
                      `[SQL:${dbName}] ${isUpsert ? "UPSERT" : "INSERT"} INTO ${table} (${rowCount} row(s))`
                    )
                    
                    if (rowCount === 1 && data && typeof data === "object") {
                      // Log first row data (truncated)
                      const dataStr = JSON.stringify(data)
                      if (dataStr.length > 300) {
                        logger.debug(`[SQL:${dbName}] Data: ${dataStr.substring(0, 300)}...`)
                      } else {
                        logger.debug(`[SQL:${dbName}] Data: ${dataStr}`)
                      }
                    }
                    
                    const result = queryOriginal.apply(queryTarget, args)
                    
                    if (result && typeof result.then === "function") {
                      return result.then(
                        (data: any) => {
                          const duration = Date.now() - startTime
                          const resultCount = Array.isArray(data?.data) 
                            ? data.data.length 
                            : (data?.data ? 1 : 0)
                          
                          if (data?.error) {
                            logger.error(
                              `[SQL:${dbName}] ${isUpsert ? "UPSERT" : "INSERT"} INTO ${table} FAILED (${duration}ms):`,
                              data.error,
                              { code: data.error.code, message: data.error.message }
                            )
                          } else {
                            logger.debug(
                              `[SQL:${dbName}] ${isUpsert ? "UPSERT" : "INSERT"} INTO ${table} SUCCESS: ${resultCount} row(s) affected in ${duration}ms`
                            )
                          }
                          return data
                        },
                        (error: any) => {
                          const duration = Date.now() - startTime
                          logger.error(`[SQL:${dbName}] ${isUpsert ? "UPSERT" : "INSERT"} INTO ${table} ERROR (${duration}ms):`, error)
                          throw error
                        }
                      )
                    }
                    
                    return result
                  }
                  
                  // Log UPDATE queries
                  if (queryProp === "update") {
                    const data = args[0]
                    const dataStr = JSON.stringify(data)
                    const truncatedData = dataStr.length > 300 ? dataStr.substring(0, 300) + "..." : dataStr
                    
                    logger.debug(`[SQL:${dbName}] UPDATE ${table} SET ${truncatedData}`)
                    
                    const result = queryOriginal.apply(queryTarget, args)
                    
                    if (result && typeof result.then === "function") {
                      return result.then(
                        (data: any) => {
                          const duration = Date.now() - startTime
                          const resultCount = Array.isArray(data?.data) 
                            ? data.data.length 
                            : (data?.data ? 1 : 0)
                          
                          if (data?.error) {
                            logger.error(
                              `[SQL:${dbName}] UPDATE ${table} FAILED (${duration}ms):`,
                              data.error,
                              { code: data.error.code, message: data.error.message }
                            )
                          } else {
                            logger.debug(
                              `[SQL:${dbName}] UPDATE ${table} SUCCESS: ${resultCount} row(s) affected in ${duration}ms`
                            )
                          }
                          return data
                        },
                        (error: any) => {
                          const duration = Date.now() - startTime
                          logger.error(`[SQL:${dbName}] UPDATE ${table} ERROR (${duration}ms):`, error)
                          throw error
                        }
                      )
                    }
                    
                    return result
                  }
                  
                  // Log DELETE queries
                  if (queryProp === "delete") {
                    logger.debug(`[SQL:${dbName}] DELETE FROM ${table}`)
                    
                    const result = queryOriginal.apply(queryTarget, args)
                    
                    if (result && typeof result.then === "function") {
                      return result.then(
                        (data: any) => {
                          const duration = Date.now() - startTime
                          const resultCount = Array.isArray(data?.data) 
                            ? data.data.length 
                            : (data?.data ? 1 : 0)
                          
                          if (data?.error) {
                            logger.error(
                              `[SQL:${dbName}] DELETE FROM ${table} FAILED (${duration}ms):`,
                              data.error,
                              { code: data.error.code, message: data.error.message }
                            )
                          } else {
                            logger.debug(
                              `[SQL:${dbName}] DELETE FROM ${table} SUCCESS: ${resultCount} row(s) affected in ${duration}ms`
                            )
                          }
                          return data
                        },
                        (error: any) => {
                          const duration = Date.now() - startTime
                          logger.error(`[SQL:${dbName}] DELETE FROM ${table} ERROR (${duration}ms):`, error)
                          throw error
                        }
                      )
                    }
                    
                    return result
                  }
                  
                  // For filter methods (eq, neq, gt, etc.), log them
                  if (["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "contains", "containedBy", "rangeGt", "rangeGte", "rangeLt", "rangeLte", "rangeAdjacent", "overlaps", "textSearch", "match", "not", "or", "filter", "order", "limit", "offset"].includes(queryProp as string)) {
                    const filterValue = args[0]
                    const filterStr = typeof filterValue === "object" 
                      ? JSON.stringify(filterValue).substring(0, 100)
                      : String(filterValue)
                    
                    logger.debug(`[SQL:${dbName}] ${table}.${String(queryProp)}(${filterStr})`)
                  }
                  
                  return queryOriginal.apply(queryTarget, args)
                }
              }
              
              return queryOriginal
            },
          })
        }
      }
      
      // Intercept RPC calls
      if (prop === "rpc") {
        const rpcMethod = original as (functionName: string, params?: any) => any
        return function (functionName: string, params?: any) {
          const startTime = Date.now()
          const paramsStr = params ? JSON.stringify(params).substring(0, 200) : ""
          
          logger.debug(`[SQL:${dbName}] RPC ${functionName}(${paramsStr})`)
          
          const result = rpcMethod.call(target, functionName, params)
          
          if (result && typeof result.then === "function") {
            return result.then(
              (data: any) => {
                const duration = Date.now() - startTime
                
                if (data?.error) {
                  logger.error(
                    `[SQL:${dbName}] RPC ${functionName} FAILED (${duration}ms):`,
                    data.error,
                    { code: data.error.code, message: data.error.message }
                  )
                } else {
                  logger.debug(`[SQL:${dbName}] RPC ${functionName} SUCCESS in ${duration}ms`)
                }
                return data
              },
              (error: any) => {
                const duration = Date.now() - startTime
                logger.error(`[SQL:${dbName}] RPC ${functionName} ERROR (${duration}ms):`, error)
                throw error
              }
            )
          }
          
          return result
        }
      }
      
      return original
    },
  }) as SupabaseClient
}

/**
 * Reset pooled clients (useful for testing or reconfiguration)
 */
export function resetPooledClients(): void {
  mainClient = null
  analyticsClient = null
}

