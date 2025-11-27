import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { DashboardSidebar } from "@/components/DashboardSidebar"
import { Sparkles, LineChart } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get("session")?.value

  if (!session) {
    redirect("/auth/login")
  }

  let sessionData: any
  try {
    sessionData = JSON.parse(Buffer.from(session, "base64").toString())
  } catch {
    redirect("/auth/login")
  }

  const accountType = sessionData.accountType as string

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardSidebar accountType={accountType} />
      <main className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-transparent">
                Analytics
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                Deep-dive performance analytics and advanced insights are{" "}
                <span className="font-semibold text-primary">coming soon</span>.
              </p>
            </div>
            <Sparkles className="h-8 w-8 text-primary/70" />
          </div>

          <div className="rounded-2xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background/60 p-8 md:p-10 flex flex-col items-center justify-center text-center space-y-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2">
              <LineChart className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-semibold">Analytics module is coming soon</h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
              We&apos;re building a rich analytics layer on top of telemetry and work order data:
              performance benchmarking, PR trend analysis, loss breakdowns, and more. This page will
              light up automatically once analytics is wired to your live data.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}


