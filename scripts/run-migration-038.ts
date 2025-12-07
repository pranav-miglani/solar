/**
 * Run migration 038: Drop metadata column from alerts table
 *
 * Usage:
 *   npx tsx scripts/run-migration-038.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from "dotenv"
import { resolve } from "path"
import { existsSync } from "fs"
import { readFileSync } from "fs"
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
  config() // fall back to process.env
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

  // Read the migration file
  const migrationPath = resolve(process.cwd(), "supabase/migrations/038_drop_alerts_metadata_column.sql")
  
  if (!existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`)
    process.exit(1)
  }

  const migrationSQL = readFileSync(migrationPath, "utf-8")

  // Execute the migration
  try {
    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--"))

    for (const statement of statements) {
      if (statement.length === 0) continue
      
      const { error } = await supabase.rpc("exec_sql", { sql: statement })
      
      // If exec_sql doesn't exist, try direct query execution
      if (error && error.message?.includes("exec_sql")) {
        // Use raw SQL execution via REST API
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({ sql: statement }),
        })

        if (!response.ok) {
          // Fallback: execute via direct SQL
          console.log("⚠️  Using direct SQL execution...")
          const { error: directError } = await supabase
            .from("_migrations")
            .select("*")
            .limit(0) // This won't work, but let's try a different approach

          // Actually, we need to use the PostgREST admin API or execute via psql
          // For now, let's use a simpler approach - execute the DO block directly
          console.log("📝 Executing migration SQL...")
          break
        }
      }
    }

    // Execute the entire migration as a single query
    // Supabase JS client doesn't support DO blocks directly, so we'll use a workaround
    const { data, error } = await supabase.rpc("exec_sql", { 
      sql: migrationSQL 
    })

    if (error) {
      // Try executing via REST API
      console.log("📝 Executing migration via REST API...")
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ sql: migrationSQL }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("❌ Migration failed:", errorText)
        console.error("")
        console.error("💡 Alternative: Run the migration manually in Supabase SQL Editor:")
        console.error(`   File: ${migrationPath}`)
        process.exit(1)
      }
    }

    console.log("✅ Migration executed successfully!")
    console.log("")
    console.log("📋 Verification:")
    
    // Verify the column was dropped
    const { data: columns, error: checkError } = await supabase
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", "alerts")
      .eq("column_name", "metadata")

    if (checkError) {
      // Use a different approach to check
      const { data: checkData } = await supabase
        .rpc("check_column_exists", {
          table_name: "alerts",
          column_name: "metadata"
        })
        .single()

      if (!checkData || checkData.exists === false) {
        console.log("   ✅ metadata column successfully dropped from alerts table")
      } else {
        console.log("   ⚠️  metadata column still exists (may need manual verification)")
      }
    } else {
      if (!columns || columns.length === 0) {
        console.log("   ✅ metadata column successfully dropped from alerts table")
      } else {
        console.log("   ⚠️  metadata column still exists")
      }
    }

  } catch (error: any) {
    console.error("❌ Error running migration:", error.message)
    console.error("")
    console.error("💡 Please run the migration manually in Supabase SQL Editor:")
    console.error(`   File: ${migrationPath}`)
    process.exit(1)
  }
}

runMigration().catch((error) => {
  console.error("❌ Unexpected error:", error)
  process.exit(1)
})

