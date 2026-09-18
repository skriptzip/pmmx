import { AnimatePresence, motion } from 'framer-motion'
import { Clapperboard, ExternalLink, Film, Search, Tv, X } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getLibraryMovies, getLibraryShows, getMissingEpisodes } from '../api/client'
import type { LibraryMovie, LibraryShow, MissingEpisode, StreamingService } from '../api/types'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w300'
const TMDB_LOGO = 'https://image.tmdb.org/t/p/w45'

type MovieFilter = 'all' | 'present' | 'missing' | 'upcoming' | 'streamable'
type ShowFilter  = 'all' | 'complete' | 'incomplete'

const MOVIE_FILTERS: { label: string; value: MovieFilter }[] = [
  { label: 'Alles', value: 'all' },
  { label: 'Vorhanden', value: 'present' },
  { label: 'Fehlt', value: 'missing' },
  { label: 'Bald', value: 'upcoming' },
  { label: 'Streambar', value: 'streamable' },
]

const SHOW_FILTERS: { label: string; value: ShowFilter }[] = [
  { label: 'Alles', value: 'all' },
  { label: 'Komplett', value: 'complete' },
  { label: 'Unvollständig', value: 'incomplete' },
]

const pad = (n: number) => String(n).padStart(2, '0')

// ─── Provider type helpers ───────────────────────────────────────────────────

const TYPE_LABEL: Record<StreamingService['type'], string> = {
  flatrate: 'Abo',
  rent: 'Leihen',
  buy: 'Kaufen',
}

// ─── Movie poster ────────────────────────────────────────────────────────────

function PosterItem({ movie, onClick }: { movie: LibraryMovie; onClick: () => void }) {
  const [imgErr, setImgErr] = useState(false)
  const hasPoster = movie.poster_path && !imgErr

  return (
    <div className="poster-item clickable" onClick={onClick}>
      {hasPoster ? (
        <img src={`${TMDB_IMG}${movie.poster_path}`} alt={movie.title} loading="lazy"
          onError={() => setImgErr(true)} />
      ) : (
        <div className="poster-placeholder">{movie.title}</div>
      )}
      {movie.status !== 'present' && <div className={`poster-overlay ${movie.status}`} />}
      {movie.status !== 'present' && (
        <div className={`poster-badge ${movie.status}`}>
          {movie.status === 'missing' ? 'Fehlt' : movie.status === 'upcoming' ? 'Bald' : 'Stream'}
        </div>
      )}
      <div className="poster-title-bar">
        {movie.title}{movie.year ? ` (${movie.year})` : ''}
      </div>
    </div>
  )
}

// ─── Movie detail panel ──────────────────────────────────────────────────────

function MovieDetailPanel({ movie, onClose }: { movie: LibraryMovie; onClose: () => void }) {
  const [imgErr, setImgErr] = useState(false)
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768

  const grouped = movie.streaming_services.reduce<Record<string, StreamingService[]>>((acc, s) => {
    acc[s.type] = [...(acc[s.type] ?? []), s]
    return acc
  }, {})
  const typeOrder: StreamingService['type'][] = ['flatrate', 'rent', 'buy']

  return (
    <>
      <motion.div
        className="detail-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="detail-panel"
        initial={isDesktop ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
        animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
        exit={isDesktop ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="detail-panel-handle" />

        {/* Header */}
        <div className="detail-panel-header">
          {movie.poster_path && !imgErr ? (
            <img className="detail-panel-poster" src={`${TMDB_IMG}${movie.poster_path}`}
              alt={movie.title} onError={() => setImgErr(true)} />
          ) : (
            <div className="detail-panel-poster"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--muted)', padding: 8, borderRadius: 6, background: 'var(--surface)' }}>
              {movie.title}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.3, marginBottom: 4 }}>
              {movie.title}{movie.year ? ` (${movie.year})` : ''}
            </div>
            {movie.collection_name && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                {movie.collection_name}
              </div>
            )}
            <span className={`badge badge-${movie.status}`}>
              {movie.status === 'missing' ? 'Fehlt' : movie.status === 'upcoming' ? 'Bald' : movie.status === 'streamable' ? 'Streambar' : 'Vorhanden'}
            </span>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', padding: '2px 0 0 8px', display: 'flex', alignSelf: 'flex-start' }}>
            <X size={20} />
          </button>
        </div>

        {/* Provider list */}
        <div style={{ padding: '0 16px 8px' }}>
          {movie.streaming_services.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)', fontSize: 14 }}>
              Keine Streaming-Angebote verfügbar.
            </div>
          ) : (
            typeOrder.map(type => {
              const list = grouped[type]
              if (!list?.length) return null
              return (
                <div key={type}>
                  <div className="season-header">{TYPE_LABEL[type]}</div>
                  {list.map(s => (
                    <a
                      key={s.provider_id}
                      href={s.watch_link || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="provider-row"
                      onClick={e => !s.watch_link && e.preventDefault()}
                    >
                      {s.logo_path ? (
                        <img className="provider-logo"
                          src={`${TMDB_LOGO}${s.logo_path}`}
                          alt={s.name} />
                      ) : (
                        <div className="provider-logo"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--muted)' }}>
                          ?
                        </div>
                      )}
                      <span className="provider-name">{s.name}</span>
                      <span className={`provider-type-label ${type}`}>{TYPE_LABEL[type]}</span>
                      <ExternalLink size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
                    </a>
                  ))}
                </div>
              )
            })
          )}
        </div>
      </motion.div>
    </>
  )
}

