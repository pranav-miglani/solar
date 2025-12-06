import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { WmsInsolationView } from "@/components/WmsInsolationView"

export default async function WmsInsolationPage({
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

  return <WmsInsolationView deviceId={params.id} />
}

