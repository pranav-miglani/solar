/**
 * Work Orders Repository - Main DB
 * 
 * Phase 18 Implementation
 * 
 * Handles all database operations for the `work_orders` table.
 * Uses aggregate root pattern with nested joins.
 */

import { SupabaseClient } from "@supabase/supabase-js"

// =============================================================================
// Types
// =============================================================================

export interface OrganizationRef {
  id: number
  name: string
}

export interface VendorRef {
  id: number
  name: string
  vendor_type: string
}

export interface PlantRef {
  id: number
  name: string
  org_id: number
  capacity_kw: number
  organizations: OrganizationRef | null
  vendors?: VendorRef | null
}

export interface WorkOrderPlantMapping {
  id: number
  work_order_id: number
  plant_id: number
  is_active: boolean
  plants: PlantRef | null
}

export interface WorkOrder {
  id: number
  title: string
  description: string | null
  location: string | null
  org_id: number
  priority: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WorkOrderWithPlants extends WorkOrder {
  organizations: OrganizationRef | null
  work_order_plants: WorkOrderPlantMapping[]
}

export interface SaveWorkOrderData {
  title: string
  description?: string | null
  location?: string | null
  org_id: number
  priority?: string
  created_by?: string
}

export interface UpdateWorkOrderData {
  title?: string
  description?: string | null
  location?: string | null
  org_id?: number
}

// =============================================================================
// Interface
// =============================================================================

export interface IWorkOrdersRepository {
  findAllWithPlants(filters?: { orgId?: number }): Promise<WorkOrderWithPlants[]>
  findByIdWithPlants(id: number): Promise<WorkOrderWithPlants | null>
  findById(id: number): Promise<WorkOrder | null>
  save(entity: SaveWorkOrderData): Promise<WorkOrder>
  update(id: number, data: UpdateWorkOrderData): Promise<WorkOrder>
  deleteById(id: number): Promise<void>
  validatePlantsForOrg(plantIds: number[]): Promise<{ isValid: boolean; orgId: number | null; error?: string }>
}

// =============================================================================
// Implementation
// =============================================================================

export class WorkOrdersRepository implements IWorkOrdersRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findAllWithPlants(filters?: { orgId?: number }): Promise<WorkOrderWithPlants[]> {
    let query = this.client
      .from("work_orders")
      .select(`
        id, title, description, location, created_at, updated_at, org_id, priority, created_by,
        organizations:org_id(id, name),
        work_order_plants(
          *,
          plants:plant_id (id, name, org_id, capacity_kw, organizations(id, name))
        )
      `)
      .order("created_at", { ascending: false })

    if (filters?.orgId) {
      query = query.eq("org_id", filters.orgId)
    }

    const { data, error } = await query
    if (error) throw error
    return (data || []) as unknown as WorkOrderWithPlants[]
  }

  async findByIdWithPlants(id: number): Promise<WorkOrderWithPlants | null> {
    const { data, error } = await this.client
      .from("work_orders")
      .select(`
        id, title, description, location, created_at, updated_at, org_id, priority, created_by,
        work_order_plants(
          *,
          plants(*, organizations(id, name), vendors(id, name, vendor_type))
        )
      `)
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") return null
      throw error
    }
    return data as unknown as WorkOrderWithPlants
  }

  async findById(id: number): Promise<WorkOrder | null> {
    const { data, error } = await this.client
      .from("work_orders")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") return null
      throw error
    }
    return data as WorkOrder
  }

  async save(entity: SaveWorkOrderData): Promise<WorkOrder> {
    const { data, error } = await this.client
      .from("work_orders")
      .insert({
        title: entity.title,
        description: entity.description,
        location: entity.location,
        org_id: entity.org_id,
        priority: entity.priority || "MEDIUM",
        created_by: entity.created_by,
      })
      .select()
      .single()

    if (error) throw error
    return data as WorkOrder
  }

  async update(id: number, data: UpdateWorkOrderData): Promise<WorkOrder> {
    const updateData: Record<string, unknown> = {}
    
    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.location !== undefined) updateData.location = data.location
    if (data.org_id !== undefined) updateData.org_id = data.org_id

    const { data: workOrder, error } = await this.client
      .from("work_orders")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    return workOrder as WorkOrder
  }

  async deleteById(id: number): Promise<void> {
    const { error } = await this.client
      .from("work_orders")
      .delete()
      .eq("id", id)

    if (error) throw error
  }

  async validatePlantsForOrg(plantIds: number[]): Promise<{ isValid: boolean; orgId: number | null; error?: string }> {
    if (plantIds.length === 0) {
      return { isValid: false, orgId: null, error: "At least one plant is required" }
    }

    const { data: plants, error } = await this.client
      .from("plants")
      .select("id, org_id")
      .in("id", plantIds)

    if (error) throw error

    if (!plants || plants.length !== plantIds.length) {
      return { isValid: false, orgId: null, error: "One or more plants not found" }
    }

    const orgIds = [...new Set(plants.map((p) => p.org_id))]
    if (orgIds.length > 1) {
      return { isValid: false, orgId: null, error: "All plants must belong to the same organization" }
    }

    return { isValid: true, orgId: orgIds[0] }
  }
}

