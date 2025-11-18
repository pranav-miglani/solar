// Supabase Edge Function: Compute Efficiency for Work Orders
// This function calculates efficiency metrics for plants in a work order

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

const BASELINE_FACTOR = 0.8 // 80% of capacity as baseline

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // For cloud Supabase, use service role key for database operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.")
    }

    // MAIN DB - Read work orders and plants from main database (separate Supabase instance)
    const mainSupabase = createClient(supabaseUrl, supabaseServiceKey)

    // TELEMETRY DB - Read telemetry from telemetry database (separate Supabase instance)
    const telemetrySupabaseUrl = Deno.env.get("TELEMETRY_SUPABASE_URL") ?? ""
    const telemetrySupabaseServiceKey = Deno.env.get("TELEMETRY_SUPABASE_SERVICE_ROLE_KEY") ?? ""

    if (!telemetrySupabaseUrl || !telemetrySupabaseServiceKey) {
      throw new Error("Missing Telemetry Supabase environment variables. Ensure TELEMETRY_SUPABASE_URL and TELEMETRY_SUPABASE_SERVICE_ROLE_KEY are set.")
    }

    const telemetrySupabase = createClient(telemetrySupabaseUrl, telemetrySupabaseServiceKey)

    const { workOrderId } = await req.json()

    if (!workOrderId) {
      throw new Error("workOrderId is required")
    }

    // Get work order plants
    const { data: woPlants, error: woPlantsError } = await mainSupabase
      .from("work_order_plants")
      .select(`
        plant_id,
        plants:plant_id (
          id,
          name,
          capacity_kw
        )
      `)
      .eq("work_order_id", workOrderId)
      .eq("is_active", true)

    if (woPlantsError || !woPlants) {
      throw new Error("Failed to fetch work order plants")
    }

    const results = []

    for (const woPlant of woPlants) {
      const plant = woPlant.plants as any

      if (!plant) {
        continue
      }

      // Get last 24 hours of telemetry from telemetry DB
      const twentyFourHoursAgo = new Date()
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

      const { data: telemetry, error: telemetryError } = await telemetrySupabase
        .from("telemetry_readings")
        .select("generation_power_kw, ts")
        .eq("plant_id", plant.id)
        .gte("ts", twentyFourHoursAgo.toISOString())
        .order("ts", { ascending: true })

      if (telemetryError) {
        console.error(`Error fetching telemetry for plant ${plant.id}:`, telemetryError)
        continue
      }

      if (!telemetry || telemetry.length === 0) {
        console.warn(`No telemetry data for plant ${plant.id}`)
        continue
      }

      // Calculate actual generation (sum of power over 24h, converted to kWh)
      // Assuming data points are hourly or more frequent
      const actualGen = telemetry.reduce((sum, t) => {
        return sum + (parseFloat(t.generation_power_kw) || 0)
      }, 0) / 1000 // Convert to MWh

      // Expected generation = capacity * baseline factor * 24 hours
      const expectedGen = (plant.capacity_kw * BASELINE_FACTOR * 24) / 1000 // MWh

      // Performance ratio
      const pr = expectedGen > 0 ? actualGen / expectedGen : 0

      // Efficiency percentage
      const efficiencyPct = pr * 100

      // Category
      let category = "Critical"
      if (efficiencyPct >= 85) {
        category = "Healthy"
      } else if (efficiencyPct >= 65) {
        category = "Suboptimal"
      }

      // Store efficiency record in main DB
      const { error: insertError } = await mainSupabase
        .from("work_order_plant_eff")
        .insert({
          work_order_id: workOrderId,
          plant_id: plant.id,
          recorded_at: new Date().toISOString(),
          actual_gen: actualGen,
          expected_gen: expectedGen,
          pr: pr,
          efficiency_pct: efficiencyPct,
          category: category,
        })

      if (insertError) {
        console.error(`Error inserting efficiency for plant ${plant.id}:`, insertError)
        continue
      }

      results.push({
        plantId: plant.id,
        plantName: plant.name,
        actualGen,
        expectedGen,
        pr,
        efficiencyPct,
        category,
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    )
  }
})
