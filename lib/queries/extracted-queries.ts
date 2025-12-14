/**
 * EXTRACTED DATABASE QUERIES
 * 
 * This file contains ALL database queries extracted from the codebase.
 * Purpose: Centralize all queries for analysis before repository design.
 * 
 * IMPORTANT: This is a REFERENCE file - queries are NOT executed here.
 * They are extracted for analysis and will be moved to repositories.
 * 
 * Database Context:
 * - Main DB: Production database (accounts, organizations, vendors, plants, alerts, work_orders, etc.)
 * - Analytics DB: Separate analytics database (organizations, vendors, plants, plant_energy_readings, etc.)
 * 
 * Note: If Main DB and Analytics DB have the same schema for certain tables,
 * we can create common repository logic that works for both.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * ============================================================================
 * MAIN DATABASE QUERIES
 * ============================================================================
 */

/**
 * ACCOUNTS TABLE QUERIES
 * Table: accounts
 * Database: Main DB only
 */
export const accountsQueries = {
  /**
   * GET /api/accounts
   * Find all accounts, ordered by email
   */
  findAll: (supabase: SupabaseClient) => {
    return supabase
      .from("accounts")
      .select("id, email, account_type, org_id, created_at, display_name, logo_url, is_active")
      .order("email")
  },

  /**
   * POST /api/accounts
   * Find account by email (for duplicate check)
   */
  findByEmail: (supabase: SupabaseClient, email: string) => {
    return supabase
      .from("accounts")
      .select("id")
      .eq("email", email)
      .single()
  },

  /**
   * POST /api/accounts
   * Check if organization already has an account
   */
  existsByOrgId: (supabase: SupabaseClient, orgId: number) => {
    return supabase
      .from("accounts")
      .select("id")
      .eq("org_id", orgId)
      .eq("account_type", "ORG")
      .single()
  },

  /**
   * POST /api/accounts
   * Create new account
   */
  create: (supabase: SupabaseClient, data: {
    email: string
    password_hash: string
    account_type: string
    org_id: number | null
    display_name?: string | null
  }) => {
    return supabase
      .from("accounts")
      .insert({
        email: data.email,
        password_hash: data.password_hash,
        account_type: data.account_type,
        org_id: data.org_id,
        display_name: data.display_name || null,
      })
      .select("id, email, account_type, org_id, created_at, display_name")
      .single()
  },

  /**
   * POST /api/login
   * Find account by email for login (with is_active check)
   */
  findByEmailForLogin: (supabase: SupabaseClient, email: string) => {
    return supabase
      .from("accounts")
      .select("*")
      .eq("email", email)
      .eq("is_active", true)
      .limit(1)
  },

  /**
   * POST /api/login
   * Test database connection
   */
  testConnection: (supabase: SupabaseClient) => {
    return supabase
      .from("accounts")
      .select("*", { count: "exact", head: true })
  },
}

/**
 * ORGANIZATIONS TABLE QUERIES
 * Table: organizations
 * Database: Main DB only (but Analytics DB has similar structure)
 */
export const organizationsQueries = {
  /**
   * GET /api/orgs
   * Find all organizations, ordered by name
   */
  findAll: (supabase: SupabaseClient) => {
    return supabase
      .from("organizations")
      .select("*")
      .order("name")
  },

  /**
   * POST /api/orgs
   * Create new organization
   */
  create: (supabase: SupabaseClient, data: { name: string }) => {
    return supabase
      .from("organizations")
      .insert({ name: data.name })
      .select()
      .single()
  },

  /**
   * GET /api/orgs/[id]
   * Find organization by ID
   */
  findById: (supabase: SupabaseClient, id: number) => {
    return supabase
      .from("organizations")
      .select("id, name")
      .eq("id", id)
      .single()
  },

  /**
   * GET /api/orgs/[id]/plants
   * Find organization with plants (complex join with work_order_plants)
   * NOTE: This involves work_orders - will be handled separately
   */
  findByIdWithPlants: (supabase: SupabaseClient, id: number) => {
    return supabase
      .from("organizations")
      .select("id, name")
      .eq("id", id)
      .single()
  },
}

/**
 * VENDORS TABLE QUERIES
 * Table: vendors
 * Database: Main DB only (but Analytics DB has similar structure)
 */
export const vendorsQueries = {
  /**
   * GET /api/vendors
   * Find all vendors with organization info
   */
  findAllWithOrganizations: (supabase: SupabaseClient) => {
    return supabase
      .from("vendors")
      .select("*, organizations(id, name, auto_sync_enabled)")
      .order("name")
  },

  /**
   * POST /api/vendors
   * Create new vendor
   */
  create: (supabase: SupabaseClient, data: {
    name: string
    vendor_type: string
    credentials: Record<string, any>
    org_id: number
    is_active?: boolean
    plant_sync_mode?: string | null
    per_plant_sync_interval_minutes?: number
    plant_sync_time_ist?: string
    telemetry_sync_mode?: string
    telemetry_sync_interval?: number
  }) => {
    return supabase
      .from("vendors")
      .insert({
        name: data.name,
        vendor_type: data.vendor_type,
        credentials: data.credentials,
        is_active: data.is_active ?? true,
        org_id: data.org_id,
        plant_sync_mode: data.plant_sync_mode || null,
        per_plant_sync_interval_minutes: data.per_plant_sync_interval_minutes ?? 15,
        plant_sync_time_ist: data.plant_sync_time_ist || '02:00',
        telemetry_sync_mode: data.telemetry_sync_mode || 'LIST_PLANTS',
        telemetry_sync_interval: data.telemetry_sync_interval ?? 15,
      })
      .select()
      .single()
  },

  /**
   * GET /api/vendors/[id]
   * Find vendor by ID
   */
  findById: (supabase: SupabaseClient, id: number) => {
    return supabase
      .from("vendors")
      .select("*")
      .eq("id", id)
      .single()
  },

  /**
   * PATCH /api/vendors/[id]
   * Update vendor
   */
  update: (supabase: SupabaseClient, id: number, data: Record<string, any>) => {
    return supabase
      .from("vendors")
      .update(data)
      .eq("id", id)
      .select()
      .single()
  },

  /**
   * Services: plantSyncService, alertSyncService, liveTelemetrySyncService
   * Find active vendors
   */
  findActive: (supabase: SupabaseClient) => {
    return supabase
      .from("vendors")
      .select("*")
      .eq("is_active", true)
  },

  /**
   * Services: plantSyncService
   * Find vendors by org_id
   */
  findByOrgId: (supabase: SupabaseClient, orgId: number) => {
    return supabase
      .from("vendors")
      .select("*")
      .eq("org_id", orgId)
  },
}

