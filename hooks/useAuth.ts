"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useUser } from "@/context/UserContext"

/**
 * Hook to handle authentication and redirect to login if not authenticated
 * Returns user account data and loading state
 */
export function useAuth() {
  const router = useRouter()
  const { account, loading, error } = useUser()

  useEffect(() => {
    if (loading) return
    
    if (error || !account) {
      router.push("/auth/login")
    }
  }, [loading, error, account, router])

  return {
    account,
    loading,
    error,
    accountType: account?.accountType || "",
    orgId: account?.orgId || null,
    displayName: account?.displayName || null,
  }
}

