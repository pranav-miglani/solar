export type user_role = "SUPERADMIN" | "ADMIN" | "ENGINEER" | "USER"
export type work_order_priority = "LOW" | "MEDIUM" | "HIGH"
export type work_order_status =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "WAITING_VALIDATION"
  | "BLOCKED"
  | "CLOSED"

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          password_hash: string | null
          role: user_role
          created_at: string
        }
        Insert: {
          id: string
          email: string
          password_hash?: string | null
          role?: user_role
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          password_hash?: string | null
          role?: user_role
          created_at?: string
        }
      }
      vendors: {
        Row: {
          id: number
          name: string
          api_base_url: string
          credentials: Record<string, any>
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          api_base_url: string
          credentials: Record<string, any>
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          api_base_url?: string
          credentials?: Record<string, any>
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      orgs: {
        Row: {
          id: number
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      user_orgs: {
        Row: {
          id: number
          user_id: string
          org_id: number
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          org_id: number
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          org_id?: number
          created_at?: string
        }
      }
      plants: {
        Row: {
          id: number
          org_id: number
          vendor_id: number
          vendor_plant_id: string
          name: string
          capacity_kw: number
          location: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          org_id: number
          vendor_id: number
          vendor_plant_id: string
          name: string
          capacity_kw: number
          location?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          org_id?: number
          vendor_id?: number
          vendor_plant_id?: string
          name?: string
          capacity_kw?: number
          location?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      work_orders: {
        Row: {
          id: number
          title: string
          description: string | null
          priority: work_order_priority
          status: work_order_status
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          title: string
          description?: string | null
          priority?: work_order_priority
          status?: work_order_status
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          title?: string
          description?: string | null
          priority?: work_order_priority
          status?: work_order_status
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      work_order_orgs: {
        Row: {
          id: number
          work_order_id: number
          org_id: number
          created_at: string
        }
        Insert: {
          id?: number
          work_order_id: number
          org_id: number
          created_at?: string
        }
        Update: {
          id?: number
          work_order_id?: number
          org_id?: number
          created_at?: string
        }
      }
      work_order_plants: {
        Row: {
          id: number
          work_order_id: number
          plant_id: number
          assigned_engineer: string | null
          is_active: boolean
          added_at: string
        }
        Insert: {
          id?: number
          work_order_id: number
          plant_id: number
          assigned_engineer?: string | null
          is_active?: boolean
          added_at?: string
        }
        Update: {
          id?: number
          work_order_id?: number
          plant_id?: number
          assigned_engineer?: string | null
          is_active?: boolean
          added_at?: string
        }
      }
      telemetry: {
        Row: {
          id: number
          plant_id: number
          ts: string
          generation_power: number | null
          meta: Record<string, any>
          created_at: string
        }
        Insert: {
          id?: number
          plant_id: number
          ts?: string
          generation_power?: number | null
          meta?: Record<string, any>
          created_at?: string
        }
        Update: {
          id?: number
          plant_id?: number
          ts?: string
          generation_power?: number | null
          meta?: Record<string, any>
          created_at?: string
        }
      }
      work_logs: {
        Row: {
          id: number
          work_order_id: number
          user_id: string
          message: string
          attachments: any[]
          created_at: string
        }
        Insert: {
          id?: number
          work_order_id: number
          user_id: string
          message: string
          attachments?: any[]
          created_at?: string
        }
        Update: {
          id?: number
          work_order_id?: number
          user_id?: string
          message?: string
          attachments?: any[]
          created_at?: string
        }
      }
      work_order_plant_eff: {
        Row: {
          id: number
          work_order_id: number
          plant_id: number
          recorded_at: string
          actual_gen: number
          expected_gen: number
          pr: number
          efficiency_pct: number
          category: string
          created_at: string
        }
        Insert: {
          id?: number
          work_order_id: number
          plant_id: number
          recorded_at?: string
          actual_gen: number
          expected_gen: number
          pr: number
          efficiency_pct: number
          category: string
          created_at?: string
        }
        Update: {
          id?: number
          work_order_id?: number
          plant_id?: number
          recorded_at?: string
          actual_gen?: number
          expected_gen?: number
          pr?: number
          efficiency_pct?: number
          category?: string
          created_at?: string
        }
      }
    }
  }
}

