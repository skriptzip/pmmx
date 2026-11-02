import type { LibraryMovie, LibraryShow, Me, MissingAudio, MissingEpisode, MissingMovie, ScanProgress, ScanRun, Status, UserSettings } from './types'

const BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('pmmx_token')
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// Auth
export const createPlexPin = () =>
  req<{ pin_id: number; auth_url: string }>('/auth/plex/pin', { method: 'POST' })

export interface PlexServer {
  name: string
  owned: boolean
  client_identifier: string
}

export const pollPlexPin = (pinId: number) =>
  req<{ status: 'pending' } | { status: 'authorized'; jwt: string; servers: PlexServer[] } | { status: 'expired' }>(
    `/auth/plex/poll/${pinId}`
  )

export const selectServer = (server_name: string, server_client_id: string) =>
  req('/auth/plex/server', {
    method: 'PATCH',
    body: JSON.stringify({ server_name, server_client_id }),
  })

export const getMe = () => req<Me>('/auth/me')

// Missing
export const getMissingMovies = (status: Status | 'all' = 'all') =>
  req<MissingMovie[]>(`/missing/movies?status=${status}`)

export const getMissingEpisodes = (status: Status | 'all' = 'all', showId?: number) =>
  req<MissingEpisode[]>(`/missing/episodes?status=${status}${showId ? `&show_tmdb_id=${showId}` : ''}`)

export const getMissingAudio = () => req<MissingAudio[]>('/missing/audio')

// Library
export const getLibraryMovies = (status = 'all') =>
  req<LibraryMovie[]>(`/library/movies?status=${status}`)

export const getLibraryShows = (status = 'all') =>
  req<LibraryShow[]>(`/library/shows?status=${status}`)

// Scan
export const triggerScan = (scan_type: 'full' | 'availability' | 'plex' = 'full') =>
  req('/scan/trigger', { method: 'POST', body: JSON.stringify({ scan_type }) })

// Re-checks one show against Plex only; TMDb data comes from the cache unless refreshTmdb is set
export const refreshShow = (tmdbId: number, refreshTmdb = false) =>
  req<LibraryShow>(`/scan/show/${tmdbId}?refresh_tmdb=${refreshTmdb}`, { method: 'POST' })

export const getScanStatus = () => req<ScanRun[]>('/scan/status')

export const getScanProgress = () => req<ScanProgress | null>('/scan/progress')

// Settings
export const getSettings = () => req<UserSettings>('/settings')

export const updateSettings = (settings: Partial<UserSettings> & { notification_config?: Record<string, string | undefined> }) =>
  req('/settings', { method: 'PUT', body: JSON.stringify(settings) })
