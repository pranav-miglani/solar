import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { WmsDevicesListView } from "@/components/WmsDevicesListView"

export default async function WmsDevicesPage({
  params,
}: {
  params: { id: string }
}) {
  const cookieStore = await cookies()
  const session = cookieStore.get("session")?.value

  if (!session) {
    redirect("/auth/login")
  }

  let sessionData
  try {
    sessionData = JSON.parse(Buffer.from(session, "base64").toString())
  } catch {
    redirect("/auth/login")
  }

  const accountType = sessionData.accountType as "SUPERADMIN" | "DEVELOPER" | "ORG" | "GOVT"

  // GOVT users cannot access WMS
  if (accountType === "GOVT") {
    redirect("/dashboard")
  }

  return <WmsDevicesListView siteId={params.id} />
}

