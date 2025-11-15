// Supabase Edge Function: Generic Vendor Authentication
// This function authenticates with vendor APIs and caches tokens

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // For cloud Supabase, use service role key for database operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase environment variables" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey)

    const { vendorId } = await req.json()

    if (!vendorId) {
      return new Response(
        JSON.stringify({ error: "vendorId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Get vendor config
    const { data: vendor, error: vendorError } = await supabaseClient
      .from("vendors")
      .select("*")
      .eq("id", vendorId)
      .single()

    if (vendorError || !vendor) {
      return new Response(
        JSON.stringify({ error: "Vendor not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // Authenticate based on vendor type
    let token: string

    if (vendor.vendor_type === "SOLARMAN") {
      const credentials = vendor.credentials as {
        appId: string
        appSecret: string
        username: string
        passwordSha256: string
      }

      const response = await fetch(
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

      if (!response.ok) {
        throw new Error(`Solarman authentication failed: ${response.statusText}`)
      }

      const data = await response.json()
      token = data.access_token

      // Cache token (in production, use Redis or Supabase KV)
      // For now, we'll return it directly
    } else {
      return new Response(
        JSON.stringify({ error: `Unsupported vendor type: ${vendor.vendor_type}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    return new Response(
      JSON.stringify({ token, vendorType: vendor.vendor_type }),
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

