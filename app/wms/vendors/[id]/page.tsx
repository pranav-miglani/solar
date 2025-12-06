import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { WmsVendorDetailView } from "@/components/WmsVendorDetailView"

export default async function WmsVendorDetailPage({
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

  return <WmsVendorDetailView vendorId={params.id} />
}

