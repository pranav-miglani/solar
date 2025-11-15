// Supabase Edge Function: Sync Alerts from Vendors
// This function polls vendor APIs and stores alerts in the main DB

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all active plants
    const { data: plants, error: plantsError } = await supabase
      .from("plants")
      .select(`
        *,
        vendors:vendor_id (*)
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

    for (const plant of plants) {
      try {
        const vendor = plant.vendors
        if (!vendor || vendor.vendor_type !== "SOLARMAN") {
          continue
        }

        // Authenticate
        const credentials = vendor.credentials as {
          appId: string
          appSecret: string
          username: string
          passwordSha256: string
        }

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

        // Get alerts
        const alertsResponse = await fetch(
          `${vendor.api_base_url}/station/v1.0/alerts?stationId=${plant.vendor_plant_id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        )

        if (!alertsResponse.ok) {
          errors.push(`Alerts fetch failed for plant ${plant.id}`)
          continue
        }

        const alertsData = await alertsResponse.json()

        if (!alertsData.success || !alertsData.data) {
          continue
        }

        // Process and store alerts
        for (const alert of alertsData.data) {
          // Map severity
          const severityMap: Record<number, string> = {
            1: "LOW",
            2: "MEDIUM",
            3: "HIGH",
            4: "CRITICAL",
          }

          const severity = severityMap[alert.alertLevel] || "MEDIUM"

          // Check if alert already exists
          const { data: existing } = await supabase
            .from("alerts")
            .select("id")
            .eq("vendor_alert_id", alert.alertId)
            .eq("plant_id", plant.id)
            .single()

          if (existing) {
            // Update existing alert
            await supabase
              .from("alerts")
              .update({
                title: alert.alertType || "Alert",
                description: alert.message,
                severity,
                status: "ACTIVE",
                updated_at: new Date().toISOString(),
              })
              .eq("id", existing.id)
          } else {
            // Insert new alert
            await supabase.from("alerts").insert({
              plant_id: plant.id,
              vendor_alert_id: alert.alertId,
              title: alert.alertType || "Alert",
              description: alert.message,
              severity,
              status: "ACTIVE",
              metadata: alert,
            })
          }

          syncedCount++
        }
      } catch (error) {
        errors.push(`Error syncing alerts for plant ${plant.id}: ${error.message}`)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        errors: errors.slice(0, 10),
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