/**
 * PLANTS TABLE QUERIES
 * Table: plants
 * Database: Main DB only (but Analytics DB has similar structure)
 */
export const plantsQueries = {
  /**
   * GET /api/plants
   * Find all plants with vendor and organization (role-based filtering)
   */
  findAllWithRelations: (supabase: SupabaseClient, filters?: {
    orgId?: number
    plantIds?: number[]
  }) => {
    let query = supabase
      .from("plants")
      .select("*, vendors(*), organizations(*)")

    if (filters?.orgId) {
      query = query.eq("org_id", filters.orgId)
    }

    if (filters?.plantIds && filters.plantIds.length > 0) {
      query = query.in("id", filters.plantIds)
    }

    return query
  },

  /**
   * GET /api/plants/[id]
   * Find plant by ID with vendor and organization
   */
  findByIdWithRelations: (supabase: SupabaseClient, id: number) => {
    return supabase
      .from("plants")
      .select(`
        *,
        vendors (
          id,
          name,
          vendor_type
        ),
        organizations (
          id,
          name
        )
      `)
      .eq("id", id)
      .single()
  },

  /**
   * POST /api/plants
   * Create new plant
   */
  create: (supabase: SupabaseClient, data: {
    org_id: number
    vendor_id: number
    vendor_plant_id: string
    name: string
    capacity_kw: number
    location?: Record<string, any>
  }) => {
    return supabase
      .from("plants")
      .insert({
        org_id: data.org_id,
        vendor_id: data.vendor_id,
        vendor_plant_id: data.vendor_plant_id,
        name: data.name,
        capacity_kw: data.capacity_kw,
        location: data.location || {},
      })
      .select()
      .single()
  },

  /**
   * GET /api/alerts
   * Get plant IDs for an organization (for filtering alerts)
   */
  getPlantIdsByOrgId: (supabase: SupabaseClient, orgId: number) => {
    return supabase
      .from("plants")
      .select("id")
      .eq("org_id", orgId)
  },

  /**
   * GET /api/orgs/[id]/plants
   * Find plants by organization ID with work orders (complex join)
   * NOTE: This involves work_orders - will be handled separately
   */
  findByOrgIdWithWorkOrders: (supabase: SupabaseClient, orgId: number) => {
    return supabase
      .from("plants")
      .select(`
        *,
        vendors(id, name, vendor_type),
        work_order_plants!left(
          is_active,
          added_at,
          work_orders(
            id,
            title,
            description,
            priority,
            created_at,
            created_by_account:accounts!work_orders_created_by_fkey(id, email)
          )
        )
      `)
      .eq("org_id", orgId)
  },

  /**
   * Services: plantSyncService
   * Find existing plants by vendor_plant_id for a vendor (for deduplication)
   */
  findExistingByVendorPlantIds: (supabase: SupabaseClient, vendorId: number, vendorPlantIds: string[]) => {
    return supabase
      .from("plants")
      .select("vendor_plant_id")
      .eq("vendor_id", vendorId)
      .in("vendor_plant_id", vendorPlantIds)
  },

  /**
   * Services: plantSyncService
   * Batch upsert plants
   */
  batchUpsert: (supabase: SupabaseClient, plants: any[], batchSize: number = 100) => {
    // This is handled in batches in the service
    return supabase
      .from("plants")
      .upsert(plants, { onConflict: "vendor_id,vendor_plant_id" })
      .select()
  },

  /**
   * Services: plantSyncService
   * Update plant production metrics
   */
  updateProductionMetrics: (supabase: SupabaseClient, plantId: number, metrics: {
    current_power_kw?: number | null
    daily_energy_kwh?: number | null
    monthly_energy_mwh?: number | null
    yearly_energy_mwh?: number | null
    total_energy_mwh?: number | null
    last_update_time?: string | null
    network_status?: string | null
  }) => {
    return supabase
      .from("plants")
      .update(metrics)
      .eq("id", plantId)
      .select()
      .single()
  },
}

/**
 * ALERTS TABLE QUERIES
 * Table: alerts
 * Database: Main DB only
 */
export const alertsQueries = {
  /**
   * GET /api/alerts
   * Find alerts with plant information (with filters)
   */
  findWithPlants: (supabase: SupabaseClient, filters?: {
    plantId?: number
    plantIds?: number[]
    status?: string
    limit?: number
  }) => {
    let query = supabase
      .from("alerts")
      .select(`
        *,
        plants:plant_id (
          id,
          name,
          org_id
        )
      `)

    if (filters?.plantId) {
      query = query.eq("plant_id", filters.plantId)
    }

    if (filters?.plantIds && filters.plantIds.length > 0) {
      query = query.in("plant_id", filters.plantIds)
    }

    if (filters?.status) {
      query = query.eq("status", filters.status)
    }

    query = query.order("created_at", { ascending: false })

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    return query
  },

  /**
   * Services: alertSyncService
   * Find existing alerts by vendor identifiers (for deduplication)
   */
  findExistingByVendorIdentifiers: (supabase: SupabaseClient, vendorId: number, vendorPlantId: string, vendorAlertIds: string[]) => {
    return supabase
      .from("alerts")
      .select("*")
      .eq("vendor_id", vendorId)
      .eq("vendor_plant_id", vendorPlantId)
      .in("vendor_alert_id", vendorAlertIds)
      .order("created_at", { ascending: false })
  },

  /**
   * Services: alertSyncService
   * Batch upsert alerts
   */
  batchUpsert: (supabase: SupabaseClient, alerts: any[], batchSize: number = 100) => {
    return supabase
      .from("alerts")
      .upsert(alerts, { onConflict: "vendor_id,vendor_plant_id,vendor_alert_id" })
      .select()
  },

  /**
   * Services: gridDowntimeAnalyticsService
   * Find GRID_DOWN alerts for grid downtime calculation
   */
  findGridDownAlerts: (supabase: SupabaseClient, windowStart: Date, windowEnd: Date) => {
    return supabase
      .from("alerts")
      .select("plant_id, alert_time, end_time")
      .eq("description", "GRID_DOWN")
      .lte("alert_time", windowEnd.toISOString())
      .or(`end_time.is.null,end_time.gte.${windowStart.toISOString()}`)
  },
}

/**
 * WMS_VENDORS TABLE QUERIES
 * Table: wms_vendors
 * Database: Main DB only
 */
