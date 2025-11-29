import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { DisabledPlantsTable } from "@/components/DisabledPlantsTable"
import { DashboardSidebar } from "@/components/DashboardSidebar"

export default async function DisabledPlantsPage() {
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

  const accountType = sessionData.accountType

  // Only SUPERADMIN can access this page
  if (accountType !== "SUPERADMIN") {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardSidebar />
      <div className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
            Disabled Plants
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Manage plants that have been inactive for 15+ days
          </p>
        </div>
        <DisabledPlantsTable />
      </div>
    </div>
  )
}

