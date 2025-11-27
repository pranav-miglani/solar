"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"

interface UserAccount {
  id: string
  email: string
  accountType: string
  orgId: number | null
  displayName: string | null
  logoUrl: string | null
}

interface SuperAdminInfo {
  logoUrl: string | null
  displayName: string | null
}

interface UserContextType {
  account: UserAccount | null
  superAdmin: SuperAdminInfo | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

const SESSION_STORAGE_KEY = "userData"
const SESSION_STORAGE_TIMESTAMP_KEY = "userDataTimestamp"

export function UserProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<UserAccount | null>(null)
  const [superAdmin, setSuperAdmin] = useState<SuperAdminInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUserData = async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch("/api/me")
      if (!response.ok) {
        throw new Error("Failed to fetch user data")
      }

      const data = await response.json()

      const userAccount: UserAccount = {
        id: data.account.id,
        email: data.account.email,
        accountType: data.account.accountType,
        orgId: data.account.orgId,
        displayName: data.account.displayName || null,
        logoUrl: data.account.logoUrl || null,
      }

      const superAdminInfo: SuperAdminInfo | null = data.superAdmin
        ? {
            logoUrl: data.superAdmin.logoUrl || null,
            displayName: data.superAdmin.displayName || null,
          }
        : data.account.accountType === "SUPERADMIN"
        ? {
            logoUrl: data.account.logoUrl || null,
            displayName: data.account.displayName || null,
          }
        : null

      setAccount(userAccount)
      setSuperAdmin(superAdminInfo)

      // Cache in sessionStorage
      const cacheData = {
        account: userAccount,
        superAdmin: superAdminInfo,
        timestamp: Date.now(),
      }
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(cacheData))
      sessionStorage.setItem(SESSION_STORAGE_TIMESTAMP_KEY, Date.now().toString())
    } catch (err) {
      console.error("Failed to fetch user data:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch user data")
      // Clear cache on error
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
      sessionStorage.removeItem(SESSION_STORAGE_TIMESTAMP_KEY)
    } finally {
      setLoading(false)
    }
  }

  const loadFromCache = (): boolean => {
    try {
      const cached = sessionStorage.getItem(SESSION_STORAGE_KEY)
      if (!cached) {
        return false
      }

      const cacheData = JSON.parse(cached)
      if (cacheData.account && cacheData.superAdmin !== undefined) {
        setAccount(cacheData.account)
        setSuperAdmin(cacheData.superAdmin)
        setLoading(false)
        return true
      }
    } catch (err) {
      console.error("Failed to load from cache:", err)
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
      sessionStorage.removeItem(SESSION_STORAGE_TIMESTAMP_KEY)
    }
    return false
  }

  useEffect(() => {
    // Try to load from cache first
    const cached = loadFromCache()
    
    // If not cached, fetch from API
    if (!cached) {
      fetchUserData()
    }
  }, [])

  const refresh = async (): Promise<void> => {
    await fetchUserData()
  }

  return (
    <UserContext.Provider
      value={{
        account,
        superAdmin,
        loading,
        error,
        refresh,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}

// Helper function to clear user cache (call on logout)
export function clearUserCache() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY)
  sessionStorage.removeItem(SESSION_STORAGE_TIMESTAMP_KEY)
  // Also clear individual logo caches for backward compatibility
  sessionStorage.removeItem("userLogoUrl")
  sessionStorage.removeItem("superAdminLogoUrl")
  sessionStorage.removeItem("superAdminDisplayName")
}

