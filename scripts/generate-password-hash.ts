/**
 * Utility script to generate bcrypt hashes for passwords
 * Useful for SQL migrations or manual password setup
 * 
 * Usage: npx tsx scripts/generate-password-hash.ts <password>
 * Example: npx tsx scripts/generate-password-hash.ts admin123
 */

import bcrypt from "bcryptjs"

const password = process.argv[2]

if (!password) {
  console.error("❌ Error: Password required")
  console.log("Usage: npx tsx scripts/generate-password-hash.ts <password>")
  console.log("Example: npx tsx scripts/generate-password-hash.ts admin123")
  process.exit(1)
}

async function generateHash() {
  const hash = await bcrypt.hash(password, 10)
  console.log("")
  console.log("Password:", password)
  console.log("Hash:", hash)
  console.log("")
  console.log("Use this hash in SQL:")
  console.log(`  '${hash}'`)
  console.log("")
}

generateHash().catch(console.error)

