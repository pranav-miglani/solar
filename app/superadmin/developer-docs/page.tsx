import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { DashboardSidebar } from "@/components/DashboardSidebar"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, BookMarked, ArrowRight } from "lucide-react"

export default async function DeveloperDocsPage() {
  // Check custom session authentication
  const cookieStore = await cookies()
  const session = cookieStore.get("session")?.value

  if (!session) {
    redirect("/auth/login")
  }

  // Decode session to get account type
  let sessionData
  try {
    sessionData = JSON.parse(Buffer.from(session, "base64").toString())
  } catch {
    redirect("/auth/login")
  }

  const accountType = sessionData.accountType as "SUPERADMIN" | "ORG" | "GOVT" | "DEVELOPER"

  // Only DEVELOPER can access developer docs
  if (accountType !== "DEVELOPER") {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardSidebar />
      <div className="md:ml-64 p-4 md:p-8 pt-16 md:pt-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Developer Docs</h1>
            <p className="text-muted-foreground">
              Comprehensive documentation, system flows, and operational runbooks for developers
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* System Flow Card */}
            <Link href="/superadmin/system-flow">
              <Card className="h-full hover:shadow-lg transition-all duration-200 hover:border-primary/50 cursor-pointer group">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <BookOpen className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">System Flow</CardTitle>
                  </div>
                  <CardDescription>
                    Detailed system architecture, API flows, and data flow diagrams
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-primary font-medium group-hover:underline">
                    View System Flow
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* Documentation & Runbooks Card */}
            <Link href="/superadmin/documentation-runbooks">
              <Card className="h-full hover:shadow-lg transition-all duration-200 hover:border-primary/50 cursor-pointer group">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <BookMarked className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">Documentation & Runbooks</CardTitle>
                  </div>
                  <CardDescription>
                    Operational runbooks, troubleshooting guides, and vendor configuration documentation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-primary font-medium group-hover:underline">
                    View Documentation
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