// ─── Show poster ─────────────────────────────────────────────────────────────

function ShowPosterItem({ show, onClick }: { show: LibraryShow; onClick: () => void }) {
  const [imgErr, setImgErr] = useState(false)
  const hasPoster = show.poster_path && !imgErr
  const pct = show.episodes_total > 0
    ? (show.episodes_present / show.episodes_total) * 100
    : 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="poster-item clickable" onClick={onClick}>
        {hasPoster ? (
          <img src={`${TMDB_IMG}${show.poster_path}`} alt={show.title} loading="lazy"
            onError={() => setImgErr(true)} />
        ) : (
          <div className="poster-placeholder">{show.title}</div>
        )}
        {show.status === 'incomplete' && <div className="poster-overlay incomplete" />}
        {show.status === 'incomplete' && show.missing_count > 0 && (
          <div className="poster-badge incomplete">{show.missing_count} fehlt</div>
        )}
        <div className="poster-title-bar">
          {show.title}{show.year ? ` (${show.year})` : ''}
        </div>
      </div>
      {show.status === 'incomplete' && (
        <div className="episode-bar" style={{ marginTop: 4 }}>
          <div className="episode-bar-fill incomplete" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

// ─── Collection section ───────────────────────────────────────────────────────

function CollectionSection({ name, movies, onSelect }: {
  name: string
  movies: LibraryMovie[]
  onSelect: (m: LibraryMovie) => void
}) {
  const missing = movies.filter(m => m.status !== 'present').length
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '20px 0 8px' }}>
        <span className="section-header" style={{ margin: 0 }}>{name}</span>
        {missing > 0 && <span className="badge badge-missing">{missing} fehlt</span>}
      </div>
      <div className="poster-grid">
        {movies.map(m => <PosterItem key={m.id} movie={m} onClick={() => onSelect(m)} />)}
      </div>
    </div>
  )
}

// ─── Show detail panel ────────────────────────────────────────────────────────