export const wmsVendorsQueries = {
  /**
   * GET /api/wms-vendors
   * Find all WMS vendors with organization info
   */
  findAllWithOrganizations: (supabase: SupabaseClient, filters?: { orgId?: number }) => {
    let query = supabase
      .from("wms_vendors")
      .select("*, organizations(id, name)")

    if (filters?.orgId) {
      query = query.eq("org_id", filters.orgId)
    }

    return query.order("created_at", { ascending: false })
  },

  /**
   * POST /api/wms-vendors
   * Create new WMS vendor
   */
  create: (supabase: SupabaseClient, data: {
    name: string
    vendor_type: "INTELLO" | "SCADA" | "TRACKSO"
    credentials: Record<string, any>
    org_id: number
    is_active?: boolean
  }) => {
    return supabase
      .from("wms_vendors")
      .insert({
        name: data.name,
        vendor_type: data.vendor_type,
        credentials: data.credentials,
        org_id: data.org_id,
        is_active: data.is_active ?? true,
      })
      .select()
      .single()
  },

  /**
   * Services: wmsSyncService
   * Find active WMS vendors
   */
  findActive: (supabase: SupabaseClient) => {
    return supabase
      .from("wms_vendors")
      .select("*")
      .eq("is_active", true)
  },

  /**
   * Services: wmsSyncService
   * Update WMS vendor token
   */
  updateToken: (supabase: SupabaseClient, id: number, tokenData: {
    access_token?: string | null
    token_expires_at?: string | null
    token_metadata?: Record<string, any> | null
  }) => {
    return supabase
      .from("wms_vendors")
      .update(tokenData)
      .eq("id", id)
      .select()
      .single()
  },
}

/**
 * WMS_SITES TABLE QUERIES
 * Table: wms_sites
 * Database: Main DB only
 */
export const wmsSitesQueries = {
  /**
   * Services: wmsSyncService
   * Find existing sites by vendor_site_id for a vendor (for deduplication)
   */
  findExistingByVendorSiteIds: (supabase: SupabaseClient, vendorId: number, vendorSiteIds: string[]) => {
    return supabase
      .from("wms_sites")
      .select("vendor_site_id")
      .eq("wms_vendor_id", vendorId)
      .in("vendor_site_id", vendorSiteIds)
  },

  /**
   * Services: wmsSyncService
   * Batch upsert WMS sites
   */
  batchUpsert: (supabase: SupabaseClient, sites: any[], batchSize: number = 100) => {
    return supabase
      .from("wms_sites")
      .upsert(sites, { onConflict: "wms_vendor_id,vendor_site_id" })
      .select()
  },
}

/**
 * WMS_DEVICES TABLE QUERIES
 * Table: wms_devices
 * Database: Main DB only
 */
export const wmsDevicesQueries = {
  /**
   * Services: wmsSyncService
   * Find existing devices by vendor_device_id for a site (for deduplication)
   */
  findExistingByVendorDeviceIds: (supabase: SupabaseClient, siteId: number, vendorDeviceIds: string[]) => {
    return supabase
      .from("wms_devices")
      .select("vendor_device_id")
      .eq("wms_site_id", siteId)
      .in("vendor_device_id", vendorDeviceIds)
  },

  /**
   * Services: wmsSyncService
   * Batch upsert WMS devices
   */
  batchUpsert: (supabase: SupabaseClient, devices: any[], batchSize: number = 100) => {
    return supabase
      .from("wms_devices")
      .upsert(devices, { onConflict: "wms_site_id,vendor_device_id" })
      .select()
  },
}

/**
 * INSOLATION_READINGS TABLE QUERIES
 * Table: insolation_readings
 * Database: Main DB only
 */
export const insolationReadingsQueries = {
  /**
   * Services: wmsSyncService
   * Find reading by device and date (for upsert)
   */
  findByDeviceAndDate: (supabase: SupabaseClient, deviceId: number, date: string) => {
    return supabase
      .from("insolation_readings")
      .select("*")
      .eq("wms_device_id", deviceId)
      .eq("reading_date", date)
      .maybeSingle()
  },

  /**
   * Services: wmsSyncService
   * Upsert insolation reading
   */
  upsert: (supabase: SupabaseClient, reading: {
    wms_device_id: number
    reading_date: string
    insolation_value: number
    reading_count: number
    metadata: Record<string, any>
  }) => {
    return supabase
      .from("insolation_readings")
      .upsert(reading, { onConflict: "wms_device_id,reading_date" })
      .select()
      .single()
  },
}

/**
 * WORK_ORDERS TABLE QUERIES
 * Table: work_orders
 * Database: Main DB only
 * NOTE: These are EXCLUDED from migration per requirements
 * But extracted here for completeness and reference
 */
