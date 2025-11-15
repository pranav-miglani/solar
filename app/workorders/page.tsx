import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { WorkOrdersList } from "@/components/WorkOrdersList"

export default async function WorkOrdersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Work Orders</h1>
        <a href="/workorders/create">
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
            Create Work Order
          </button>
        </a>
      </div>
      <WorkOrdersList />
    </div>
  )
}

