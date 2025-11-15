import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { WorkOrderDetail } from "@/components/WorkOrderDetail"

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
  try {
    JSON.parse(Buffer.from(session, "base64").toString())
  } catch {
    redirect("/auth/login")
  }

  return <WorkOrderDetail workOrderId={params.id} />
}