export const workOrdersQueries = {
  /**
   * GET /api/workorders
   * Find all work orders with nested joins (complex, role-based filtering)
   */
  findAllWithNestedJoins: (supabase: SupabaseClient, filters?: {
    orgId?: number
    accountType?: string
  }) => {
    let query = supabase
      .from("work_orders")
      .select(`
        id,
        title,
        description,
        location,
        created_at,
        updated_at,
        org_id,
        organizations:org_id(id, name),
        work_order_plants(
          *,
          plants:plant_id (
            id,
            name,
            org_id,
            capacity_kw,
            organizations(id, name)
          )
        )
      `)
      .order("created_at", { ascending: false })

    if (filters?.orgId) {
      query = query.eq("org_id", filters.orgId)
    }

    return query
  },

  /**
   * GET /api/workorders/[id]
   * Find work order by ID with nested joins
   */
  findByIdWithNestedJoins: (supabase: SupabaseClient, id: number) => {
    return supabase
      .from("work_orders")
      .select(`
        id,
        title,
        description,
        location,
        created_at,
        updated_at,
        org_id,
        work_order_plants(
          *,
          plants(
            *,
            organizations(id, name),
            vendors(id, name, vendor_type)
          )
        )
      `)
      .eq("id", id)
      .single()
  },

  /**
   * POST /api/workorders
   * Create work order
   */
  create: (supabase: SupabaseClient, data: {
    title: string
    description?: string | null
    location?: string | null
    org_id: number
    priority: string
    created_by: string
  }) => {
    return supabase
      .from("work_orders")
      .insert({
        title: data.title,
        description: data.description,
        location: data.location,
        org_id: data.org_id,
        priority: data.priority,
        created_by: data.created_by,
      })
      .select()
      .single()
  },

  /**
   * PUT /api/workorders/[id]
   * Update work order
   */
  update: (supabase: SupabaseClient, id: number, data: {
    title: string
    description?: string | null
    location?: string | null
    org_id: number
  }) => {
    return supabase
      .from("work_orders")
      .update({
        title: data.title,
        description: data.description,
        location: data.location,
        org_id: data.org_id,
      })
      .eq("id", id)
      .select()
      .single()
  },

  /**
   * DELETE /api/workorders/[id]
   * Delete work order (cascade handles work_order_plants)
   */
  delete: (supabase: SupabaseClient, id: number) => {
    return supabase
      .from("work_orders")
      .delete()
      .eq("id", id)
  },

  /**
   * DELETE /api/workorders/org/[orgId]
   * Delete all work orders for an organization
   */
  deleteByOrgId: (supabase: SupabaseClient, orgId: number) => {
    return supabase
      .from("work_orders")
      .delete()
      .eq("org_id", orgId)
  },

  /**
   * DELETE /api/workorders/org/[orgId]
   * Count work orders for an organization (before deletion)
   */
  countByOrgId: (supabase: SupabaseClient, orgId: number) => {
    return supabase
      .from("work_orders")
      .select("id")
      .eq("org_id", orgId)
  },

  /**
   * POST /api/workorders
   * Validate plants belong to same org (for work order creation)
   */
  validatePlantsForOrg: (supabase: SupabaseClient, plantIds: number[]) => {
    return supabase
      .from("plants")
      .select("id, org_id")
      .in("id", plantIds)
  },

  /**
   * GET /api/workorders/export
   * Export work orders with nested joins
   */
  findAllForExport: (supabase: SupabaseClient) => {
    return supabase
      .from("work_orders")
      .select(`
        id,
        title,
        description,
        location,
        created_at,
        updated_at,
        org_id,
        organizations:org_id(id, name),
        work_order_plants(
          *,
          plants:plant_id (
            id,
            name,
            org_id,
            vendor_id,
            vendor_plant_id,
            capacity_kw,
            organizations(id, name),
            vendors(id, name, vendor_type)
          )
        )
      `)
      .order("created_at", { ascending: false })
  },

  /**
   * POST /api/workorders/import
   * Check if work order exists (by title and org_id)
   */
  findByTitleAndOrgId: (supabase: SupabaseClient, title: string, orgId: number) => {
    return supabase
      .from("work_orders")
      .select("id")
      .eq("title", title)
      .eq("org_id", orgId)
      .single()
  },

  /**
   * POST /api/workorders/import
   * Validate organization exists
   */
  validateOrgExists: (supabase: SupabaseClient, orgId: number) => {
    return supabase
      .from("organizations")
      .select("id")
      .eq("id", orgId)
      .single()
  },

  /**
   * POST /api/workorders/import
   * Find plants by IDs for org (Option 2: plant_id)
   */
  findPlantsByIdsForOrg: (supabase: SupabaseClient, plantIds: number[], orgId: number) => {
    return supabase
      .from("plants")
      .select("id, org_id, vendor_id, vendor_plant_id, name")
      .in("id", plantIds)
      .eq("org_id", orgId)
  },

  /**
   * POST /api/workorders/import
   * Find vendors by IDs and/or types for org (Option 1a/1b: vendor_id or vendor_type)
   */
  findVendorsForImport: (supabase: SupabaseClient, filters: {
    vendorIds?: number[]
    vendorTypes?: string[]
    orgId: number
  }) => {
    let query = supabase
      .from("vendors")
      .select("id, vendor_type, org_id, name")

    if (filters.vendorIds && filters.vendorIds.length > 0 && filters.vendorTypes && filters.vendorTypes.length > 0) {
      // Both provided - use OR
      query = query.or(`id.in.(${filters.vendorIds.join(',')}),vendor_type.in.(${filters.vendorTypes.join(',')})`)
    } else if (filters.vendorIds && filters.vendorIds.length > 0) {
      query = query.in("id", filters.vendorIds)
    } else if (filters.vendorTypes && filters.vendorTypes.length > 0) {
      query = query.in("vendor_type", filters.vendorTypes)
    }

    // Filter by org (must belong to work order's org or be global)
    query = query.or(`org_id.eq.${filters.orgId},org_id.is.null`)

    return query
  },

  /**
   * POST /api/workorders/import
   * Find vendor by ID (for Option 2 plants)
   */
  findVendorById: (supabase: SupabaseClient, vendorId: number) => {
    return supabase
      .from("vendors")
      .select("id, name, vendor_type, org_id")
      .eq("id", vendorId)
      .single()
  },

  /**
   * POST /api/workorders/import
   * Find plants by vendor_plant_id and vendor_id for org (Option 1: vendor_id + vendor_plant_id)
   */
  findPlantsByVendorPlantIdAndVendorId: (supabase: SupabaseClient, vendorPlantIds: string[], vendorIds: number[], orgId: number) => {
    return supabase
      .from("plants")
      .select("id, org_id, vendor_id, vendor_plant_id, name")
      .in("vendor_plant_id", vendorPlantIds)
      .in("vendor_id", vendorIds)
      .eq("org_id", orgId)
  },
}

/**
 * WORK_ORDER_PLANTS TABLE QUERIES
 * Table: work_order_plants
 * Database: Main DB only
 * NOTE: These are EXCLUDED from migration per requirements
 * But extracted here for completeness and reference
 */
