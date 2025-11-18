import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getServiceClient } from "@/lib/supabase/serviceClient"

// Password hashing: User inputs plain text, we hash and compare with stored hash

export async function POST(request: NextRequest) {
  try {
    const url = request.url
    const method = request.method
    const headers = Object.fromEntries(request.headers.entries())
    
    console.log("🔐 [LOGIN] Login attempt started")
    console.log("🔐 [LOGIN] Request URL:", url)
    console.log("🔐 [LOGIN] Request Method:", method)
    console.log("🔐 [LOGIN] Request Headers:", {
      "content-type": headers["content-type"],
      "user-agent": headers["user-agent"],
      "origin": headers["origin"],
    })
    
    const { email, password } = await request.json()
    console.log("🔐 [LOGIN] Request received:", { email, passwordLength: password?.length })

    if (!email || !password) {
      console.log("❌ [LOGIN] Missing email or password")
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    // Verify Supabase environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    console.log("🔐 [LOGIN] Supabase config check:", {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      urlPrefix: supabaseUrl?.substring(0, 20) + "...",
    })

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("❌ [LOGIN] Missing Supabase environment variables")
      console.error("❌ [LOGIN] Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
      return NextResponse.json(
        { 
          error: "Server configuration error",
          hint: "SUPABASE_SERVICE_ROLE_KEY is required for login (bypasses RLS)"
        },
        { status: 500 }
      )
    }

    // Use service role client to bypass RLS for authentication
    // During login, user is not authenticated yet, so RLS would block the query
    const supabase = getServiceClient()
    console.log("🔐 [LOGIN] Supabase service client created (bypasses RLS for authentication)")

    // Test database connection
    console.log("🔐 [LOGIN] Testing database connection...")
    const { data: connectionTest, error: connectionError, count } = await supabase
      .from("accounts")
      .select("*", { count: "exact", head: true })

    if (connectionError) {
      console.error("❌ [LOGIN] Database connection error:", connectionError)
      console.error("❌ [LOGIN] Connection error details:", {
        message: connectionError.message,
        code: connectionError.code,
        details: connectionError.details,
        hint: connectionError.hint,
      })
      return NextResponse.json(
        { error: "Database connection failed", details: connectionError.message },
        { status: 500 }
      )
    }

    console.log("✅ [LOGIN] Database connection successful", {
      accountsTableExists: true,
      totalAccounts: count || 0,
    })

    // Find account by email
    // Note: Using service role key bypasses RLS, allowing us to query accounts
    // during login when user is not yet authenticated
    console.log("🔐 [LOGIN] Querying accounts table for email:", email)
    const { data: accounts, error: accountError } = await supabase
      .from("accounts")
      .select("*")
      .eq("email", email)
      .limit(1)

    if (accountError) {
      console.error("❌ [LOGIN] Database error:", accountError)
      console.error("❌ [LOGIN] Error details:", {
        message: accountError.message,
        code: accountError.code,
        details: accountError.details,
        hint: accountError.hint,
      })
      return NextResponse.json(
        { error: "Database error", details: accountError.message },
        { status: 500 }
      )
    }

    if (!accounts || accounts.length === 0) {
      console.log("❌ [LOGIN] Account not found for email:", email)
      console.log("💡 [LOGIN] Hint: No users exist in database. Run user setup script:")
      console.log("💡 [LOGIN]   - Run: supabase/migrations/004_manual_user_setup.sql")
      return NextResponse.json(
        { 
          error: "Invalid credentials",
          hint: "No account found. Ensure users are created in the database."
        },
        { status: 401 }
      )
    }

    const account = accounts[0]

    console.log("✅ [LOGIN] Account found:", {
      id: account.id,
      email: account.email,
      accountType: account.account_type,
      orgId: account.org_id,
      hasPassword: !!account.password_hash,
      passwordLength: account.password_hash?.length,
    })
    
    // Additional validation
    if (!account.password_hash) {
      console.error("❌ [LOGIN] Account has no password!")
      return NextResponse.json(
        { error: "Account configuration error" },
        { status: 500 }
      )
    }

    // Verify password (hash comparison)
    // User provides plain text password, we compare with stored bcrypt hash
    console.log("🔐 [LOGIN] Comparing password hash")
    
    // Check if stored password is a bcrypt hash (starts with $2a$, $2b$, or $2y$)
    const isBcryptHash = account.password_hash?.match(/^\$2[ayb]\$.{56}$/)
    
    let isValid = false
    if (isBcryptHash) {
      // Compare with bcrypt hash
      isValid = await bcrypt.compare(password, account.password_hash)
      console.log("🔐 [LOGIN] Password comparison (bcrypt):", {
        providedPasswordLength: password.length,
        storedHashLength: account.password_hash.length,
        isBcryptHash: true,
        match: isValid,
      })
    } else {
      // Fallback: plain text comparison (for backward compatibility during migration)
      isValid = password === account.password_hash
      console.log("🔐 [LOGIN] Password comparison (plain text fallback):", {
        providedPassword: password,
        storedPassword: account.password_hash,
        match: isValid,
        warning: "Password stored in plain text - should be migrated to hash",
      })
    }

    if (!isValid) {
      console.log("❌ [LOGIN] Password mismatch for email:", email)
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    console.log("✅ [LOGIN] Password verified successfully")

    // Create session (using Supabase Auth for session management)
    // For simplicity, we'll use JWT tokens
    // In production, you might want to use Supabase Auth properly
    const sessionData = {
      accountId: account.id,
      accountType: account.account_type,
      orgId: account.org_id,
    }
    console.log("🔐 [LOGIN] Creating session with data:", sessionData)

    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString("base64")
    console.log("🔐 [LOGIN] Session token created (first 20 chars):", sessionToken.substring(0, 20) + "...")

    const response = NextResponse.json({
      account: {
        id: account.id,
        email: account.email,
        accountType: account.account_type,
        orgId: account.org_id,
      },
    })

    // Set session cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    }
    console.log("🔐 [LOGIN] Setting session cookie with options:", {
      ...cookieOptions,
      secure: cookieOptions.secure,
      maxAge: cookieOptions.maxAge,
      nodeEnv: process.env.NODE_ENV,
    })

    response.cookies.set("session", sessionToken, cookieOptions)
    console.log("✅ [LOGIN] Login successful, session cookie set")

    return response
  } catch (error) {
    console.error("❌ [LOGIN] Unexpected error:", error)
    console.error("❌ [LOGIN] Error stack:", error instanceof Error ? error.stack : "No stack trace")
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
