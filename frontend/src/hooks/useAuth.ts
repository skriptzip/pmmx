import { useCallback, useEffect, useState } from 'react'
import { getMe } from '../api/client'
import type { Me } from '../api/types'

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => {
    try { return localStorage.getItem('pmmx_token') } catch { return null }
  })
  const [user, setUser] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    getMe()
      .then(setUser)
      .catch(() => {
        try { localStorage.removeItem('pmmx_token') } catch { /* */ }
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [token])

  const login = useCallback((jwt: string) => {
    try { localStorage.setItem('pmmx_token', jwt) } catch { /* */ }
    setToken(jwt)
    setUser(null)
    setLoading(true)
  }, [])

  const logout = useCallback(() => {
    try { localStorage.removeItem('pmmx_token') } catch { /* */ }
    setToken(null)
    setUser(null)
  }, [])

  return { user, token, loading, login, logout, isAuthenticated: !!token && !!user }
}
