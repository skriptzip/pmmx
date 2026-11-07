import { Capacitor } from '@capacitor/core'

const KEY = 'pmmx_server_url'

// Native App (Android/iOS): Server wird beim ersten Start vom Nutzer eingegeben.
// Web: relative /api (oder VITE_API_URL), wie bisher.
export const isNative = Capacitor.isNativePlatform()

export function normalizeServerUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  return url.replace(/\/api$/i, '')
}

export function getServerUrl(): string | null {
  try { return localStorage.getItem(KEY) } catch { return null }
}

export function setServerUrl(url: string) {
  try { localStorage.setItem(KEY, url) } catch { /* */ }
}

export function clearServerUrl() {
  try { localStorage.removeItem(KEY) } catch { /* */ }
}

export function apiBase(): string {
  if (isNative) return `${getServerUrl() ?? ''}/api`
  return import.meta.env.VITE_API_URL ?? '/api'
}

export async function checkServer(url: string): Promise<boolean> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 8000)
  try {
    const res = await fetch(`${url}/api/health`, { signal: ctrl.signal })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
