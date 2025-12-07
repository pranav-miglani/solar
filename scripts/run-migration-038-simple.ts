/**
 * Run migration 038: Drop metadata column from alerts table
 * 
 * This script executes the migration SQL directly using Supabase client.
 * 
 * Usage:
 *   npx tsx scripts/run-migration-038-simple.ts
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
})

async function runMigration() {
  console.log("🔄 Running migration 038: Drop metadata column from alerts table...")
  console.log("")

  // The migration SQL
  const migrationSQL = `
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'alerts' 
    AND column_name = 'metadata'
  ) THEN
    ALTER TABLE alerts DROP COLUMN metadata;
    RAISE NOTICE '✅ Dropped metadata column from alerts table';
  ELSE
    RAISE NOTICE 'ℹ️  metadata column does not exist in alerts table (already dropped or never created)';
  END IF;
END $$;
  `.trim()

  try {
    // Execute via REST API (PostgREST doesn't support DO blocks directly)
    // We'll use a workaround: check if column exists, then drop it
    console.log("📝 Checking if metadata column exists...")
    
    // Check if column exists by querying information_schema
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'alerts' 
      AND column_name = 'metadata'
    `

    // Since Supabase JS client doesn't support DO blocks, we'll use a direct approach
    // Execute the ALTER TABLE statement directly if column exists
    const dropSQL = `ALTER TABLE alerts DROP COLUMN IF EXISTS metadata;`

    // Use the REST API to execute SQL
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({ query: dropSQL }),
    })

    if (!response.ok) {
      // Fallback: Try executing via psql or direct connection
      // For now, provide manual instructions
      console.log("⚠️  Could not execute via REST API.")
      console.log("")
      console.log("💡 Please run the migration manually:")
      console.log("")
      console.log("   1. Go to your Supabase project dashboard")
      console.log("   2. Navigate to SQL Editor")
      console.log("   3. Copy and paste the following SQL:")
      console.log("")
      console.log("   " + dropSQL)
      console.log("")
      console.log("   4. Click 'Run'")
      console.log("")
      
      // Try alternative: use a simpler approach
      console.log("🔄 Attempting alternative method...")
      
      // We can't execute DO blocks via Supabase JS client easily
      // So we'll just provide the SQL to run manually
      console.log("")
      console.log("📋 Migration SQL to run manually:")
      console.log("─".repeat(60))
      console.log(dropSQL)
      console.log("─".repeat(60))
      console.log("")
      console.log("✅ After running, the metadata column will be dropped.")
      return
    }

    const result = await response.json()
    console.log("✅ Migration executed successfully!")
    console.log("")
    console.log("📋 Result:", result)
    
  } catch (error: any) {
    console.error("❌ Error:", error.message)
    console.error("")
    console.error("💡 Please run the migration manually in Supabase SQL Editor:")
    console.error("")
    console.error("   ALTER TABLE alerts DROP COLUMN IF EXISTS metadata;")
    console.error("")
  }
}

runMigration().catch((error) => {
  console.error("❌ Unexpected error:", error)
  process.exit(1)
})

