"use client"

import { IntegrationAppProvider } from "@integration-app/react"
import { getAuthHeaders, useAuth } from "./auth-provider"

export function IntegrationProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { credentials } = useAuth()

  const fetchToken = async () => {
    const response = await fetch("/api/integration-token", {
      headers: getAuthHeaders(),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch integration token")
    }
    return data.token
  }

  return (
    <IntegrationAppProvider fetchToken={fetchToken} credentials={credentials}>
      {children}
    </IntegrationAppProvider>
  )
}
