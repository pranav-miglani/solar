import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { DashboardSidebar } from "@/components/DashboardSidebar"
import { DocumentationRunbooks } from "@/components/DocumentationRunbooks"

export default async function DocumentationRunbooksPage() {
  // Check custom session authentication
  const cookieStore = await cookies()
  const session = cookieStore.get("session")?.value

  if (!session) {
    redirect("/auth/login")
  }

  // Decode session to get account type
  let sessionData
  try {
    sessionData = JSON.parse(Buffer.from(session, "base64").toString())
  } catch {
    redirect("/auth/login")
  }

  const accountType = sessionData.accountType as "SUPERADMIN" | "ORG" | "GOVT" | "DEVELOPER"

  // Only DEVELOPER can access documentation & runbooks (SUPERADMIN cannot)
  if (accountType !== "DEVELOPER") {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardSidebar />
      <div className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
        <DocumentationRunbooks />
      </div>
    </div>
  )
}

