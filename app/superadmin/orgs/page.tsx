import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { OrgsTable } from "@/components/OrgsTable"

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

  const accountType = sessionData.accountType

  // Only SUPERADMIN can access this page
  if (accountType !== "SUPERADMIN") {
    redirect("/dashboard")
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Organizations</h1>
      </div>
      <OrgsTable />
    </div>
  )
}

