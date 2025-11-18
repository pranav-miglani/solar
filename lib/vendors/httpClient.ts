/**
 * Shared HTTP client with connection pooling for vendor API calls
 * Uses undici for optimal connection pooling in Node.js environments
 */

import type { Agent, Dispatcher } from 'undici'

// Dynamic import to handle both Node.js and Edge runtime
let undiciModule: typeof import('undici') | null = null

// Try to load undici (available in Node.js 18+)
try {
  // Use require to avoid issues in Edge runtime
  if (typeof process !== 'undefined' && process.versions?.node) {
    undiciModule = require('undici')
  }
} catch {
  // undici not available, will fall back to native fetch
}

// Create a shared agent with connection pooling configuration
// This agent will be reused across all HTTP requests to the same origin
const createPooledAgent = (origin: string): Agent => {
  if (!undiciModule) {
    throw new Error('undici is required for connection pooling')
  }
  
  return new undiciModule.Agent({
    connections: 100, // Maximum number of connections per origin
    pipelining: 10, // Maximum number of pipelined requests per connection
    keepAliveTimeout: 60000, // Keep connections alive for 60 seconds
    keepAliveMaxTimeout: 600000, // Maximum time to keep connections alive (10 minutes)
  })
}

// Cache agents per origin to reuse connections
const agentCache = new Map<string, Agent>()

/**
 * Get or create a pooled agent for a specific origin
 */
const getPooledAgent = (url: string): Agent | undefined => {
  if (!undiciModule) {
    return undefined
  }
  
  try {
    const origin = new URL(url).origin
    if (!agentCache.has(origin)) {
      agentCache.set(origin, createPooledAgent(origin))
    }
    return agentCache.get(origin)!
  } catch {
    // If URL parsing fails, create a default agent
    return new undiciModule.Agent({
      connections: 100,
      pipelining: 10,
      keepAliveTimeout: 60000,
      keepAliveMaxTimeout: 600000,
    })
  }
}

/**
 * Pooled fetch function that reuses HTTP connections
 * This is a drop-in replacement for native fetch with connection pooling
 * Falls back to native fetch in Edge runtime or if undici is unavailable
 */
export async function pooledFetch(
  url: string | URL,
  options?: RequestInit
): Promise<Response> {
  // If undici is available, use it with connection pooling
  if (undiciModule) {
    const agent = getPooledAgent(url.toString())
    if (agent) {
      // Use undici's fetch which respects the agent's connection pooling
      // Cast through unknown to ensure compatibility with standard fetch API
      const response = await undiciModule.fetch(url, {
        ...options,
        dispatcher: agent as Dispatcher,
      } as any)
      return response as unknown as Response
    }
  }
  
  // Fall back to native fetch (Edge runtime or undici unavailable)
  return fetch(url, options)
}

/**
 * Cleanup function to close all pooled connections
 * Useful for graceful shutdown
 */
export function closeAllConnections(): void {
  for (const agent of agentCache.values()) {
    agent.close()
  }
  agentCache.clear()
}

