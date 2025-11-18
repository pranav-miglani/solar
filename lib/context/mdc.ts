/**
 * MDC (Mapped Diagnostic Context) - Similar to Java's MDC
 * Provides thread-local-like storage for async operations in Node.js
 * Uses AsyncLocalStorage for context propagation
 */

import { AsyncLocalStorage } from "async_hooks"

interface MDCContext {
  // Request/Source identification
  source: "user" | "cron" | "system" | "api"
  requestId?: string
  userId?: string
  userEmail?: string
  accountType?: string
  orgId?: number
  
  // Operation context
  operation?: string
  vendorId?: number
  vendorName?: string
  
  // Timestamp
  timestamp: string
  
  // Additional metadata
  metadata?: Record<string, any>
}

class MDC {
  private static storage = new AsyncLocalStorage<MDCContext>()

  /**
   * Run a function within an MDC context
   * Context is automatically propagated to all async operations
   */
  static run<T>(context: Partial<MDCContext>, fn: () => T): T {
    const fullContext: MDCContext = {
      source: context.source || "system",
      timestamp: new Date().toISOString(),
      ...context,
    }

    return this.storage.run(fullContext, fn)
  }

  /**
   * Run an async function within an MDC context
   */
  static async runAsync<T>(
    context: Partial<MDCContext>,
    fn: () => Promise<T>
  ): Promise<T> {
    const fullContext: MDCContext = {
      source: context.source || "system",
      timestamp: new Date().toISOString(),
      ...context,
    }

    return this.storage.run(fullContext, fn)
  }

  /**
   * Get current MDC context
   * Returns undefined if called outside of an MDC context
   */
  static getContext(): MDCContext | undefined {
    return this.storage.getStore()
  }

  /**
   * Get a specific value from MDC context
   */
  static get<K extends keyof MDCContext>(key: K): MDCContext[K] | undefined {
    const context = this.getContext()
    return context?.[key]
  }

  /**
   * Get source of current operation (user, cron, system, api)
   */
  static getSource(): "user" | "cron" | "system" | "api" | undefined {
    return this.get("source")
  }

  /**
   * Check if operation is from user
   */
  static isUserOperation(): boolean {
    return this.getSource() === "user"
  }

  /**
   * Check if operation is from cron
   */
  static isCronOperation(): boolean {
    return this.getSource() === "cron"
  }

  /**
   * Get formatted log prefix with context
   */
  static getLogPrefix(): string {
    const context = this.getContext()
    if (!context) {
      return "[No Context]"
    }

    const parts: string[] = []
    parts.push(`[${context.source.toUpperCase()}]`)
    
    if (context.userEmail) {
      parts.push(`[User:${context.userEmail}]`)
    } else if (context.userId) {
      parts.push(`[User:${context.userId}]`)
    }
    
    if (context.operation) {
      parts.push(`[${context.operation}]`)
    }
    
    if (context.vendorId) {
      parts.push(`[Vendor:${context.vendorId}]`)
    }
    
    if (context.orgId) {
      parts.push(`[Org:${context.orgId}]`)
    }
    
    if (context.requestId) {
      parts.push(`[Req:${context.requestId.slice(0, 8)}]`)
    }

    return parts.join(" ")
  }

  /**
   * Create a child context with additional properties
   * Useful for nested operations
   */
  static withContext<T>(
    additionalContext: Partial<MDCContext>,
    fn: () => T
  ): T {
    const currentContext = this.getContext()
    const mergedContext: Partial<MDCContext> = {
      ...currentContext,
      ...additionalContext,
    }

    return this.run(mergedContext, fn)
  }

  /**
   * Create a child async context with additional properties
   */
  static async withContextAsync<T>(
    additionalContext: Partial<MDCContext>,
    fn: () => Promise<T>
  ): Promise<T> {
    const currentContext = this.getContext()
    const mergedContext: Partial<MDCContext> = {
      ...currentContext,
      ...additionalContext,
    }

    return this.runAsync(mergedContext, fn)
  }
}

export default MDC
export type { MDCContext }