function ShowDetailPanel({ show, onClose }: { show: LibraryShow; onClose: () => void }) {
  const [imgErr, setImgErr] = useState(false)
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768

  const { data: episodes = [], isLoading } = useQuery({
    queryKey: ['show-missing-episodes', show.tmdb_id],
    queryFn: () => getMissingEpisodes('all', show.tmdb_id),
  })

  const seasons = episodes.reduce<Record<number, MissingEpisode[]>>((acc, ep) => {
    acc[ep.season_number] = [...(acc[ep.season_number] ?? []), ep]
    return acc
  }, {})
  const sortedSeasons = Object.entries(seasons)
    .sort(([a], [b]) => Number(a) - Number(b))

  return (
    <>
      <motion.div
        className="detail-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="detail-panel"
        initial={isDesktop ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
        animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
        exit={isDesktop ? { opacity: 0, scale: 0.96 } : { y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      >
        <div className="detail-panel-handle" />

        {/* Header */}
        <div className="detail-panel-header">
          {show.poster_path && !imgErr ? (
            <img className="detail-panel-poster" src={`${TMDB_IMG}${show.poster_path}`}
              alt={show.title} onError={() => setImgErr(true)} />
          ) : (
            <div className="detail-panel-poster"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--muted)', padding: 8, borderRadius: 6, background: 'var(--surface)' }}>
              {show.title}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.3, marginBottom: 6 }}>
              {show.title}{show.year ? ` (${show.year})` : ''}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>
              {show.episodes_present} / {show.episodes_total} Episoden vorhanden
            </div>
            {show.missing_count > 0
              ? <span className="badge badge-missing">{show.missing_count} fehlend</span>
              : <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>✓ Komplett</span>
            }
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', padding: '2px 0 0 8px', display: 'flex', alignSelf: 'flex-start' }}>
            <X size={20} />
          </button>
        </div>

        {/* Season / episode list */}
        <div style={{ padding: '0 16px' }}>
          {isLoading && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 24 }}>Lädt…</div>
          )}

          {!isLoading && episodes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)', fontSize: 14 }}>
              Keine fehlenden Episoden — Serie ist vollständig vorhanden.
            </div>
          )}

          {sortedSeasons.map(([season, eps]) => (
            <div key={season} style={{ marginBottom: 8 }}>
              <div className="season-header">Staffel {season}</div>
              {[...eps]
                .sort((a, b) => a.episode_number - b.episode_number)
                .map(ep => (
                  <div key={ep.id} className="ep-row">
                    <span className="ep-code">S{pad(ep.season_number)}E{pad(ep.episode_number)}</span>
                    <span className="ep-title">{ep.episode_title || '–'}</span>
                    <span className={`badge badge-${ep.status}`} style={{ flexShrink: 0 }}>
                      {ep.status === 'missing' ? 'Fehlt' : ep.status === 'upcoming' ? 'Bald' : 'Stream'}
                    </span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </motion.div>
    </>
  )
}

// ─── Library page ─────────────────────────────────────────────────────────────

export function Library() {
  const [tab, setTab] = useState<'movies' | 'shows'>('movies')
  const [movieFilter, setMovieFilter] = useState<MovieFilter>('all')
  const [showFilter, setShowFilter] = useState<ShowFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedShow, setSelectedShow] = useState<LibraryShow | null>(null)
  const [selectedMovie, setSelectedMovie] = useState<LibraryMovie | null>(null)

  const moviesQ = useQuery({
    queryKey: ['library-movies', movieFilter],
    queryFn: () => getLibraryMovies(movieFilter),
    enabled: tab === 'movies',
  })

  const showsQ = useQuery({
    queryKey: ['library-shows', showFilter],
    queryFn: () => getLibraryShows(showFilter),
    enabled: tab === 'shows',
  })

  const q = search.trim().toLowerCase()
  const filteredMovies = (moviesQ.data ?? []).filter(m =>
    !q || m.title.toLowerCase().includes(q) || (m.collection_name ?? '').toLowerCase().includes(q)
  )
  const filteredShows = (showsQ.data ?? []).filter(s =>
    !q || s.title.toLowerCase().includes(q)
  )

  const movieGroups = filteredMovies.reduce<Record<string, LibraryMovie[]>>((acc, m) => {
    const key = m.collection_name ?? '—'
    acc[key] = [...(acc[key] ?? []), m]
    return acc
  }, {})

  const standalone   = movieGroups['—'] ?? []
  const collections  = Object.entries(movieGroups).filter(([k]) => k !== '—')

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Bibliothek</h1>
        <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', padding: 2, gap: 2 }}>
          {(['movies', 'shows'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600,
              background: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? '#000' : 'var(--muted)',
              transition: 'all .15s',
            }}>
              {t === 'movies'
            ? <><Film size={14} style={{ flexShrink: 0 }} /> Filme</>
            : <><Tv size={14} style={{ flexShrink: 0 }} /> Serien</>}
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <input type="text"
          placeholder={tab === 'movies' ? 'Film oder Kollektion suchen…' : 'Serie suchen…'}
          value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none', display: 'flex' }}>
          <Search size={15} />
        </span>
        {search && (
          <button onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', padding: '0 4px', display: 'flex' }}>
            <X size={15} />
          </button>
        )}
      </div>

      {/* Movies tab */}
      {tab === 'movies' && (
        <>
          <div className="filter-row">
            {MOVIE_FILTERS.map(f => (
              <button key={f.value} className={`filter-chip${movieFilter === f.value ? ' active' : ''}`}
                onClick={() => setMovieFilter(f.value)}>
                {f.label}
              </button>
            ))}
          </div>

          {moviesQ.isLoading && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 48 }}>Lädt…</div>
          )}
          {!moviesQ.isLoading && filteredMovies.length === 0 && (
            <div className="empty-state">
              <div className="icon"><Clapperboard size={48} /></div>
              <p>Noch keine Filmbibliothek vorhanden.<br />Starte einen Scan um die Bibliothek zu laden.</p>
            </div>
          )}

          {collections.map(([name, movies]) => (
            <motion.div key={name} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <CollectionSection name={name} movies={movies} onSelect={setSelectedMovie} />
            </motion.div>
          ))}

          {standalone.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="section-header" style={{ marginTop: collections.length ? 20 : 0 }}>
                Einzelfilme ({standalone.length})
              </div>
              <div className="poster-grid">
                {standalone.map(m => <PosterItem key={m.id} movie={m} onClick={() => setSelectedMovie(m)} />)}
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Shows tab */}
      {tab === 'shows' && (
        <>
          <div className="filter-row">
            {SHOW_FILTERS.map(f => (
              <button key={f.value} className={`filter-chip${showFilter === f.value ? ' active' : ''}`}
                onClick={() => setShowFilter(f.value)}>
                {f.label}
              </button>
            ))}
          </div>

          {showsQ.isLoading && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 48 }}>Lädt…</div>
          )}
          {!showsQ.isLoading && filteredShows.length === 0 && (
            <div className="empty-state">
              <div className="icon"><Tv size={48} /></div>
              <p>Noch keine Serien vorhanden.<br />Starte einen Scan um die Bibliothek zu laden.</p>
            </div>
          )}
          {!showsQ.isLoading && filteredShows.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="poster-grid">
                {filteredShows.map(s => (
                  <ShowPosterItem key={s.id} show={s} onClick={() => setSelectedShow(s)} />
                ))}
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Show detail panel */}
      <AnimatePresence>
        {selectedShow && (
          <ShowDetailPanel show={selectedShow} onClose={() => setSelectedShow(null)} />
        )}
      </AnimatePresence>

      {/* Movie detail panel */}
      <AnimatePresence>
        {selectedMovie && (
          <MovieDetailPanel movie={selectedMovie} onClose={() => setSelectedMovie(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
