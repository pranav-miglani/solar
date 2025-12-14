/**
 * Repository Pattern - Base Types & Interfaces
 * 
 * JPA-style naming conventions:
 * - save() instead of create() - handles both insert and update
 * - saveAll() instead of batchUpsert() - batch save operations
 * - findById(), findAll() - standard finder methods
 * - deleteById() instead of delete() - standard delete method
 * - existsById() - existence check
 * - count() - count method
 */

import { SupabaseClient } from "@supabase/supabase-js"

// =============================================================================
// Base Repository Interface (JPA-style)
// =============================================================================

/**
 * Base repository interface with common CRUD operations.
 * All repositories should implement or extend this interface.
 * 
 * @template T - Entity type returned from queries
 * @template TSave - Data type for save operations (insert/update)
 * @template TUpdate - Data type for explicit update operations
 */
export interface IBaseRepository<T, TSave = Partial<T>, TUpdate = Partial<T>> {
  /**
   * Find all entities
   */
  findAll(): Promise<T[]>

  /**
   * Find entity by ID
   */
  findById(id: number | string): Promise<T | null>

  /**
   * Save entity (insert or update based on presence of ID/conflict)
   * JPA-style: handles both insert and update
   */
  save(entity: TSave): Promise<T>

  /**
   * Batch save entities
   * JPA-style: handles both insert and update for multiple entities
   */
  saveAll(entities: TSave[], batchSize?: number): Promise<T[]>

  /**
   * Update entity by ID
   */
  update(id: number | string, data: TUpdate): Promise<T>

  /**
   * Delete entity by ID
   * JPA-style: deleteById instead of delete
   */
  deleteById(id: number | string): Promise<void>

  /**
   * Check if entity exists by ID
   * JPA-style: existsById
   */
  existsById(id: number | string): Promise<boolean>

  /**
   * Count all entities
   */
  count(): Promise<number>
}

// =============================================================================
// Common Types
// =============================================================================

/**
 * Result of a batch operation
 */
export interface BatchResult<T> {
  success: T[]
  errors: Array<{
    index: number
    error: Error
    entity: unknown
  }>
  totalProcessed: number
  totalSuccess: number
  totalErrors: number
}

/**
 * Common filter options for queries
 */
export interface QueryFilters {
  limit?: number
  offset?: number
  orderBy?: string
  orderDirection?: "asc" | "desc"
}

/**
 * Date range filter
 */
export interface DateRangeFilter {
  startDate?: string
  endDate?: string
}

/**
 * Repository options
 */
export interface RepositoryOptions {
  /** Default batch size for batch operations */
  defaultBatchSize?: number
  /** Enable logging */
  enableLogging?: boolean
}

// =============================================================================
// Base Repository Class
// =============================================================================

/**
 * Abstract base repository with common CRUD implementations.
 * Extend this class for simple repositories or implement IBaseRepository
 * directly for complex patterns.
 * 
 * @template T - Entity type
 * @template TSave - Save data type
 * @template TUpdate - Update data type
 */
export abstract class BaseRepository<T, TSave = Partial<T>, TUpdate = Partial<T>> 
  implements IBaseRepository<T, TSave, TUpdate> {
  
  protected readonly defaultBatchSize: number = 100

  constructor(
    protected readonly client: SupabaseClient,
    protected readonly tableName: string,
    protected readonly options: RepositoryOptions = {}
  ) {
    if (options.defaultBatchSize) {
      this.defaultBatchSize = options.defaultBatchSize
    }
  }

  /**
   * Find all entities
   */
  async findAll(): Promise<T[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
    
    if (error) throw error
    return (data || []) as T[]
  }

  /**
   * Find entity by ID
   */
  async findById(id: number | string): Promise<T | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select("*")
      .eq("id", id)
      .single()
    
    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return null
      }
      throw error
    }
    return data as T
  }

  /**
   * Save entity (insert or update)
   * Uses upsert for JPA-style save behavior
   */
  async save(entity: TSave): Promise<T> {
    const { data, error } = await this.client
      .from(this.tableName)
      .upsert(entity as Record<string, unknown>)
      .select()
      .single()
    
    if (error) throw error
    return data as T
  }

  /**
   * Batch save entities with configurable batch size
   */
  async saveAll(entities: TSave[], batchSize?: number): Promise<T[]> {
    const size = batchSize || this.defaultBatchSize
    const results: T[] = []

    for (let i = 0; i < entities.length; i += size) {
      const batch = entities.slice(i, i + size)
      const { data, error } = await this.client
        .from(this.tableName)
        .upsert(batch as Record<string, unknown>[])
        .select()
      
      if (error) throw error
      results.push(...((data || []) as T[]))
    }

    return results
  }

  /**
   * Update entity by ID
   */
  async update(id: number | string, data: TUpdate): Promise<T> {
    const { data: updated, error } = await this.client
      .from(this.tableName)
      .update(data as Record<string, unknown>)
      .eq("id", id)
      .select()
      .single()
    
    if (error) throw error
    return updated as T
  }

  /**
   * Delete entity by ID
   */
  async deleteById(id: number | string): Promise<void> {
    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq("id", id)
    
    if (error) throw error
  }

  /**
   * Check if entity exists
   */
  async existsById(id: number | string): Promise<boolean> {
    const { count, error } = await this.client
      .from(this.tableName)
      .select("id", { count: "exact", head: true })
      .eq("id", id)
    
    if (error) throw error
    return (count || 0) > 0
  }

  /**
   * Count all entities
   */
  async count(): Promise<number> {
    const { count, error } = await this.client
      .from(this.tableName)
      .select("*", { count: "exact", head: true })
    
    if (error) throw error
    return count || 0
  }

  /**
   * Helper: Log operation (if logging enabled)
   */
  protected log(message: string, data?: unknown): void {
    if (this.options.enableLogging) {
      console.log(`[${this.tableName}Repository] ${message}`, data || "")
    }
  }
}

// =============================================================================
// Utility Types for Repositories
// =============================================================================

/**
 * Extract the entity type from a repository
 */
export type EntityType<R> = R extends IBaseRepository<infer T, unknown, unknown> ? T : never

/**
 * Common entity with ID
 */
export interface WithId {
  id: number | string
}

/**
 * Common entity with timestamps
 */
export interface WithTimestamps {
  created_at?: string
  updated_at?: string
}

/**
 * Common entity with org_id
 */
export interface WithOrgId {
  org_id: number
}

