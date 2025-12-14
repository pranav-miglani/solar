/**
 * Work Order Plants Repository - Main DB
 * 
 * Phase 19 Implementation
 * 
 * Handles all database operations for the `work_order_plants` junction table.
 */

import { SupabaseClient } from "@supabase/supabase-js"

// =============================================================================
// Types
// =============================================================================

export interface WorkOrderPlant {
  id: number
  work_order_id: number
  plant_id: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface SaveWorkOrderPlantData {
  work_order_id: number
  plant_id: number
  is_active?: boolean
}

// =============================================================================
// Interface
// =============================================================================

export interface IWorkOrderPlantsRepository {
  findByWorkOrderId(workOrderId: number): Promise<WorkOrderPlant[]>
  findActiveByPlantIds(plantIds: number[]): Promise<WorkOrderPlant[]>
  getActivePlantIds(): Promise<number[]>
  getWorkOrderIdsByPlantIds(plantIds: number[]): Promise<number[]>
  deactivateByPlantIds(plantIds: number[]): Promise<void>
  deactivateByWorkOrderAndPlantIds(workOrderId: number, plantIds: number[]): Promise<void>
  activateByWorkOrderAndPlantIds(workOrderId: number, plantIds: number[]): Promise<void>
  saveAll(entities: SaveWorkOrderPlantData[]): Promise<WorkOrderPlant[]>
}

// =============================================================================
// Implementation
// =============================================================================

export class WorkOrderPlantsRepository implements IWorkOrderPlantsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByWorkOrderId(workOrderId: number): Promise<WorkOrderPlant[]> {
    const { data, error } = await this.client
      .from("work_order_plants")
      .select("*")
      .eq("work_order_id", workOrderId)

    if (error) throw error
    return (data || []) as WorkOrderPlant[]
  }

  async findActiveByPlantIds(plantIds: number[]): Promise<WorkOrderPlant[]> {
    if (plantIds.length === 0) return []

    const { data, error } = await this.client
      .from("work_order_plants")
      .select("*")
      .in("plant_id", plantIds)
      .eq("is_active", true)

    if (error) throw error
    return (data || []) as WorkOrderPlant[]
  }

  async getActivePlantIds(): Promise<number[]> {
    const { data, error } = await this.client
      .from("work_order_plants")
      .select("plant_id")
      .eq("is_active", true)

    if (error) throw error
    // Deduplicate plant IDs
    const uniqueIds = [...new Set((data || []).map(wop => wop.plant_id))]
    return uniqueIds
  }

  async getWorkOrderIdsByPlantIds(plantIds: number[]): Promise<number[]> {
    if (plantIds.length === 0) return []

    const { data, error } = await this.client
      .from("work_order_plants")
      .select("work_order_id")
      .in("plant_id", plantIds)

    if (error) throw error
    return (data || []).map(wop => wop.work_order_id)
  }

  async deactivateByPlantIds(plantIds: number[]): Promise<void> {
    if (plantIds.length === 0) return

    const { error } = await this.client
      .from("work_order_plants")
      .update({ is_active: false })
      .in("plant_id", plantIds)
      .eq("is_active", true)

    if (error) throw error
  }

  async deactivateByWorkOrderAndPlantIds(workOrderId: number, plantIds: number[]): Promise<void> {
    if (plantIds.length === 0) return

    const { error } = await this.client
      .from("work_order_plants")
      .update({ is_active: false })
      .eq("work_order_id", workOrderId)
      .in("plant_id", plantIds)

    if (error) throw error
  }

  async activateByWorkOrderAndPlantIds(workOrderId: number, plantIds: number[]): Promise<void> {
    if (plantIds.length === 0) return

    const { error } = await this.client
      .from("work_order_plants")
      .update({ is_active: true })
      .eq("work_order_id", workOrderId)
      .in("plant_id", plantIds)

    if (error) throw error
  }

  async saveAll(entities: SaveWorkOrderPlantData[]): Promise<WorkOrderPlant[]> {
    if (entities.length === 0) return []

    const { data, error } = await this.client
      .from("work_order_plants")
      .insert(entities.map(e => ({
        work_order_id: e.work_order_id,
        plant_id: e.plant_id,
        is_active: e.is_active ?? true,
      })))
      .select()

    if (error) throw error
    return (data || []) as WorkOrderPlant[]
  }
}

