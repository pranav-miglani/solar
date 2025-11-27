"use client"

import { ReactNode } from "react"
import { ThemeProvider } from "next-themes"
import { UserProvider } from "@/context/UserContext"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <UserProvider>{children}</UserProvider>
    </ThemeProvider>
  )
}
