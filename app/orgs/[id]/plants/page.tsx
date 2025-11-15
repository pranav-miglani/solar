import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { OrganizationPlantsView } from "@/components/OrganizationPlantsView"

export default async function OrganizationPlantsPage({
  params,
}: {
  params: { id: string }
}) {
  const cookieStore = await cookies()
  const session = cookieStore.get("session")?.value

  if (!session) {
    redirect("/auth/login")
  }

  try {
    JSON.parse(Buffer.from(session, "base64").toString())
  } catch {
    redirect("/auth/login")
  }

  return <OrganizationPlantsView orgId={params.id} />
}

