import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { getMainClient } from "@/lib/supabase/pooled"
import { logApiRequest, logApiResponse } from "@/lib/api-logger"

// Password hashing: User inputs plain text, we hash and compare with stored hash

// For login, we need to bypass RLS to query accounts table
// We use service role key since user is not authenticated yet

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  // Log login attempt (no user session yet)
  logApiRequest(request, { action: "Login attempt" })
  
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
      logApiResponse(request, 400, Date.now() - startTime)
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
      logApiResponse(request, 500, Date.now() - startTime)
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
    const supabase = getMainClient()
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
      logApiResponse(request, 500, Date.now() - startTime, connectionError)
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
      logApiResponse(request, 500, Date.now() - startTime, accountError)
      return NextResponse.json(
        { error: "Database error", details: accountError.message },
        { status: 500 }
      )
    }

    if (!accounts || accounts.length === 0) {
      console.log("❌ [LOGIN] Account not found for email:", email)
      console.log("💡 [LOGIN] Hint: No users exist in database. Run user setup script:")
      console.log("💡 [LOGIN]   - Run: supabase/migrations/004_manual_user_setup.sql")
      logApiResponse(request, 401, Date.now() - startTime, { email })
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
      logApiResponse(request, 500, Date.now() - startTime, { accountId: account.id })
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
      logApiResponse(request, 401, Date.now() - startTime, { email })
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
      email: account.email, // Include email for logging purposes
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
    // Determine if request is over HTTPS (check protocol or X-Forwarded-Proto header)
    const protocol = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol
    const isHttps = protocol === "https:" || protocol === "https"
    
    // Use environment variable if set, otherwise auto-detect from request
    // COOKIE_SECURE=true forces secure cookies, COOKIE_SECURE=false disables it
    // If not set, use HTTPS detection (secure only if request is HTTPS)
    const cookieSecure = process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === "true"
      : isHttps
    
    const cookieOptions = {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: "lax" as const,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/", // Explicitly set path
    }
    console.log("🔐 [LOGIN] Setting session cookie with options:", {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      maxAge: cookieOptions.maxAge,
      path: cookieOptions.path,
      requestProtocol: protocol,
      isHttps,
      cookieSecureEnv: process.env.COOKIE_SECURE,
      nodeEnv: process.env.NODE_ENV,
    })

    response.cookies.set("session", sessionToken, cookieOptions)
    console.log("✅ [LOGIN] Login successful, session cookie set")

    logApiResponse(request, 200, Date.now() - startTime, { 
      accountId: account.id, 
      accountType: account.account_type,
      email: account.email 
    })
    return response
  } catch (error) {
    console.error("❌ [LOGIN] Unexpected error:", error)
    console.error("❌ [LOGIN] Error stack:", error instanceof Error ? error.stack : "No stack trace")
    logApiResponse(request, 500, Date.now() - startTime, error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

