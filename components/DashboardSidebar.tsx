"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
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
import { useUser } from "@/context/UserContext"
import { clearUserCache } from "@/context/UserContext"

export function DashboardSidebar() {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const { account, superAdmin, loading } = useUser()

  // Get accountType from context, fallback to empty string if loading
  const accountType = account?.accountType || ""
  const userLogoUrl = account?.logoUrl || null
  const superAdminLogoUrl = superAdmin?.logoUrl || null
  const superAdminDisplayName = superAdmin?.displayName || null

  const handleLogout = () => {
    // Clear user cache on logout
    clearUserCache()
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
      title: "Disabled Plants",
      href: "/superadmin/disabled-plants",
      icon: AlertTriangle,
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
  ]

  // Filter nav items based on account type (only if account is loaded)
  const filteredNavItems = account
    ? navItems.filter((item) => item.roles.includes(account.accountType))
    : []

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
            {userLogoUrl && (
              <div className="flex flex-col items-center justify-center mb-2">
                <div className="relative h-12 w-48 mb-2">
                  <Image 
                    src={userLogoUrl} 
                    alt="Logo" 
                    fill
                    className="object-contain"
                    unoptimized
                    onError={(e) => {
                      // Hide image on error
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <nav className="flex-1 space-y-2">
            {filteredNavItems.map((item) => {
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
                    <div className="relative h-8 w-32 opacity-70">
                      <Image 
                        src={superAdminLogoUrl} 
                        alt="Powered by" 
                        fill
                        className="object-contain"
                        unoptimized
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
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

