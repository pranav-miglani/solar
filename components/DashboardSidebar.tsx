"use client"

import { useState, useEffect } from "react"
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

interface DashboardSidebarProps {
  accountType: string
  userLogoUrl?: string | null
  superAdminLogoUrl?: string | null
  superAdminDisplayName?: string | null
}

export function DashboardSidebar({ 
  accountType, 
  userLogoUrl: propUserLogoUrl,
  superAdminLogoUrl: propSuperAdminLogoUrl,
  superAdminDisplayName: propSuperAdminDisplayName,
}: DashboardSidebarProps) {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [userLogoUrl, setUserLogoUrl] = useState<string | null>(null)
  const [superAdminLogoUrl, setSuperAdminLogoUrl] = useState<string | null>(null)
  const [superAdminDisplayName, setSuperAdminDisplayName] = useState<string | null>(null)

  useEffect(() => {
    // If props are provided, use them and cache in sessionStorage
    if (propUserLogoUrl !== undefined) {
      setUserLogoUrl(propUserLogoUrl)
      if (propUserLogoUrl) {
        sessionStorage.setItem("userLogoUrl", propUserLogoUrl)
      }
    }
    if (propSuperAdminLogoUrl !== undefined) {
      setSuperAdminLogoUrl(propSuperAdminLogoUrl)
      if (propSuperAdminLogoUrl) {
        sessionStorage.setItem("superAdminLogoUrl", propSuperAdminLogoUrl)
      }
    }
    if (propSuperAdminDisplayName !== undefined) {
      setSuperAdminDisplayName(propSuperAdminDisplayName)
      if (propSuperAdminDisplayName) {
        sessionStorage.setItem("superAdminDisplayName", propSuperAdminDisplayName)
      }
    }

    // If props not provided, check sessionStorage first
    if (propUserLogoUrl === undefined) {
      const cachedUserLogo = sessionStorage.getItem("userLogoUrl")
      if (cachedUserLogo) {
        setUserLogoUrl(cachedUserLogo)
      } else {
        // Only fetch if not cached and props not provided
        fetch("/api/me")
          .then((res) => res.json())
          .then((data) => {
            if (data.account) {
              const logoUrl = data.account.logoUrl || null
              setUserLogoUrl(logoUrl)
              if (logoUrl) {
                sessionStorage.setItem("userLogoUrl", logoUrl)
              }
            }
          })
          .catch((error) => {
            console.error("Failed to fetch user info:", error)
          })
      }
    }
    
    if (propSuperAdminLogoUrl === undefined || propSuperAdminDisplayName === undefined) {
      const cachedSuperAdminLogo = sessionStorage.getItem("superAdminLogoUrl")
      const cachedSuperAdminName = sessionStorage.getItem("superAdminDisplayName")
      
      if (cachedSuperAdminLogo) {
        setSuperAdminLogoUrl(cachedSuperAdminLogo)
      }
      if (cachedSuperAdminName) {
        setSuperAdminDisplayName(cachedSuperAdminName)
      }
      
      // Only fetch if not cached and props not provided
      if (!cachedSuperAdminLogo || !cachedSuperAdminName) {
        fetch("/api/me")
          .then((res) => res.json())
          .then((data) => {
            // For SUPERADMIN, also set footer info from their own account
            if (data.account?.accountType === "SUPERADMIN") {
              const superAdminLogo = data.account.logoUrl || null
              const superAdminName = data.account.displayName || null
              setSuperAdminLogoUrl(superAdminLogo)
              setSuperAdminDisplayName(superAdminName)
              if (superAdminLogo) {
                sessionStorage.setItem("superAdminLogoUrl", superAdminLogo)
              }
              if (superAdminName) {
                sessionStorage.setItem("superAdminDisplayName", superAdminName)
              }
            }
            // For non-SUPERADMIN users, get SUPERADMIN info for footer
            if (data.superAdmin) {
              const superAdminLogo = data.superAdmin.logoUrl || null
              const superAdminName = data.superAdmin.displayName || null
              setSuperAdminLogoUrl(superAdminLogo)
              setSuperAdminDisplayName(superAdminName)
              if (superAdminLogo) {
                sessionStorage.setItem("superAdminLogoUrl", superAdminLogo)
              }
              if (superAdminName) {
                sessionStorage.setItem("superAdminDisplayName", superAdminName)
              }
            }
          })
          .catch((error) => {
            console.error("Failed to fetch user info:", error)
          })
      }
    }
  }, [propUserLogoUrl, propSuperAdminLogoUrl, propSuperAdminDisplayName])

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

