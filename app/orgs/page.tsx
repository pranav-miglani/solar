import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { OrgsTable } from "@/components/OrgsTable"
import { DashboardSidebar } from "@/components/DashboardSidebar"

export default async function OrgsPage() {
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

  const accountType = sessionData.accountType as string

  // SUPERADMIN has full access, GOVT has read-only access
  if (accountType !== "SUPERADMIN" && accountType !== "GOVT") {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardSidebar accountType={accountType} />
      <div className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
            Organizations
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {accountType === "SUPERADMIN"
              ? "Manage all organizations and their accounts"
              : "View all organizations and their accounts (read-only)"}
          </p>
        </div>
        <OrgsTable accountType={accountType} />
      </div>
    </div>
  )
}


