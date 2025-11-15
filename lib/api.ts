import { createClient } from "@/lib/supabase/server"

export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()

  if (userError || !userData) {
    return null
  }

  return {
    ...user,
    role: userData.role,
  }
}

export async function getUserOrgs(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("user_orgs")
    .select("org_id, orgs(*)")
    .eq("user_id", userId)

  if (error) {
    return []
  }

  return data.map((item: any) => item.orgs)
}

