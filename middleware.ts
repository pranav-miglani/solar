import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const session = request.cookies.get("session")?.value

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
  } catch {
    // Invalid session, redirect to login
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
