import { NextRequest } from 'next/server'
import type { AuthCustomer, AuthCredentials } from './auth'

export function getAuthFromRequest(request: NextRequest): AuthCustomer {
  const credentialsRaw = request.headers.get('x-credentials')
  let credentials: AuthCredentials = {}
  try {
    if (credentialsRaw) credentials = JSON.parse(credentialsRaw)
  } catch {}

  return {
    customerId: request.headers.get('x-auth-id') ?? '',
    customerName: request.headers.get('x-customer-name') ?? null,
    credentials,
  }
} 