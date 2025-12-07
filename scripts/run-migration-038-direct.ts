/**
 * Run migration 038: Drop metadata column from alerts table
 * 
 * This script executes the migration using a direct SQL approach.
 * 
 * Usage:
 *   npx tsx scripts/run-migration-038-direct.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from "dotenv"
import { resolve } from "path"
import { existsSync } from "fs"
import { createClient } from "@supabase/supabase-js"

const envLocalPath = resolve(process.cwd(), ".env.local")
const envDefaultPath = resolve(process.cwd(), ".env")
const envPath = existsSync(envLocalPath)
  ? envLocalPath
  : existsSync(envDefaultPath)
    ? envDefaultPath
    : null

if (envPath) {
  config({ path: envPath })
} else {
  config()
  console.warn("⚠️ No .env.local or .env file found; relying on existing environment variables.")
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing Supabase environment variables.")
  console.error("Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
  db: {
    schema: "public",
  },
})

async function runMigration() {
  console.log("🔄 Running migration 038: Drop metadata column from alerts table...")
  console.log("")

  try {
    // First, check if the column exists
    console.log("📝 Checking if metadata column exists...")
    
    const { data: checkData, error: checkError } = await supabase
      .from("alerts")
      .select("metadata")
      .limit(1)

    const columnExists = !checkError || checkError.code !== "42703" // 42703 = column does not exist

    if (!columnExists && checkError?.code === "42703") {
      console.log("ℹ️  metadata column does not exist (already dropped)")
      console.log("✅ Migration already applied or column never existed")
      return
    }

    // Column exists, now drop it
    console.log("📝 Dropping metadata column...")
    
    // Use REST API to execute ALTER TABLE
    const dropSQL = "ALTER TABLE alerts DROP COLUMN IF EXISTS metadata;"
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ query: dropSQL }),
    })

    if (response.ok) {
      console.log("✅ Migration executed successfully!")
      console.log("")
      console.log("📋 Verifying column was dropped...")
      
      // Verify by trying to select the column (should fail)
      const { error: verifyError } = await supabase
        .from("alerts")
        .select("metadata")
        .limit(1)

      if (verifyError && verifyError.code === "42703") {
        console.log("✅ Verified: metadata column successfully dropped")
      } else {
        console.log("⚠️  Warning: Could not verify column was dropped")
      }
    } else {
      const errorText = await response.text()
      console.error("❌ Migration failed via REST API")
      console.error("")
      console.error("💡 Please run the migration manually in Supabase SQL Editor:")
      console.error("")
      console.error("   ALTER TABLE alerts DROP COLUMN IF EXISTS metadata;")
      console.error("")
      process.exit(1)
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message)
    console.error("")
    console.error("💡 Please run the migration manually in Supabase SQL Editor:")
    console.error("")
    console.error("   ALTER TABLE alerts DROP COLUMN IF EXISTS metadata;")
    console.error("")
    console.error("   Or use the full migration file:")
    console.error("   supabase/migrations/038_drop_alerts_metadata_column.sql")
    process.exit(1)
  }
}

runMigration().catch((error) => {
  console.error("❌ Unexpected error:", error)
  process.exit(1)
})

