import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/rbac"
import { getOrganizationsRepository } from "@/lib/repositories/main"
import { logApiRequest, logApiResponse, withMDCContext } from "@/lib/api-logger"

// For orgs API, repository uses service role key to bypass RLS

// Mark route as dynamic to prevent static generation (uses cookies)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  return withMDCContext(request, async () => {
    logApiRequest(request)
    
    try {
      const session = request.cookies.get("session")?.value

      if (!session) {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      let sessionData
      try {
        sessionData = JSON.parse(Buffer.from(session, "base64").toString())
      } catch {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Invalid session" }, { status: 401 })
      }

      const accountType = sessionData.accountType as string

      requirePermission(accountType as any, "organizations", "read")

      // Fetch organizations using repository
      const orgsRepo = getOrganizationsRepository()
      const orgs = await orgsRepo.findAll()

      logApiResponse(request, 200, Date.now() - startTime)
      return NextResponse.json({ orgs })
    } catch (error: any) {
      console.error("Orgs error:", error)
      logApiResponse(request, 403, Date.now() - startTime, error)
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: 403 }
      )
    }
  })
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  return withMDCContext(request, async () => {
    logApiRequest(request)
    
    try {
      const session = request.cookies.get("session")?.value

      if (!session) {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      let sessionData
      try {
        sessionData = JSON.parse(Buffer.from(session, "base64").toString())
      } catch {
        logApiResponse(request, 401, Date.now() - startTime)
        return NextResponse.json({ error: "Invalid session" }, { status: 401 })
      }

      const accountType = sessionData.accountType as string

      // Only SUPERADMIN can create organizations
      requirePermission(accountType as any, "organizations", "create")

      const body = await request.json()
      const { name } = body

      if (!name) {
        logApiResponse(request, 400, Date.now() - startTime)
        return NextResponse.json(
          { error: "Name is required" },
          { status: 400 }
        )
      }

      // Create organization using repository
      const orgsRepo = getOrganizationsRepository()
      const org = await orgsRepo.save({ name })

      logApiResponse(request, 201, Date.now() - startTime)
      return NextResponse.json({ org }, { status: 201 })
    } catch (error: any) {
      console.error("Org creation error:", error)
      logApiResponse(request, error.message?.includes("permission") ? 403 : 500, Date.now() - startTime, error)
      return NextResponse.json(
        { error: error.message || "Internal server error" },
        { status: error.message?.includes("permission") ? 403 : 500 }
      )
    }
  })
}