export const workOrderPlantsQueries = {
  /**
   * POST /api/workorders
   * Deactivate existing active work orders for plants
   */
  deactivateByPlantIds: (supabase: SupabaseClient, plantIds: number[]) => {
    return supabase
      .from("work_order_plants")
      .update({ is_active: false })
      .in("plant_id", plantIds)
      .eq("is_active", true)
  },

  /**
   * POST /api/workorders
   * Insert work order plant mappings
   */
  insert: (supabase: SupabaseClient, mappings: Array<{
    work_order_id: number
    plant_id: number
    is_active: boolean
  }>) => {
    return supabase
      .from("work_order_plants")
      .insert(mappings)
  },

  /**
   * PUT /api/workorders/[id]
   * Get all existing work_order_plants for a work order
   */
  findByWorkOrderId: (supabase: SupabaseClient, workOrderId: number) => {
    return supabase
      .from("work_order_plants")
      .select("plant_id, is_active")
      .eq("work_order_id", workOrderId)
  },

  /**
   * PUT /api/workorders/[id]
   * Deactivate plants that are no longer selected
   */
  deactivateByWorkOrderAndPlantIds: (supabase: SupabaseClient, workOrderId: number, plantIds: number[]) => {
    return supabase
      .from("work_order_plants")
      .update({ is_active: false })
      .eq("work_order_id", workOrderId)
      .in("plant_id", plantIds)
  },

  /**
   * PUT /api/workorders/[id]
   * Activate plants that were previously inactive
   */
  activateByWorkOrderAndPlantIds: (supabase: SupabaseClient, workOrderId: number, plantIds: number[]) => {
    return supabase
      .from("work_order_plants")
      .update({ is_active: true })
      .eq("work_order_id", workOrderId)
      .in("plant_id", plantIds)
  },

  /**
   * POST /api/workorders/[id]/plants
   * Get existing work order plants with plant org_id (for validation)
   */
  findByWorkOrderIdWithPlantOrg: (supabase: SupabaseClient, workOrderId: number) => {
    return supabase
      .from("work_order_plants")
      .select(`
        plant_id,
        plants!inner(org_id)
      `)
      .eq("work_order_id", workOrderId)
      .eq("is_active", true)
  },

  /**
   * POST /api/workorders/import
   * Check if plants are already in active work orders
   */
  findActiveByPlantIds: (supabase: SupabaseClient, plantIds: number[]) => {
    return supabase
      .from("work_order_plants")
      .select("plant_id, work_order_id")
      .in("plant_id", plantIds)
      .eq("is_active", true)
  },

  /**
   * GET /api/dashboard (SUPERADMIN)
   * Get mapped plants (plants in active work orders)
   */
  findMappedPlantIds: (supabase: SupabaseClient) => {
    return supabase
      .from("work_order_plants")
      .select("plant_id")
      .eq("is_active", true)
  },

  /**
   * GET /api/dashboard (ORG)
   * Get mapped plants for org (plants in active work orders for org plants)
   */
  findMappedPlantIdsForOrg: (supabase: SupabaseClient, plantIds: number[]) => {
    return supabase
      .from("work_order_plants")
      .select("plant_id")
      .eq("is_active", true)
      .in("plant_id", plantIds.length > 0 ? plantIds : [-1])
  },

  /**
   * GET /api/dashboard (ORG)
   * Get work order IDs for org plants
   */
  findWorkOrderIdsByPlantIds: (supabase: SupabaseClient, plantIds: number[]) => {
    return supabase
      .from("work_order_plants")
      .select("work_order_id")
      .in("plant_id", plantIds)
  },

  /**
   * GET /api/dashboard (GOVT)
   * Get work order plants with plants join
   */
  findByWorkOrderIdsWithPlants: (supabase: SupabaseClient, workOrderIds: number[]) => {
    return supabase
      .from("work_order_plants")
      .select(`
        plant_id,
        plants (*)
      `)
      .in("work_order_id", workOrderIds)
      .eq("is_active", true)
  },
}

/**
 * DASHBOARD QUERIES
 * Multiple tables with aggregations
 * NOTE: These are EXCLUDED from migration per requirements
 * But extracted here for completeness and reference
 */
export const dashboardQueries = {
  /**
   * GET /api/dashboard (SUPERADMIN)
   * Count all plants
   */
  countAllPlants: (supabase: SupabaseClient) => {
    return supabase
      .from("plants")
      .select("id", { count: "exact", head: true })
  },

  /**
   * GET /api/dashboard (SUPERADMIN)
   * Count active alerts
   */
  countActiveAlerts: (supabase: SupabaseClient) => {
    return supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE")
  },

  /**
   * GET /api/dashboard (SUPERADMIN)
   * Count all work orders
   */
  countAllWorkOrders: (supabase: SupabaseClient) => {
    return supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
  },

  /**
   * GET /api/dashboard (SUPERADMIN)
   * Get all plant energy data for aggregation
   */
  getAllPlantEnergy: (supabase: SupabaseClient) => {
    return supabase
      .from("plants")
      .select("total_energy_mwh")
  },

  /**
   * GET /api/dashboard (GOVT)
   * Get all work orders
   */
  getAllWorkOrders: (supabase: SupabaseClient) => {
    return supabase
      .from("work_orders")
      .select("id")
  },

  /**
   * GET /api/dashboard (ORG)
   * Count plants for organization
   */
  countPlantsByOrgId: (supabase: SupabaseClient, orgId: number) => {
    return supabase
      .from("plants")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
  },

  /**
   * GET /api/dashboard (ORG)
   * Get plant IDs for organization
   */
  getPlantIdsByOrgId: (supabase: SupabaseClient, orgId: number) => {
    return supabase
      .from("plants")
      .select("id")
      .eq("org_id", orgId)
  },

  /**
   * GET /api/dashboard (ORG)
   * Count active alerts for org plants
   */
  countActiveAlertsByPlantIds: (supabase: SupabaseClient, plantIds: number[]) => {
    return supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE")
      .in("plant_id", plantIds)
  },

  /**
   * GET /api/dashboard (ORG)
   * Count work orders for org plants
   */
  countWorkOrdersByWorkOrderIds: (supabase: SupabaseClient, workOrderIds: number[]) => {
    return supabase
      .from("work_orders")
      .select("id", { count: "exact", head: true })
      .in("id", workOrderIds.length > 0 ? workOrderIds : [-1])
  },

  /**
   * GET /api/dashboard (ORG)
   * Get plant energy data for organization
   */
  getPlantEnergyByOrgId: (supabase: SupabaseClient, orgId: number) => {
    return supabase
      .from("plants")
      .select("total_energy_mwh")
      .eq("org_id", orgId)
  },
}

/**
 * WORK_LOGS TABLE QUERIES
 * Table: work_logs
 * Database: Main DB only
 * NOTE: These are EXCLUDED from migration per requirements
 * But extracted here for completeness and reference
 */
export const workLogsQueries = {
  /**
   * GET /api/workorders/[id]/logs
   * Find work logs by work order ID with user join
   */
  findByWorkOrderId: (supabase: SupabaseClient, workOrderId: number) => {
    return supabase
      .from("work_logs")
      .select(`
        *,
        user:users!work_logs_user_id_fkey(id, email)
      `)
      .eq("work_order_id", workOrderId)
      .order("created_at", { ascending: false })
  },

  /**
   * POST /api/workorders/[id]/logs
   * Create work log
   */
  create: (supabase: SupabaseClient, data: {
    work_order_id: number
    user_id: string
    message: string
    attachments?: any[]
  }) => {
    return supabase
      .from("work_logs")
      .insert({
        work_order_id: data.work_order_id,
        user_id: data.user_id,
        message: data.message,
        attachments: data.attachments || [],
      })
      .select()
      .single()
  },
}

