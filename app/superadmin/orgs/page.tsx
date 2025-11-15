import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OrgsTable } from "@/components/OrgsTable"

export default async function OrgsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (userData?.role !== "SUPERADMIN") {
    redirect("/")
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

