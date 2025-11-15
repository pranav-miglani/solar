import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { WorkOrderDetail } from "@/components/WorkOrderDetail"

export default async function WorkOrderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <WorkOrderDetail workOrderId={params.id} />
}

