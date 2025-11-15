import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { CreateWorkOrderForm } from "@/components/CreateWorkOrderForm"

export default async function CreateWorkOrderPage() {
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

  // Only SUPERADMIN can create work orders
  if (accountType !== "SUPERADMIN") {
    redirect("/dashboard")
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Create Work Order</h1>
      <CreateWorkOrderForm />
    </div>
  )
}

