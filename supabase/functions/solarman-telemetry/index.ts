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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.")
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    const { plantId, stationId } = await req.json()

    if (!plantId || !stationId) {
      throw new Error("plantId and stationId are required")
    }

    // Get plant and vendor
    const { data: plant, error: plantError } = await supabaseClient
      .from("plants")
      .select("*, vendors(*)")
      .eq("id", plantId)
      .single()

    if (plantError || !plant) {
      throw new Error("Plant not found")
    }

    const vendor = plant.vendors
    if (vendor.name !== "Solarman") {
      throw new Error("This function only supports Solarman")
    }

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appid: credentials.appId,
          secret: credentials.appSecret,
          username: credentials.username,
          password: credentials.passwordSha256,
        }),
      }
    )

    if (!authResponse.ok) {
      throw new Error("Authentication failed")
    }

    const authData = await authResponse.json()
    const token = authData.access_token

    // Get realtime data
    const telemetryResponse = await fetch(
      `${vendor.api_base_url}/station/v1.0/rt?stationId=${stationId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    )

    if (!telemetryResponse.ok) {
      throw new Error("Failed to fetch telemetry")
    }

    const telemetryData = await telemetryResponse.json()

    if (!telemetryData.success) {
      throw new Error("Failed to fetch telemetry from Solarman")
    }

    // Normalize and store telemetry
    const normalizedData = {
      plant_id: plantId,
      ts: new Date().toISOString(),
      generation_power: telemetryData.data.currentPower || 0,
      meta: telemetryData.data,
    }

    const { error: insertError } = await supabaseClient
      .from("telemetry")
      .insert(normalizedData)

    if (insertError) {
      console.error("Error inserting telemetry:", insertError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          plantId,
          timestamp: normalizedData.ts,
          generationPower: normalizedData.generation_power,
          metadata: normalizedData.meta,
        },
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

