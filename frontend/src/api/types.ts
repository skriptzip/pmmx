export type Status = 'missing' | 'upcoming' | 'streamable'

export interface StreamingService {
  name: string
  provider_id: number
  logo_path: string | null
  type: 'flatrate' | 'rent' | 'buy'
  watch_link: string
}

export interface MissingMovie {
  id: number
  tmdb_id: number
  title: string
  year: number | null
  collection_id: number
  collection_name: string
  release_date: string | null
  status: Status
  streaming_services: StreamingService[]
  poster_path: string | null
  last_checked: string | null
}

export interface MissingEpisode {
  id: number
  show_tmdb_id: number
  show_title: string
  season_number: number
  episode_number: number
  episode_title: string
  air_date: string | null
  status: Status
  streaming_services: StreamingService[]
  last_checked: string | null
}

export interface MissingAudio {
  id: number
  plex_key: number
  title: string
  media_type: 'movie' | 'episode'
  missing_audio: string[]
  missing_subtitles: string[]
  last_checked: string | null
  plex_link: string | null
}

export interface ScanRun {
  id: number
  scan_type: 'full' | 'availability'
  started_at: string | null
  completed_at: string | null
  status: 'running' | 'completed' | 'failed'
  error: string | null
}

export interface LibraryMovie {
  id: number
  tmdb_id: number
  plex_key: number | null
  title: string
  year: number | null
  poster_path: string | null
  collection_id: number | null
  collection_name: string | null
  release_date: string | null
  status: 'present' | 'missing' | 'upcoming' | 'streamable'
  streaming_services: StreamingService[]
}

export interface LibraryShow {
  id: number
  tmdb_id: number
  plex_key: number | null
  title: string
  year: number | null
  poster_path: string | null
  episodes_total: number
  episodes_present: number
  missing_count: number
  status: 'complete' | 'incomplete'
}

export interface ScanProgress {
  stage: 'starting' | 'plex' | 'movies' | 'series' | 'audio' | 'availability' | 'done'
  movies_total: number
  movies_checked: number
  shows_total: number
  shows_checked: number
  current_item: string
  started_at: string
}

export interface UserSettings {
  audio_langs: string[]
  subtitle_langs: string[]
  owned_streaming_services: string[]
  streaming_region: string
  notification_provider: string
  ntfy_url: string
  ntfy_topic: string
  discord_webhook_url: string
  pushover_token: string
  pushover_user: string
}

export interface Me {
  id: number
  username: string
  email: string
  thumb: string
  server_name: string
}