/**
 * WORK_ORDER_PLANTS PRODUCTION QUERIES
 * Table: work_order_plants (with plants join)
 * Database: Main DB only
 * NOTE: These are EXCLUDED from migration per requirements
 * But extracted here for completeness and reference
 */
export const workOrderPlantsProductionQueries = {
  /**
   * GET /api/workorders/[id]/production
   * Get work order plants with full plant data for production aggregation
   */
  findByWorkOrderIdWithPlants: (supabase: SupabaseClient, workOrderId: number) => {
    return supabase
      .from("work_order_plants")
      .select(`
        plant_id,
        plants (*)
      `)
      .eq("work_order_id", workOrderId)
      .eq("is_active", true)
  },
}

/**
 * ============================================================================
 * ANALYTICS DATABASE QUERIES
 * ============================================================================
 */

/**
 * ANALYTICS ORGANIZATIONS TABLE QUERIES
 * Table: organizations
 * Database: Analytics DB
 * Note: Similar structure to Main DB organizations, but with additional config fields
 */
export const analyticsOrganizationsQueries = {
  /**
   * GET /api/analytics/orgs
   * Find all analytics organizations
   */
  findAll: (supabase: SupabaseClient) => {
    return supabase
      .from("organizations")
      .select("*")
      .order("id", { ascending: true })
  },

  /**
   * Services: analyticsMirrorService
   * Find config hash for organization (for change detection)
   */
  findConfigHash: (supabase: SupabaseClient, id: number) => {
    return supabase
      .from("organizations")
      .select("config_hash")
      .eq("id", id)
      .maybeSingle()
  },

  /**
   * Services: analyticsMirrorService
   * Upsert organization (mirror from main DB)
   */
  upsert: (supabase: SupabaseClient, data: {
    id: number
    name: string
    config: Record<string, any>
    config_hash: string
    config_ready?: boolean
    config_last_run_at?: string
    config_last_status?: string
    config_last_error?: string | null
  }) => {
    return supabase
      .from("organizations")
      .upsert({
        id: data.id,
        name: data.name,
        config: data.config,
        config_hash: data.config_hash,
        config_ready: data.config_ready ?? true,
        config_last_run_at: data.config_last_run_at || new Date().toISOString(),
        config_last_status: data.config_last_status || "success",
        config_last_error: data.config_last_error || null,
      }, {
        onConflict: "id",
      })
      .select()
      .single()
  },
}

/**
 * ANALYTICS VENDORS TABLE QUERIES
 * Table: vendors
 * Database: Analytics DB
 * Note: Similar structure to Main DB vendors, but with additional analytics fields
 */
export const analyticsVendorsQueries = {
  /**
   * GET /api/analytics/vendors
   * Find all analytics vendors with organization info
   */
  findAllWithOrganizations: (supabase: SupabaseClient, filters?: {
    orgId?: number
    analyticsReady?: boolean
    configReady?: boolean
    configLastStatus?: string
  }) => {
    let query = supabase
      .from("vendors")
      .select("*, organizations(id, name)")

    if (filters?.orgId) {
      query = query.eq("org_id", filters.orgId)
    }

    if (filters?.analyticsReady !== undefined) {
      query = query.eq("analytics_ready", filters.analyticsReady)
    }

    if (filters?.configReady !== undefined) {
      query = query.eq("config_ready", filters.configReady)
    }

    if (filters?.configLastStatus) {
      query = query.eq("config_last_status", filters.configLastStatus)
    }

    return query.order("id", { ascending: true })
  },

  /**
   * Services: analyticsMirrorService
   * Find config hash for vendor (for change detection)
   */
  findConfigHash: (supabase: SupabaseClient, id: number) => {
    return supabase
      .from("vendors")
      .select("config_hash")
      .eq("id", id)
      .maybeSingle()
  },

  /**
   * Services: analyticsMirrorService
   * Upsert vendor (mirror from main DB)
   */
  upsert: (supabase: SupabaseClient, data: {
    id: number
    org_id: number
    name: string
    vendor_type: string
    config: Record<string, any>
    config_hash: string
    config_ready?: boolean
    config_last_run_at?: string
    config_last_status?: string
    config_last_error?: string | null
    analytics_ready?: boolean
  }) => {
    return supabase
      .from("vendors")
      .upsert({
        id: data.id,
        org_id: data.org_id,
        name: data.name,
        vendor_type: data.vendor_type,
        config: data.config,
        config_hash: data.config_hash,
        config_ready: data.config_ready ?? true,
        config_last_run_at: data.config_last_run_at || new Date().toISOString(),
        config_last_status: data.config_last_status || "success",
        config_last_error: data.config_last_error || null,
        analytics_ready: data.analytics_ready ?? true,
      }, {
        onConflict: "id",
      })
      .select()
      .single()
  },
}

/**
 * ANALYTICS PLANTS TABLE QUERIES
 * Table: plants
 * Database: Analytics DB
 * Note: Similar structure to Main DB plants, but simplified
 */
export const analyticsPlantsQueries = {
  /**
   * GET /api/analytics/plants
   * Find all analytics plants with organization and vendor
   */
  findAllWithRelations: (supabase: SupabaseClient, filters?: {
    orgId?: number
    vendorId?: number
  }) => {
    let query = supabase
      .from("plants")
      .select(`
        *,
        organizations (
          id,
          name
        ),
        vendors (
          id,
          name,
          vendor_type
        )
      `)

    if (filters?.orgId) {
      query = query.eq("org_id", filters.orgId)
    }

    if (filters?.vendorId) {
      query = query.eq("vendor_id", filters.vendorId)
    }

    return query.order("id", { ascending: true })
  },

  /**
   * Services: analyticsMirrorService, analyticsSnapshotService
   * Batch upsert plants (mirror from main DB)
   */
  batchUpsert: (supabase: SupabaseClient, plants: any[], batchSize: number = 100) => {
    return supabase
      .from("plants")
      .upsert(plants, { onConflict: "id" })
      .select()
  },
}

/**
 * PLANT_ENERGY_READINGS TABLE QUERIES
 * Table: plant_energy_readings
 * Database: Analytics DB only
 */
