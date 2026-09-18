import { useQuery } from '@tanstack/react-query'
import { Clapperboard, Tv } from 'lucide-react'
import { useState } from 'react'
import { getMissingEpisodes, getMissingMovies } from '../api/client'
import type { Status } from '../api/types'
import { EpisodeCard, MovieCard } from '../components/MediaCard'

type MediaTab = 'movies' | 'series'

const FILTERS: { label: string; value: Status | 'all' }[] = [
  { label: 'Alle', value: 'all' },
  { label: 'Fehlt', value: 'missing' },
  { label: 'Bald', value: 'upcoming' },
  { label: 'Streambar', value: 'streamable' },
]

export function Movies() {
  const [mediaTab, setMediaTab] = useState<MediaTab>('movies')
  const [filter, setFilter] = useState<Status | 'all'>('all')

  const moviesQ = useQuery({
    queryKey: ['missing-movies', filter],
    queryFn: () => getMissingMovies(filter),
    enabled: mediaTab === 'movies',
  })
  const seriesQ = useQuery({
    queryKey: ['missing-episodes', filter],
    queryFn: () => getMissingEpisodes(filter),
    enabled: mediaTab === 'series',
  })

  const groupedMovies = (moviesQ.data ?? []).reduce<Record<string, typeof moviesQ.data>>((acc, m) => {
    const key = m.collection_name || 'Sonstige'
    acc[key] = [...(acc[key] ?? []), m]
    return acc
  }, {})

  const groupedSeries = (seriesQ.data ?? []).reduce<Record<string, typeof seriesQ.data>>((acc, ep) => {
    acc[ep.show_title] = [...(acc[ep.show_title] ?? []), ep]
    return acc
  }, {})

  const isLoading = mediaTab === 'movies' ? moviesQ.isLoading : seriesQ.isLoading
  const isEmpty = mediaTab === 'movies' ? !moviesQ.data?.length : !seriesQ.data?.length

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Fehlend</h1>
        <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', padding: 2, gap: 2 }}>
          {(['movies', 'series'] as const).map(t => (
            <button
              key={t}
              onClick={() => setMediaTab(t)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                background: mediaTab === t ? 'var(--accent)' : 'transparent',
                color: mediaTab === t ? '#000' : 'var(--muted)',
                transition: 'all .15s',
              }}
            >
              {t === 'movies' ? <Clapperboard size={15} /> : <Tv size={15} />}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-row">
        {FILTERS.map(f => (
          <button
            key={f.value}
            className={`filter-chip${filter === f.value ? ' active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 32 }}>Lädt…</div>}

      {!isLoading && isEmpty && (
        <div className="empty-state">
          <div className="icon">{mediaTab === 'movies' ? <Clapperboard size={48} /> : <Tv size={48} />}</div>
          <p>Nichts gefunden.</p>
        </div>
      )}

      {mediaTab === 'movies' && Object.entries(groupedMovies).map(([collection, movies]) => (
        <div key={collection}>
          <div className="section-header">{collection}</div>
          {movies!.map(m => <MovieCard key={m.id} movie={m} />)}
        </div>
      ))}

      {mediaTab === 'series' && Object.entries(groupedSeries).map(([show, episodes]) => (
        <div key={show}>
          <div className="section-header">{show} ({episodes!.length})</div>
          {episodes!.map(ep => <EpisodeCard key={ep.id} episode={ep} />)}
        </div>
      ))}
    </div>
  )
}
