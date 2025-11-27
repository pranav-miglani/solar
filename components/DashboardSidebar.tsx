"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  Factory,
  FileText,
  AlertTriangle,
  BarChart3,
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
      href: "/superadmin/orgs",
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
    {
      title: "Analytics (Coming Soon)",
      href: "/analytics",
      icon: BarChart3,
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
            <h1 className="text-2xl font-bold">WOMS</h1>
            <p className="text-sm text-muted-foreground">
              Work Order Management System
            </p>
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

          <div className="mt-auto">
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

