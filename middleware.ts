import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const session = request.cookies.get("session")?.value
  const allCookies = request.cookies.getAll()
  const cookieHeader = request.headers.get("cookie")
  
  // Log cookie debugging info (only for non-static assets and non-API routes)
  // Throttle logging to avoid spam
  const shouldLog = !request.nextUrl.pathname.startsWith("/_next") && 
                    !request.nextUrl.pathname.startsWith("/api")
  
  if (shouldLog) {
    console.log("🍪 [MIDDLEWARE] Cookie check:", {
      pathname: request.nextUrl.pathname,
      hasSessionCookie: !!session,
      sessionCookieLength: session?.length || 0,
      sessionCookiePreview: session ? session.substring(0, 30) + "..." : null,
      allCookiesCount: allCookies.length,
      allCookiesNames: allCookies.map(c => c.name),
      cookieHeader: cookieHeader || "(no Cookie header)",
      cookieHeaderLength: cookieHeader?.length || 0,
      requestUrl: request.url,
      requestOrigin: request.headers.get("origin"),
      requestHost: request.headers.get("host"),
      requestReferer: request.headers.get("referer"),
    })
  }

  // Public routes
  const publicRoutes = ["/auth/login"]
  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  )

  // If accessing a public route, allow
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Protected routes require authentication
  if (!session) {
    console.log("❌ [MIDDLEWARE] No session cookie found, redirecting to login")
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Decode session to get account type
  let accountType: string | null = null
  try {
    const sessionData = JSON.parse(
      Buffer.from(session, "base64").toString()
    )
    accountType = sessionData.accountType
    console.log("✅ [MIDDLEWARE] Session decoded successfully:", {
      accountType,
      accountId: sessionData.accountId,
      email: sessionData.email,
    })
  } catch (error) {
    // Invalid session, redirect to login
    console.log("❌ [MIDDLEWARE] Failed to decode session:", {
      error: error instanceof Error ? error.message : String(error),
      sessionPreview: session.substring(0, 50),
    })
    const loginUrl = new URL("/auth/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Role-based route protection
  const pathname = request.nextUrl.pathname

  // Superadmin-only routes
  if (pathname.startsWith("/superadmin")) {
    if (accountType !== "SUPERADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  // After login, always redirect to dashboard
  if (pathname === "/" || pathname === "/auth/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}
