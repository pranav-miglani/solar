import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { WorkOrderDetailView } from "@/components/WorkOrderDetailView"

export default async function WorkOrderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  // Check custom session authentication
  const cookieStore = await cookies()
  const session = cookieStore.get("session")?.value

  if (!session) {
    redirect("/auth/login")
  }

  // Decode session (middleware already validates, but we decode for component)
  let sessionData
  try {
    sessionData = JSON.parse(Buffer.from(session, "base64").toString())
  } catch {
    redirect("/auth/login")
  }

  const accountType = sessionData.accountType as string

  return <WorkOrderDetailView workOrderId={params.id} accountType={accountType} />
}

