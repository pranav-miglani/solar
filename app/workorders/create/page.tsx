import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { CreateWorkOrderForm } from "@/components/CreateWorkOrderForm"

export default async function CreateWorkOrderPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Create Work Order</h1>
      <CreateWorkOrderForm />
    </div>
  )
}