export const plantEnergyReadingsQueries = {
  /**
   * GET /api/analytics/plants/[id]/energy
   * Find energy readings by plant ID
   */
  findByPlantId: (supabase: SupabaseClient, plantId: number, filters?: {
    startDate?: string
    endDate?: string
    limit?: number
  }) => {
    let query = supabase
      .from("plant_energy_readings")
      .select("*")
      .eq("plant_id", plantId)

    if (filters?.startDate) {
      query = query.gte("reading_date", filters.startDate)
    }

    if (filters?.endDate) {
      query = query.lte("reading_date", filters.endDate)
    }

    query = query.order("reading_date", { ascending: true })

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    return query
  },

  /**
   * Services: analyticsSnapshotService
   * Batch upsert energy readings
   */
  batchUpsert: (supabase: SupabaseClient, readings: any[], batchSize: number = 100) => {
    return supabase
      .from("plant_energy_readings")
      .upsert(readings, { onConflict: "plant_id,reading_date" })
      .select()
  },
}

/**
 * PLANT_GRID_DOWNTIME_READINGS TABLE QUERIES
 * Table: plant_grid_downtime_readings
 * Database: Analytics DB only
 */
export const plantGridDowntimeReadingsQueries = {
  /**
   * GET /api/analytics/plants/[id]/grid-downtime
   * Find grid downtime readings by plant ID
   */
  findByPlantId: (supabase: SupabaseClient, plantId: number, filters?: {
    startDate?: string
    endDate?: string
    limit?: number
  }) => {
    let query = supabase
      .from("plant_grid_downtime_readings")
      .select("*")
      .eq("plant_id", plantId)

    if (filters?.startDate) {
      query = query.gte("reading_date", filters.startDate)
    }

    if (filters?.endDate) {
      query = query.lte("reading_date", filters.endDate)
    }

    query = query.order("reading_date", { ascending: true })

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    return query
  },

  /**
   * Services: gridDowntimeAnalyticsService
   * Get latest baseline for a plant (for grid downtime calculation)
   */
  getLatestBaseline: (supabase: SupabaseClient, plantId: number, cutoffDate: string) => {
    return supabase
      .from("plant_grid_downtime_readings")
      .select("total_grid_down_seconds, reading_date")
      .eq("plant_id", plantId)
      .lt("reading_date", cutoffDate)
      .order("reading_date", { ascending: false })
      .limit(1)
      .maybeSingle()
  },

  /**
   * Services: gridDowntimeAnalyticsService
   * Batch upsert grid downtime readings
   */
  batchUpsert: (supabase: SupabaseClient, readings: any[], batchSize: number = 2000) => {
    return supabase
      .from("plant_grid_downtime_readings")
      .upsert(readings, { onConflict: "plant_id,reading_date" })
      .select()
  },
}

/**
 * ANALYTICS_SNAPSHOT_RUNS TABLE QUERIES
 * Table: analytics_snapshot_runs
 * Database: Analytics DB only
 */
export const analyticsSnapshotRunsQueries = {
  /**
   * GET /api/analytics/vendors
   * Find last run for each vendor
   */
  findLastRunsByVendors: (supabase: SupabaseClient, vendorIds: number[]) => {
    return supabase
      .from("analytics_snapshot_runs")
      .select("vendor_id, status, error_message, completed_at")
      .in("vendor_id", vendorIds)
      .order("started_at", { ascending: false })
  },

  /**
   * Services: analyticsSnapshotService
   * Create snapshot run
   */
  create: (supabase: SupabaseClient, data: {
    vendor_id: number
    started_at: string
    status: "running" | "success" | "error"
  }) => {
    return supabase
      .from("analytics_snapshot_runs")
      .insert(data)
      .select()
      .single()
  },

  /**
   * Services: analyticsSnapshotService
   * Update snapshot run
   */
  update: (supabase: SupabaseClient, id: number, data: {
    completed_at?: string | null
    status?: "running" | "success" | "error"
    plants_processed?: number | null
    rows_upserted?: number | null
    error_message?: string | null
  }) => {
    return supabase
      .from("analytics_snapshot_runs")
      .update(data)
      .eq("id", id)
      .select()
      .single()
  },
}

/**
 * ============================================================================
 * SERVICE-SPECIFIC QUERIES (from lib/services/)
 * ============================================================================
 */

/**
 * PLANT SYNC SERVICE QUERIES
 * Service: lib/services/plantSyncService.ts
 */
export const plantSyncServiceQueries = {
  /**
   * Get organization name for vendor
   */
  getOrgName: (supabase: SupabaseClient, orgId: number) => {
    return supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single()
  },

  /**
   * Find existing plants by vendor_plant_id (already in plantsQueries)
   * Update plant production metrics (already in plantsQueries)
   * Batch upsert plants (already in plantsQueries)
   */
}

/**
 * ALERT SYNC SERVICE QUERIES
 * Service: lib/services/alertSyncService.ts
 * Note: Most queries already covered in alertsQueries
 */
export const alertSyncServiceQueries = {
  /**
   * Find existing alerts by vendor identifiers (already in alertsQueries)
   * Batch upsert alerts (already in alertsQueries)
   */
}

/**
 * ANALYTICS MIRROR SERVICE QUERIES
 * Service: lib/services/analyticsMirrorService.ts
 */
export const analyticsMirrorServiceQueries = {
  /**
   * Fetch all organizations from main DB
   */
  fetchAllOrgsFromMain: (supabase: SupabaseClient) => {
    return supabase
      .from("organizations")
      .select("*")
  },

  /**
   * Find analytics org config hash (already in analyticsOrganizationsQueries)
   * Upsert analytics org (already in analyticsOrganizationsQueries)
   * Update analytics org status (for no-change case)
   */
  updateOrgStatusNoChange: (supabase: SupabaseClient, id: number, now: string) => {
    return supabase
      .from("organizations")
      .update({
        config_ready: true,
        config_last_run_at: now,
        config_last_status: "success",
        config_last_error: null,
      })
      .eq("id", id)
  },

  /**
   * Fetch all vendors from main DB
   */
  fetchAllVendorsFromMain: (supabase: SupabaseClient) => {
    return supabase
      .from("vendors")
      .select("*")
  },

  /**
   * Find analytics vendor config hash (already in analyticsVendorsQueries)
   * Upsert analytics vendor (already in analyticsVendorsQueries)
   * Update analytics vendor status (for no-change case)
   */
  updateVendorStatusNoChange: (supabase: SupabaseClient, id: number, now: string) => {
    return supabase
      .from("vendors")
      .update({
        config_ready: true,
        config_last_run_at: now,
        config_last_status: "success",
        config_last_error: null,
      })
      .eq("id", id)
  },

  /**
   * Fetch all plants from main DB
   */
  fetchAllPlantsFromMain: (supabase: SupabaseClient) => {
    return supabase
      .from("plants")
      .select("*")
  },

  /**
   * Batch upsert analytics plants (already in analyticsPlantsQueries)
   */
}

