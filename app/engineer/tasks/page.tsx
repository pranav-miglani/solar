import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { EngineerTasksList } from "@/components/EngineerTasksList"

export default async function EngineerTasksPage() {
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

  if (userData?.role !== "ENGINEER") {
    redirect("/")
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">My Tasks</h1>
      <EngineerTasksList />
    </div>
  )
}

