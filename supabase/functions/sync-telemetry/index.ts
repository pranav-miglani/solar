// Supabase Edge Function: Sync Telemetry from Vendors
// This function polls vendor APIs and stores telemetry in the telemetry DB

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // For cloud Supabase, use service role key for database operations
    // SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatically available
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.")
    }

    // Main DB - use service role key to bypass RLS
    const mainSupabase = createClient(supabaseUrl, supabaseServiceKey)

    // Telemetry DB (separate instance) - use service role for write operations
    const telemetrySupabaseUrl = Deno.env.get("TELEMETRY_SUPABASE_URL") ?? ""
    const telemetrySupabaseServiceKey = Deno.env.get("TELEMETRY_SUPABASE_SERVICE_ROLE_KEY") ?? ""

    if (!telemetrySupabaseUrl || !telemetrySupabaseServiceKey) {
      throw new Error("Missing Telemetry Supabase environment variables. Ensure TELEMETRY_SUPABASE_URL and TELEMETRY_SUPABASE_SERVICE_ROLE_KEY are set.")
    }

    const telemetrySupabase = createClient(telemetrySupabaseUrl, telemetrySupabaseServiceKey)

    // Get all active plants
    const { data: plants, error: plantsError } = await mainSupabase
      .from("plants")
      .select(`
        *,
        vendors:vendor_id (*),
        organizations:org_id (id)
      `)
      .eq("is_active", true)

    if (plantsError) {
      throw new Error(`Failed to fetch plants: ${plantsError.message}`)
    }

    if (!plants || plants.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active plants found" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    let syncedCount = 0
    const errors: string[] = []

    // Sync telemetry for each plant
    for (const plant of plants) {
      try {
        const vendor = plant.vendors
        if (!vendor || vendor.vendor_type !== "SOLARMAN") {
          continue
        }

        // Get realtime data from vendor
        // In production, use the VendorManager here
        const credentials = vendor.credentials as {
          appId: string
          appSecret: string
          username: string
          passwordSha256: string
        }

        // Authenticate
        const authResponse = await fetch(
          `${vendor.api_base_url}/account/v1.0/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              appid: credentials.appId,
              secret: credentials.appSecret,
              username: credentials.username,
              password: credentials.passwordSha256,
            }),
          }
        )

        if (!authResponse.ok) {
          errors.push(`Auth failed for plant ${plant.id}`)
          continue
        }

        const authData = await authResponse.json()
        const token = authData.access_token

        // Get realtime data
        const telemetryResponse = await fetch(
          `${vendor.api_base_url}/station/v1.0/rt?stationId=${plant.vendor_plant_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        )

        if (!telemetryResponse.ok) {
          errors.push(`Telemetry fetch failed for plant ${plant.id}`)
          continue
        }

        const telemetryData = await telemetryResponse.json()

        if (!telemetryData.success) {
          errors.push(`Invalid telemetry data for plant ${plant.id}`)
          continue
        }

        // Store in telemetry DB
        const { error: insertError } = await telemetrySupabase
          .from("telemetry_readings")
          .insert({
            plant_id: plant.id,
            org_id: plant.org_id,
            ts: new Date().toISOString(),
            generation_power_kw: telemetryData.data.currentPower || 0,
            voltage: telemetryData.data.voltage,
            current: telemetryData.data.current,
            temperature: telemetryData.data.temperature,
            metadata: telemetryData.data,
          })

        if (insertError) {
          errors.push(`Insert failed for plant ${plant.id}: ${insertError.message}`)
        } else {
          syncedCount++
        }
      } catch (error) {
        errors.push(`Error syncing plant ${plant.id}: ${error.message}`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        total: plants.length,
        errors: errors.slice(0, 10), // Limit error output
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})

