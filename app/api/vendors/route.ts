import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getMainDBClient } from "@/lib/supabase/serviceClient"
import { withMDCContext } from "@/lib/api/mdcHelper"
import { logger } from "@/lib/context/logger"

export async function GET(request: NextRequest) {
  return withMDCContext(
    request,
    "get-vendors",
    async (sessionData, userEmail) => {
      try {
        const accountType = sessionData.accountType as string

        requirePermission(accountType as any, "vendors", "read")

        logger.info("Fetching vendors list")

        // Use service role client to bypass RLS
        const supabase = getMainDBClient()

    const { data: vendors, error } = await supabase
      .from("vendors")
      .select("*, organizations(id, name, auto_sync_enabled, sync_interval_minutes)")
      .order("name")

        if (error) {
          logger.error("Vendors query error", error)
          return NextResponse.json(
            { error: "Failed to fetch vendors" },
            { status: 500 }
          )
        }

        logger.info(`Successfully fetched ${vendors?.length || 0} vendors`)
        return NextResponse.json({ vendors: vendors || [] })
      } catch (error: any) {
        logger.error("Vendors error", error)
        return NextResponse.json(
          { error: error.message || "Internal server error" },
          { status: 403 }
        )
      }
    }
  )
}

export async function POST(request: NextRequest) {
  return withMDCContext(
    request,
    "create-vendor",
    async (sessionData, userEmail) => {
      try {
        const accountType = sessionData.accountType as string

        requirePermission(accountType as any, "vendors", "create")

        const body = await request.json()
        const { name, vendor_type, api_base_url, credentials, is_active, org_id } = body

        if (!name || !vendor_type || !api_base_url || !credentials) {
          logger.warn("Missing required fields for vendor creation")
          return NextResponse.json(
            { error: "Name, vendor_type, api_base_url, and credentials are required" },
            { status: 400 }
          )
        }

        if (!org_id) {
          logger.warn("Missing org_id for vendor creation")
          return NextResponse.json(
            { error: "org_id is required" },
            { status: 400 }
          )
        }

        logger.info(`Creating vendor: ${name} for org ${org_id}`)

        // Use service role client to bypass RLS for insert
        const supabase = getMainDBClient()

        const { data: vendor, error } = await supabase
          .from("vendors")
          .insert({
            name,
            vendor_type,
            api_base_url,
            credentials,
            is_active: is_active ?? true,
            org_id,
          })
          .select()
          .single()

        if (error) {
          logger.error("Vendor creation error", error)
          return NextResponse.json(
            { error: "Failed to create vendor" },
            { status: 500 }
          )
        }

        logger.info(`Successfully created vendor: ${vendor.id} - ${vendor.name}`)
        return NextResponse.json({ vendor }, { status: 201 })
      } catch (error: any) {
        logger.error("Vendor creation error", error)
        return NextResponse.json(
          { error: error.message || "Internal server error" },
          { status: 403 }
        )
      }
    }
  )
}
