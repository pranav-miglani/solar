import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { WorkOrdersList } from "@/components/WorkOrdersList"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function WorkOrdersPage() {
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

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Work Orders</h1>
        {accountType === "SUPERADMIN" && (
          <Link href="/workorders/create">
            <Button>Create Work Order</Button>
          </Link>
        )}
      </div>
      <WorkOrdersList />
    </div>
  )
}

