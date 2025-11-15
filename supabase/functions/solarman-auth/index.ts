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

    const { vendorId } = await req.json()

    // Get vendor config
    const { data: vendor, error: vendorError } = await supabaseClient
      .from("vendors")
      .select("*")
      .eq("id", vendorId)
      .eq("is_active", true)
      .single()

    if (vendorError || !vendor) {
      throw new Error("Vendor not found")
    }

    if (vendor.name !== "Solarman") {
      throw new Error("This function only supports Solarman")
    }

    const credentials = vendor.credentials as {
      appId: string
      appSecret: string
      username: string
      passwordSha256: string
    }

    // Authenticate with Solarman
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

    return new Response(
      JSON.stringify({
        success: true,
        token: data.access_token,
        expiresIn: data.expires_in,
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

