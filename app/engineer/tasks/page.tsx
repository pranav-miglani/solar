import { redirect } from "next/navigation"
import { cookies } from "next/headers"

// Note: ENGINEER role doesn't exist in the current system (only SUPERADMIN, ORG, GOVT)
// This page is redirected to dashboard
export default async function EngineerTasksPage() {
  // Check custom session authentication
  const cookieStore = await cookies()
  const session = cookieStore.get("session")?.value

  if (!session) {
    redirect("/auth/login")
  }

  // Redirect to dashboard (engineer role not supported in current system)
  redirect("/dashboard")
}

