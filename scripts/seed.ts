/**
 * Seed script for WOMS database
 * Run with: npx tsx scripts/seed.ts
 * 
 * Make sure to have .env.local file with required environment variables
 */

import { config } from "dotenv"
import { resolve } from "path"
import { createClient } from "@supabase/supabase-js"
// Note: Using plain text passwords for simplicity
// For production, implement proper password hashing (bcrypt, argon2, etc.)

// Load environment variables from .env.local
const envPath = resolve(process.cwd(), ".env.local")
const result = config({ path: envPath })

if (result.error) {
  console.warn(`Warning: Could not load .env.local from ${envPath}`)
  console.warn("Make sure .env.local exists in the project root")
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing required Supabase environment variables")
  console.error("")
  console.error("Required variables:")
  if (!SUPABASE_URL) {
    console.error("  - NEXT_PUBLIC_SUPABASE_URL")
  }
  if (!SUPABASE_SERVICE_KEY) {
    console.error("  - SUPABASE_SERVICE_ROLE_KEY")
  }
  console.error("")
  console.error("Please create a .env.local file in the project root with these variables.")
  console.error("See SETUP_GUIDE.md for instructions.")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function seed() {
  console.log("🌱 Starting seed...")
  console.log("")

  // Delete existing accounts first
  console.log("🗑️  Cleaning up existing accounts...")
  const accountsToDelete = ["admin@woms.com", "govt@woms.com", "org1@woms.com"]
  
  for (const email of accountsToDelete) {
    const { error: deleteError } = await supabase
      .from("accounts")
      .delete()
      .eq("email", email)
    
    if (deleteError && deleteError.code !== "PGRST116") {
      console.warn(`⚠️  Could not delete ${email}:`, deleteError.message)
    } else {
      console.log(`  ✓ Deleted account: ${email}`)
    }
  }
  console.log("")

  // Create organizations
  let org1: any = null
  
  // Delete and recreate org1
  await supabase.from("organizations").delete().eq("name", "Solar Energy Corp")
  
  const { data: newOrg1, error: org1Error } = await supabase
    .from("organizations")
    .insert({
      name: "Solar Energy Corp",
      meta: { region: "North", established: "2020" },
    })
    .select()
    .single()

  if (org1Error) {
    console.error("❌ Error creating org1:", org1Error.message)
  } else {
    console.log("✓ Created organization: Solar Energy Corp")
    org1 = newOrg1
  }

  // Delete and recreate org2
  await supabase.from("organizations").delete().eq("name", "Green Power Solutions")
  
  const { data: org2, error: org2Error } = await supabase
    .from("organizations")
    .insert({
      name: "Green Power Solutions",
      meta: { region: "South", established: "2019" },
    })
    .select()
    .single()

  if (org2Error) {
    console.error("❌ Error creating org2:", org2Error.message)
  } else {
    console.log("✓ Created organization: Green Power Solutions")
  }

  // Create accounts with plain text passwords
  console.log("👤 Creating accounts...")
  
  const { data: superAdmin, error: superAdminError } = await supabase
    .from("accounts")
    .insert({
      account_type: "SUPERADMIN",
      email: "admin@woms.com",
      password_hash: "admin123",  // Plain text password
      org_id: null,
    })
    .select()
    .single()

  if (superAdminError) {
    console.error("❌ Error creating superadmin:", superAdminError.message)
  } else {
    console.log("✓ Created superadmin: admin@woms.com (password: admin123)")
  }

  const { data: govt, error: govtError } = await supabase
    .from("accounts")
    .insert({
      account_type: "GOVT",
      email: "govt@woms.com",
      password_hash: "govt123",  // Plain text password
      org_id: null,
    })
    .select()
    .single()

  if (govtError) {
    console.error("❌ Error creating govt:", govtError.message)
  } else {
    console.log("✓ Created govt account: govt@woms.com (password: govt123)")
  }

  if (org1) {
    const { data: org1Account, error: org1AccountError } = await supabase
      .from("accounts")
      .insert({
        account_type: "ORG",
        email: "org1@woms.com",
        password_hash: "org1123",  // Plain text password
        org_id: org1.id,
      })
      .select()
      .single()

    if (org1AccountError) {
      console.error("❌ Error creating org1 account:", org1AccountError.message)
    } else {
      console.log("✓ Created org1 account: org1@woms.com (password: org1123)")
    }
  }

  // Create vendor
  console.log("")
  console.log("🏭 Creating vendor...")
  
  // Delete existing vendor if exists
  await supabase.from("vendors").delete().eq("name", "Solarman")
  
  const { data: newVendor, error: vendorError } = await supabase
    .from("vendors")
    .insert({
      name: "Solarman",
      vendor_type: "SOLARMAN",
      api_base_url: "https://api.solarmanpv.com",
      credentials: {
        appId: "test_app_id",
        appSecret: "test_app_secret",
        username: "test_user",
        passwordSha256: "test_password_hash",
      },
      is_active: true,
    })
    .select()
    .single()

  let vendor: any = null
  if (vendorError) {
    console.error("❌ Error creating vendor:", vendorError.message)
  } else {
    console.log("✓ Created vendor: Solarman")
    vendor = newVendor
  }

  // Create plants
  console.log("")
  console.log("🌱 Creating plants...")
  
  if (org1 && vendor) {
    // Delete existing plant if exists
    await supabase.from("plants").delete().eq("name", "Solar Farm Alpha")
    
    const { data: plant1, error: plant1Error } = await supabase
      .from("plants")
      .insert({
        org_id: org1.id,
        vendor_id: vendor.id,
        vendor_plant_id: "station_001",
        name: "Solar Farm Alpha",
        capacity_kw: 1000,
        location: { lat: 40.7128, lng: -74.006, address: "New York, NY" },
      })
      .select()
      .single()

    if (plant1Error) {
      console.error("❌ Error creating plant1:", plant1Error.message)
    } else {
      console.log("✓ Created plant: Solar Farm Alpha")
    }
  }

  console.log("")
  console.log("✅ Seed completed!")
  console.log("")
  console.log("Default accounts:")
  console.log("  - Super Admin: admin@woms.com / admin123")
  console.log("  - Government: govt@woms.com / govt123")
  console.log("  - Organization: org1@woms.com / org1123")
}

seed().catch(console.error)

