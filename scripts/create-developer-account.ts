#!/usr/bin/env tsx
/**
 * Create DEVELOPER Account Script
 * 
 * This script creates a DEVELOPER account in the WOMS system.
 * DEVELOPER accounts have all SUPERADMIN privileges plus access to documentation.
 * 
 * DEVELOPER accounts CANNOT be created via the UI - they must be created using this script.
 * 
 * Usage:
 *   npx tsx scripts/create-developer-account.ts <email> <password>
 * 
 * Example:
 *   npx tsx scripts/create-developer-account.ts developer@woms.com dev123456
 * 
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set
 *   - The account_type enum must include 'DEVELOPER' (run migration 022_add_developer_account_type.sql first)
 */

import bcrypt from "bcryptjs"
import { createClient } from "@supabase/supabase-js"

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables must be set")
  console.error("")
  console.error("Example:")
  console.error("  export SUPABASE_URL='https://your-project.supabase.co'")
  console.error("  export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'")
  console.error("  npx tsx scripts/create-developer-account.ts developer@woms.com dev123456")
  process.exit(1)
}

// Get command line arguments
const args = process.argv.slice(2)

if (args.length < 2) {
  console.error("❌ Error: Missing required arguments")
  console.error("")
  console.error("Usage:")
  console.error("  npx tsx scripts/create-developer-account.ts <email> <password>")
  console.error("")
  console.error("Example:")
  console.error("  npx tsx scripts/create-developer-account.ts developer@woms.com dev123456")
  process.exit(1)
}

const email = args[0]
const password = args[1]

// Validate email format
if (!email.includes("@") || !email.includes(".")) {
  console.error("❌ Error: Invalid email format")
  process.exit(1)
}

// Validate password length
if (password.length < 6) {
  console.error("❌ Error: Password must be at least 6 characters long")
  process.exit(1)
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function createDeveloperAccount() {
  try {
    console.log("🔧 Creating DEVELOPER account...")
    console.log(`   Email: ${email}`)
    console.log("")

    // Check if account already exists
    const { data: existingAccount, error: checkError } = await supabase
      .from("accounts")
      .select("id, email, account_type")
      .eq("email", email)
      .single()

    if (existingAccount) {
      console.error(`❌ Error: Account with email ${email} already exists`)
      console.error(`   Account Type: ${existingAccount.account_type}`)
      console.error(`   Account ID: ${existingAccount.id}`)
      process.exit(1)
    }

    // Hash password
    console.log("🔐 Hashing password...")
    const passwordHash = await bcrypt.hash(password, 10)

    // Verify DEVELOPER enum value exists
    const { data: enumCheck, error: enumError } = await supabase.rpc("check_account_type_enum", {
      account_type_value: "DEVELOPER"
    }).single()

    // If RPC doesn't exist, try to insert and catch error
    if (enumError) {
      console.log("⚠️  Note: Could not verify DEVELOPER enum value (this is OK if migration hasn't been run)")
      console.log("   Make sure migration 022_add_developer_account_type.sql has been applied")
    }

    // Create DEVELOPER account
    console.log("📝 Inserting DEVELOPER account into database...")
    const { data: account, error: insertError } = await supabase
      .from("accounts")
      .insert({
        account_type: "DEVELOPER",
        email: email,
        password_hash: passwordHash,
        org_id: null, // DEVELOPER accounts don't belong to any organization
        is_active: true,
      })
      .select("id, email, account_type, org_id, created_at, is_active")
      .single()

    if (insertError) {
      console.error("❌ Error creating DEVELOPER account:")
      console.error(`   ${insertError.message}`)
      
      if (insertError.message.includes("invalid input value for enum account_type")) {
        console.error("")
        console.error("💡 Solution: Run migration 022_add_developer_account_type.sql first:")
        console.error("   psql -h <db-host> -U <user> -d <database> -f supabase/migrations/022_add_developer_account_type.sql")
      }
      
      process.exit(1)
    }

    console.log("")
    console.log("✅ DEVELOPER account created successfully!")
    console.log("")
    console.log("Account Details:")
    console.log(`   ID: ${account.id}`)
    console.log(`   Email: ${account.email}`)
    console.log(`   Account Type: ${account.account_type}`)
    console.log(`   Organization ID: ${account.org_id || "NULL (no organization)"}`)
    console.log(`   Active: ${account.is_active ? "Yes" : "No"}`)
    console.log(`   Created At: ${account.created_at}`)
    console.log("")
    console.log("🔐 Login Credentials:")
    console.log(`   Email: ${email}`)
    console.log(`   Password: ${password}`)
    console.log("")
    console.log("⚠️  Important:")
    console.log("   - DEVELOPER accounts have all SUPERADMIN privileges")
    console.log("   - DEVELOPER accounts can access documentation at /superadmin/system-flow")
    console.log("   - SUPERADMIN accounts CANNOT access documentation")
    console.log("   - Keep these credentials secure!")
    console.log("")

  } catch (error: any) {
    console.error("❌ Unexpected error:")
    console.error(`   ${error.message}`)
    if (error.stack) {
      console.error("")
      console.error("Stack trace:")
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// Run the script
createDeveloperAccount()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error)
    process.exit(1)
  })

