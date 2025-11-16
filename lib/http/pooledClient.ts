import { Agent, fetch as undiciFetch } from 'undici'

/**
 * HTTP Connection Pooling Configuration
 * 
 * This module provides a pooled HTTP client for vendor API calls.
 * Connection pooling improves performance by reusing TCP connections
 * instead of creating new ones for each request.
 */

// Create a global dispatcher with connection pooling
// This will be reused across all HTTP requests
const createPooledAgent = (baseUrl: string) => {
  const url = new URL(baseUrl)
  
  return new Agent({
    // Maximum number of connections per origin
    connections: 10,
    
    // Maximum number of requests per connection (pipelining)
    pipelining: 1, // Set to 1 for HTTP/1.1 compatibility
    
    // Keep connections alive for reuse
    keepAliveTimeout: 60000, // 60 seconds
    keepAliveMaxTimeout: 600000, // 10 minutes
    
    // Connection timeout
    connectTimeout: 30000, // 30 seconds
    
    // Body timeout
    bodyTimeout: 30000, // 30 seconds
    
    // Headers timeout
    headersTimeout: 30000, // 30 seconds
    
    // Enable HTTP/2 if supported
    allowH2: true,
  })
}

// Map to store agents per base URL (origin)
const agentMap = new Map<string, Agent>()

/**
 * Get or create a pooled agent for a given base URL
 */
function getPooledAgent(baseUrl: string): Agent {
  const url = new URL(baseUrl)
  const origin = `${url.protocol}//${url.host}`
  
  if (!agentMap.has(origin)) {
    const agent = createPooledAgent(baseUrl)
    agentMap.set(origin, agent)
    return agent
  }
  
  return agentMap.get(origin)!
}

/**
 * Pooled HTTP client that reuses connections
 * 
 * This is a drop-in replacement for native fetch() that uses
 * connection pooling for better performance.
 * 
 * @param url - Request URL
 * @param options - Fetch options (same as native fetch)
 * @returns Promise<Response> - undici Response (compatible with native Response)
 */
export async function pooledFetch(
  url: string | URL,
  options?: RequestInit
): Promise<Response> {
  const urlString = typeof url === 'string' ? url : url.toString()
  const urlObj = new URL(urlString)
  const origin = `${urlObj.protocol}//${urlObj.host}`
  
  // Get or create pooled agent for this origin
  const agent = getPooledAgent(urlString)
  
  // Prepare options for undici fetch
  const undiciOptions: any = {
    ...options,
    dispatcher: agent,
  }
  
  // Handle body - undici expects BodyInit, not null
  if (undiciOptions.body === null) {
    delete undiciOptions.body
  }
  
  // Use undici's fetch with the pooled agent
  // undici's fetch returns a Response that's compatible with native Response at runtime
  // We cast through unknown to satisfy TypeScript's type checking
  return undiciFetch(urlString, undiciOptions) as unknown as Promise<Response>
}

/**
 * Close all pooled connections
 * Useful for cleanup during shutdown
 */
export function closeAllConnections(): void {
  for (const agent of agentMap.values()) {
    agent.close()
  }
  agentMap.clear()
}

/**
 * Get connection pool statistics
 */
export function getPoolStats(): Record<string, {
  connections: number
  origin: string
}> {
  const stats: Record<string, any> = {}
  
  for (const [origin, agent] of agentMap.entries()) {
    stats[origin] = {
      origin,
      // Note: undici Agent doesn't expose stats directly
      // This is a placeholder for future enhancement
      connections: 'N/A',
    }
  }
  
  return stats
}

