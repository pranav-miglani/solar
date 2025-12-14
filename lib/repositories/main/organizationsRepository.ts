/**
 * Organizations Repository - Main DB
 * 
 * Phase 4 Implementation
 * 
 * Handles all database operations for the `organizations` table in Main DB.
 * Uses JPA-style naming conventions.
 */

import { SupabaseClient } from "@supabase/supabase-js"

// =============================================================================
// Types
// =============================================================================

/**
 * Organization entity returned from database
 */
export interface Organization {
  id: number
  name: string
  created_at: string
  updated_at: string
}

/**
 * Data required to save (create) an organization
 */
export interface SaveOrganizationData {
  name: string
}

// =============================================================================
// Interface
// =============================================================================

/**
 * Organizations Repository Interface (JPA-style)
 */
export interface IOrganizationsRepository {
  /**
   * Find all organizations, ordered by name
   */
  findAll(): Promise<Organization[]>

  /**
   * Find organization by ID
   */
  findById(id: number): Promise<Organization | null>

  /**
   * Save (insert) a new organization
   * JPA-style: save() instead of create()
   */
  save(entity: SaveOrganizationData): Promise<Organization>
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Organizations Repository Implementation
 */
export class OrganizationsRepository implements IOrganizationsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAll(): Promise<Organization[]> {
    const { data, error } = await this.client
      .from("organizations")
      .select("*")
      .order("name", { ascending: true })

    if (error) throw error
    return (data || []) as Organization[]
  }

  async findById(id: number): Promise<Organization | null> {
    const { data, error } = await this.client
      .from("organizations")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      // PGRST116 = no rows returned
      if (error.code === "PGRST116") {
        return null
      }
      throw error
    }
    return data as Organization
  }

  async save(entity: SaveOrganizationData): Promise<Organization> {
    const { data, error } = await this.client
      .from("organizations")
      .insert({ name: entity.name })
      .select()
      .single()

    if (error) throw error
    return data as Organization
  }
}

