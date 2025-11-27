"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  Factory,
  FileText,
  AlertTriangle,
  LogOut,
  Menu,
  X,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface DashboardSidebarProps {
  accountType: string
}

export function DashboardSidebar({ accountType }: DashboardSidebarProps) {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [userLogoUrl, setUserLogoUrl] = useState<string | null>(null)
  const [superAdminLogoUrl, setSuperAdminLogoUrl] = useState<string | null>(null)
  const [superAdminDisplayName, setSuperAdminDisplayName] = useState<string | null>(null)

  useEffect(() => {
    // Fetch user info to get logo URL
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.account) {
          // Use account logo_url for all users (ORG, GOVT, SUPERADMIN)
          // For ORG users, this represents the organization logo (since each org has one account)
          setUserLogoUrl(data.account.logoUrl || null)
          
          // For SUPERADMIN, also set footer info from their own account
          if (data.account.accountType === "SUPERADMIN") {
            setSuperAdminLogoUrl(data.account.logoUrl || null)
            setSuperAdminDisplayName(data.account.displayName || null)
          }
        }
        // For non-SUPERADMIN users, get SUPERADMIN info for footer
        if (data.superAdmin) {
          setSuperAdminLogoUrl(data.superAdmin.logoUrl || null)
          setSuperAdminDisplayName(data.superAdmin.displayName || null)
        }
      })
      .catch((error) => {
        console.error("Failed to fetch user info:", error)
      })
  }, [])

  const handleLogout = () => {
    document.cookie = "session=; path=/; max-age=0"
    window.location.href = "/auth/login"
  }

  const navItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      roles: ["SUPERADMIN", "ORG", "GOVT"],
    },
    {
      title: "Organizations",
      href: "/orgs",
      icon: Building2,
      roles: ["SUPERADMIN", "GOVT"],
    },
    {
      title: "Vendors",
      href: "/superadmin/vendors",
      icon: Factory,
      roles: ["SUPERADMIN"],
    },
    {
      title: "Vendor Sync",
      href: "/superadmin/vendor-sync",
      icon: RefreshCw,
      roles: ["SUPERADMIN"],
    },
    {
      title: "Work Orders",
      href: "/workorders",
      icon: FileText,
      roles: ["SUPERADMIN", "ORG", "GOVT"],
    },
    {
      title: "Alerts",
      href: "/alerts",
      icon: AlertTriangle,
      roles: ["SUPERADMIN", "ORG", "GOVT"],
    },
  ].filter((item) => item.roles.includes(accountType))

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "glass-panel fixed left-0 top-0 h-screen w-64 border-r p-6 z-40 transition-transform duration-300",
          "md:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="mb-8">
            {userLogoUrl ? (
              <div className="flex flex-col items-center justify-center mb-2">
                <img 
                  src={userLogoUrl} 
                  alt="Logo" 
                  className="h-12 w-auto max-w-full object-contain mb-2"
                  onError={(e) => {
                    // Hide image on error and show fallback
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
                <div style={{ display: 'none' }} className="text-center">
                  <h1 className="text-2xl font-bold">WOMS</h1>
                  <p className="text-sm text-muted-foreground">
                    Work Order Management System
                  </p>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold">WOMS</h1>
                <p className="text-sm text-muted-foreground">
                  Work Order Management System
                </p>
              </>
            )}
          </div>

          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                >
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start",
                      isActive && "bg-secondary/50"
                    )}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.title}
                  </Button>
                </Link>
              )
            })}
          </nav>

          <div className="mt-auto space-y-4">
            {/* Footer with SUPERADMIN logo and "Powered by" text */}
            {(superAdminLogoUrl || superAdminDisplayName) && (
              <div className="pt-4 border-t border-border">
                <div className="flex flex-col items-center gap-2">
                  {superAdminLogoUrl && (
                    <img 
                      src={superAdminLogoUrl} 
                      alt="Powered by" 
                      className="h-8 w-auto max-w-full object-contain opacity-70"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  )}
                  <p className="text-xs text-muted-foreground text-center">
                    Powered by {superAdminDisplayName || "Gigasolar"}
                  </p>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}

