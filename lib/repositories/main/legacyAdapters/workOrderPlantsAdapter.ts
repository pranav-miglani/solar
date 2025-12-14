/**
 * Legacy Work Order Plants Adapter - Main DB
 * 
 * Phase 19 - Feature Toggle Support
 */

import { SupabaseClient } from "@supabase/supabase-js"
import type { WorkOrderPlant, SaveWorkOrderPlantData, IWorkOrderPlantsRepository } from "../workOrderPlantsRepository"

export class LegacyWorkOrderPlantsAdapter implements IWorkOrderPlantsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByWorkOrderId(workOrderId: number): Promise<WorkOrderPlant[]> {
    const { data, error } = await this.client.from("work_order_plants").select("*").eq("work_order_id", workOrderId)
    if (error) throw error
    return (data || []) as WorkOrderPlant[]
  }

  async findActiveByPlantIds(plantIds: number[]): Promise<WorkOrderPlant[]> {
    if (plantIds.length === 0) return []
    const { data, error } = await this.client.from("work_order_plants").select("*").in("plant_id", plantIds).eq("is_active", true)
    if (error) throw error
    return (data || []) as WorkOrderPlant[]
  }

  async deactivateByPlantIds(plantIds: number[]): Promise<void> {
    if (plantIds.length === 0) return
    const { error } = await this.client.from("work_order_plants").update({ is_active: false }).in("plant_id", plantIds).eq("is_active", true)
    if (error) throw error
  }

  async deactivateByWorkOrderAndPlantIds(workOrderId: number, plantIds: number[]): Promise<void> {
    if (plantIds.length === 0) return
    const { error } = await this.client.from("work_order_plants").update({ is_active: false }).eq("work_order_id", workOrderId).in("plant_id", plantIds)
    if (error) throw error
  }

  async activateByWorkOrderAndPlantIds(workOrderId: number, plantIds: number[]): Promise<void> {
    if (plantIds.length === 0) return
    const { error } = await this.client.from("work_order_plants").update({ is_active: true }).eq("work_order_id", workOrderId).in("plant_id", plantIds)
    if (error) throw error
  }

  async saveAll(entities: SaveWorkOrderPlantData[]): Promise<WorkOrderPlant[]> {
    if (entities.length === 0) return []
    const { data, error } = await this.client.from("work_order_plants").insert(entities.map(e => ({ work_order_id: e.work_order_id, plant_id: e.plant_id, is_active: e.is_active ?? true }))).select()
    if (error) throw error
    return (data || []) as WorkOrderPlant[]
  }
}