/**
 * ANALYTICS SNAPSHOT SERVICE QUERIES
 * Service: lib/services/analyticsSnapshotService.ts
 */
export const analyticsSnapshotServiceQueries = {
  /**
   * Find vendors ready for analytics
   */
  findReadyVendors: (supabase: SupabaseClient) => {
    return supabase
      .from("vendors")
      .select("id, org_id, name, vendor_type, config, analytics_ready, config_ready, config_last_status")
      .eq("analytics_ready", true)
      .eq("config_ready", true)
      .eq("config_last_status", "success")
  },

  /**
   * Fetch org configs for gating
   */
  fetchOrgConfigs: (supabase: SupabaseClient) => {
    return supabase
      .from("organizations")
      .select("id, config")
  },

  /**
   * Create snapshot run (already in analyticsSnapshotRunsQueries)
   * Update snapshot run (already in analyticsSnapshotRunsQueries)
   * 
   * Fetch plants from main DB for vendor
   */
  fetchPlantsFromMainByVendor: (supabase: SupabaseClient, vendorId: number) => {
    return supabase
      .from("plants")
      .select("id, org_id, vendor_id, vendor_plant_id, name, daily_energy_kwh, monthly_energy_mwh, yearly_energy_mwh, total_energy_mwh, was_online_today, updated_at")
      .eq("vendor_id", vendorId)
  },

  /**
   * Batch upsert analytics plants (already in analyticsPlantsQueries)
   * Batch upsert energy readings (already in plantEnergyReadingsQueries)
   */
}

/**
 * GRID DOWNTIME ANALYTICS SERVICE QUERIES
 * Service: lib/services/gridDowntimeAnalyticsService.ts
 */
export const gridDowntimeAnalyticsServiceQueries = {
  /**
   * Find GRID_DOWN alerts (already in alertsQueries)
   * Get latest baseline (already in plantGridDowntimeReadingsQueries)
   * Batch upsert grid downtime readings (already in plantGridDowntimeReadingsQueries)
   * 
   * Fetch plants for processing
   */
  fetchPlantsForProcessing: (supabase: SupabaseClient) => {
    return supabase
      .from("plants")
      .select("id, org_id, vendor_id, vendor_plant_id, name")
  },
}

/**
 * WMS SYNC SERVICE QUERIES
 * Service: lib/services/wmsSyncService.ts
 */
export const wmsSyncServiceQueries = {
  /**
   * Get organization name for WMS vendor
   */
  getOrgName: (supabase: SupabaseClient, orgId: number) => {
    return supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle()
  },

  /**
   * Find existing site by vendor_site_id (already in wmsSitesQueries)
   * Upsert WMS site (individual, not batch)
   */
  upsertSite: (supabase: SupabaseClient, siteData: any) => {
    return supabase
      .from("wms_sites")
      .upsert(siteData, { onConflict: "wms_vendor_id,vendor_site_id" })
      .select()
      .single()
  },

  /**
   * Get synced site ID
   */
  getSyncedSiteId: (supabase: SupabaseClient, vendorId: number, vendorSiteId: string) => {
    return supabase
      .from("wms_sites")
      .select("id")
      .eq("wms_vendor_id", vendorId)
      .eq("vendor_site_id", vendorSiteId)
      .maybeSingle()
  },

  /**
   * Find existing device by vendor_device_id (already in wmsDevicesQueries)
   * Upsert WMS device (individual, not batch)
   */
  upsertDevice: (supabase: SupabaseClient, deviceData: any) => {
    return supabase
      .from("wms_devices")
      .upsert(deviceData, { onConflict: "wms_site_id,vendor_device_id" })
      .select()
      .single()
  },

  /**
   * Update WMS vendor last_sites_synced_at
   */
  updateLastSitesSyncedAt: (supabase: SupabaseClient, vendorId: number) => {
    return supabase
      .from("wms_vendors")
      .update({ last_sites_synced_at: new Date().toISOString() })
      .eq("id", vendorId)
  },

  /**
   * Find insolation reading by device and date (already in insolationReadingsQueries)
   * Upsert insolation reading (already in insolationReadingsQueries)
   */
}

/**
 * ============================================================================
 * QUERY ANALYSIS SUMMARY
 * ============================================================================
 * 
 * COMMON PATTERNS IDENTIFIED:
 * 
 * 1. SIMPLE CRUD OPERATIONS:
 *    - findAll, findById, create, update, delete
 *    - Common across: accounts, organizations, vendors, plants, alerts
 * 
 * 2. JOINS WITH RELATED ENTITIES:
 *    - findAllWithOrganizations (vendors, wms_vendors)
 *    - findAllWithRelations (plants with vendors & orgs)
 *    - findWithPlants (alerts with plants)
 * 
 * 3. BATCH OPERATIONS:
 *    - batchUpsert (plants, alerts, wms_sites, wms_devices, analytics plants/readings)
 *    - Common pattern: onConflict handling
 * 
 * 4. DEDUPLICATION QUERIES:
 *    - findExistingByVendorPlantIds (plants)
 *    - findExistingByVendorSiteIds (wms_sites)
 *    - findExistingByVendorDeviceIds (wms_devices)
 *    - findExistingByVendorIdentifiers (alerts)
 * 
 * 5. FILTERING QUERIES:
 *    - findByOrgId (multiple tables)
 *    - findByVendorId (plants)
 *    - findActive (vendors, wms_vendors)
 * 
 * 6. ANALYTICS-SPECIFIC:
 *    - Config hash queries (for change detection)
 *    - Snapshot run tracking
 *    - Energy readings aggregation
 *    - Grid downtime calculations
 * 
 * 7. SERVICE-SPECIFIC:
 *    - Individual upserts (WMS sites/devices)
 *    - Status updates (analytics mirror)
 *    - Cross-database queries (main DB → analytics DB)
 * 
 * MAIN DB vs ANALYTICS DB COMMONALITY:
 * 
 * Tables that exist in BOTH databases with similar structure:
 * - organizations (Main: simple, Analytics: + config fields)
 * - vendors (Main: simple, Analytics: + config/analytics fields)
 * - plants (Main: full, Analytics: simplified)
 * 
 * These can share common repository logic with database-specific adapters.
 * 
 * KEY INSIGHT: If Main DB and Analytics DB have the same schema for certain tables,
 * we can create a common repository interface that accepts a SupabaseClient,
 * allowing the same repository methods to work with both databases.
 */

