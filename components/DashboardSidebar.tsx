"use client"

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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface DashboardSidebarProps {
  accountType: string
}

export function DashboardSidebar({ accountType }: DashboardSidebarProps) {
  const pathname = usePathname()

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
      roles: ["SUPERADMIN"],
    },
    {
      title: "Vendors",
      href: "/superadmin/vendors",
      icon: Factory,
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
      title: "Analytics",
      href: "/analytics",
      icon: BarChart3,
      roles: ["SUPERADMIN", "ORG", "GOVT"],
    },
  ].filter((item) => item.roles.includes(accountType))

  return (
    <aside className="glass-panel fixed left-0 top-0 h-screen w-64 border-r p-6">
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
              <Link key={item.href} href={item.href}>
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
  )
}

