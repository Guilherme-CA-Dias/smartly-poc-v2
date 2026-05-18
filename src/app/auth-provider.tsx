"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { AuthCustomer, AuthCredentials } from "@/lib/auth"
import { ensureAuth, storeAuth } from "@/lib/auth"

interface AuthContextType {
  customerId: string | null
  customerName: string | null
  credentials: AuthCredentials
  setCustomerName: (name: string) => void
  setCredentials: (credentials: AuthCredentials) => void
}

export const AuthContext = createContext<AuthContextType>({
  customerId: null,
  customerName: null,
  credentials: {},
  setCustomerName: () => {},
  setCredentials: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthCustomer | null>(null)

  useEffect(() => {
    const currentAuth = ensureAuth()
    setAuth(currentAuth)
  }, [])

  const setCustomerName = (name: string) => {
    if (!auth) return
    const newAuth = { ...auth, customerName: name }
    storeAuth(newAuth)
    setAuth(newAuth)
  }

  const setCredentials = (credentials: AuthCredentials) => {
    if (!auth) return
    const newAuth = { ...auth, credentials }
    storeAuth(newAuth)
    setAuth(newAuth)
  }

  return (
    <AuthContext.Provider
      value={{
        customerId: auth?.customerId ?? null,
        customerName: auth?.customerName ?? null,
        credentials: auth?.credentials ?? {},
        setCustomerName,
        setCredentials,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Helper function to get auth headers for API calls
export function getAuthHeaders(): HeadersInit {
  const auth = ensureAuth()
  return {
    "x-auth-id": auth.customerId,
    "x-customer-name": auth.customerName || "",
    "x-credentials": JSON.stringify(auth.credentials ?? {}),
  }
}
