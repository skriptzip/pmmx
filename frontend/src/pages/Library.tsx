import { AnimatePresence, motion } from 'framer-motion'
import { Clapperboard, ExternalLink, Film, RefreshCw, Search, Tv, X } from 'lucide-react'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getLibraryMovies, getLibraryShows, getMissingEpisodes, refreshShow } from '../api/client'
import type { LibraryMovie, LibraryShow, MissingEpisode, StreamingService } from '../api/types'
import { PosterProviders, ProviderLogos, TYPE_LABEL } from '../components/ProviderLogos'
import { locale, t } from '../i18n'

const TMDB_IMG = 'https://image.tmdb.org/t/p/w300'
const TMDB_LOGO = 'https://image.tmdb.org/t/p/w45'

type MovieFilter = 'all' | 'present' | 'missing' | 'upcoming' | 'streamable'
type ShowFilter  = 'all' | 'complete' | 'incomplete' | 'upcoming' | 'streamable'

const MOVIE_FILTERS: { label: string; value: MovieFilter }[] = [
  { label: t('common.everything'), value: 'all' },
  { label: t('common.present'), value: 'present' },
  { label: t('common.missing'), value: 'missing' },
  { label: t('common.soon'), value: 'upcoming' },
  { label: t('common.available'), value: 'streamable' },
]

const SHOW_FILTERS: { label: string; value: ShowFilter }[] = [
  { label: t('common.everything'), value: 'all' },
  { label: t('lib.complete'), value: 'complete' },
  { label: t('lib.incomplete'), value: 'incomplete' },
  { label: t('common.soon'), value: 'upcoming' },
  { label: t('common.available'), value: 'streamable' },
]

const pad = (n: number) => String(n).padStart(2, '0')

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
      {(movie.status === 'missing' || movie.status === 'upcoming') && (
        <div className={`poster-badge ${movie.status}`}>
          {movie.status === 'missing' ? t('common.missing') : t('common.soon')}
        </div>
      )}
      <PosterProviders services={movie.streaming_services} />
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
              {movie.status === 'missing' ? t('common.missing') : movie.status === 'upcoming' ? t('common.soon') : movie.status === 'streamable' ? t('common.available') : t('common.present')}
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
              {t('lib.noStreaming')}
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
  const pureMissing = Math.max(0, show.missing_count - show.upcoming_count - show.streamable_count)
  const overlay = pureMissing > 0 ? 'missing' : show.streamable_count > 0 ? 'streamable' : 'upcoming'

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="poster-item clickable" onClick={onClick}>
        {hasPoster ? (
          <img src={`${TMDB_IMG}${show.poster_path}`} alt={show.title} loading="lazy"
            onError={() => setImgErr(true)} />
        ) : (
          <div className="poster-placeholder">{show.title}</div>
        )}
        {show.status === 'incomplete' && <div className={`poster-overlay ${overlay}`} />}
        {(pureMissing > 0 || show.upcoming_count > 0) && (
          <div className="poster-badges">
            {pureMissing > 0 && <div className="poster-badge missing">{t('lib.nMissing', { n: pureMissing })}</div>}
            {show.upcoming_count > 0 && <div className="poster-badge upcoming">{t('lib.nSoon', { n: show.upcoming_count })}</div>}
          </div>
        )}
        <PosterProviders services={show.streaming_services} />
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
      <div className="collection-head">
        <span className="section-header" style={{ margin: 0 }}>{name} ({movies.length})</span>
        {missing > 0 && <span className="badge badge-missing">{t('lib.nMissing', { n: missing })}</span>}
      </div>
      <div className="poster-grid">
        {movies.map(m => <PosterItem key={m.id} movie={m} onClick={() => onSelect(m)} />)}
      </div>
    </div>
  )
}

// ─── Show detail panel ────────────────────────────────────────────────────────

function ShowDetailPanel({ show, onClose, onUpdated }: {
  show: LibraryShow
  onClose: () => void
  onUpdated: (show: LibraryShow) => void
}) {
  const [imgErr, setImgErr] = useState(false)
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768
  const queryClient = useQueryClient()

  // Liest nur diese Serie neu aus Plex, ohne vollständigen Scan
  const refresh = useMutation({
    mutationFn: () => refreshShow(show.tmdb_id),
    onSuccess: updated => {
      onUpdated(updated)
      queryClient.invalidateQueries({ queryKey: ['library-shows'] })
      queryClient.invalidateQueries({ queryKey: ['show-missing-episodes', show.tmdb_id] })
      queryClient.invalidateQueries({ queryKey: ['missing-episodes'] })
      queryClient.invalidateQueries({ queryKey: ['missing-audio'] })
    },
  })

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
              {t('lib.episodesPresent', { a: show.episodes_present, b: show.episodes_total })}
            </div>
            {show.missing_count > 0
              ? <span className="badge badge-missing">{t('lib.nMissingPl', { n: show.missing_count })}</span>
              : <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>{t('lib.completeCheck')}</span>
            }
            <div style={{ marginTop: 8 }}>
              <button onClick={() => refresh.mutate()} disabled={refresh.isPending}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600 }}>
                <RefreshCw size={13} className={refresh.isPending ? 'icon-spin' : undefined} />
                {refresh.isPending ? t('lib.checking') : t('lib.refresh')}
              </button>
              {refresh.isError && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                  {t('lib.refreshFailed')}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', padding: '2px 0 0 8px', display: 'flex', alignSelf: 'flex-start' }}>
            <X size={20} />
          </button>
        </div>

        {show.streaming_services.length > 0 && (
          <div style={{ padding: '0 16px 8px' }}>
            <div className="season-header">
              {t('lib.availableAt')}{show.streamable_count > 0 ? t('lib.nEpisodes', { n: show.streamable_count }) : ''}
            </div>
            <ProviderLogos services={show.streaming_services} />
          </div>
        )}

        {/* Season / episode list */}
        <div style={{ padding: '0 16px' }}>
          {isLoading && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 24 }}>{t('common.loading')}</div>
          )}

          {!isLoading && episodes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)', fontSize: 14 }}>
              {t('lib.noMissingEpisodes')}
            </div>
          )}

          {sortedSeasons.map(([season, eps]) => (
            <div key={season} style={{ marginBottom: 8 }}>
              <div className="season-header">{t('lib.season', { n: season })}</div>
              {[...eps]
                .sort((a, b) => a.episode_number - b.episode_number)
                .map(ep => (
                  <div key={ep.id} className="ep-row">
                    <span className="ep-code">S{pad(ep.season_number)}E{pad(ep.episode_number)}</span>
                    <span className="ep-title">{ep.episode_title || '–'}</span>
                    <span className={`badge badge-${ep.status}`} style={{ flexShrink: 0 }}>
                      {ep.status === 'missing' ? t('common.missing') : ep.status === 'upcoming' ? t('common.soon') : t('common.available')}
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

  // Kollektionen mit nur einem Film landen im gemeinsamen Raster, sonst gibt es viele Mini-Abschnitte
  const collections = Object.entries(movieGroups).filter(([k, ms]) => k !== '—' && ms.length > 1)
  const standalone = Object.entries(movieGroups)
    .filter(([k, ms]) => k === '—' || ms.length <= 1)
    .flatMap(([, ms]) => ms)
    .sort((a, b) => a.title.localeCompare(b.title, locale))

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>{t('lib.title')}</h1>
        <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', padding: 2, gap: 2 }}>
          {(['movies', 'shows'] as const).map(tabId => (
            <button key={tabId} onClick={() => setTab(tabId)} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 600,
              background: tab === tabId ? 'var(--accent)' : 'transparent',
              color: tab === tabId ? '#000' : 'var(--muted)',
              transition: 'all .15s',
            }}>
              {tabId === 'movies'
            ? <><Film size={14} style={{ flexShrink: 0 }} /> {t('common.movies')}</>
            : <><Tv size={14} style={{ flexShrink: 0 }} /> {t('common.series')}</>}
            </button>
          ))}
        </div>
      </div>

      <div className="sticky-bar">
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <input type="text"
          placeholder={tab === 'movies' ? t('lib.searchMovie') : t('lib.searchShow')}
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

      {tab === 'movies' ? (
        <div className="filter-row">
          {MOVIE_FILTERS.map(f => (
            <button key={f.value} className={`filter-chip${movieFilter === f.value ? ' active' : ''}`}
              onClick={() => setMovieFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="filter-row">
          {SHOW_FILTERS.map(f => (
            <button key={f.value} className={`filter-chip${showFilter === f.value ? ' active' : ''}`}
              onClick={() => setShowFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
      )}
      </div>

      {/* Movies tab */}
      {tab === 'movies' && (
        <>

          {moviesQ.isLoading && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 48 }}>{t('common.loading')}</div>
          )}
          {!moviesQ.isLoading && filteredMovies.length === 0 && (
            <div className="empty-state">
              <div className="icon"><Clapperboard size={48} /></div>
              <p>{t('lib.noMovies1')}<br />{t('lib.scanHint')}</p>
            </div>
          )}

          {collections.map(([name, movies]) => (
            <motion.div key={name} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <CollectionSection name={name} movies={movies} onSelect={setSelectedMovie} />
            </motion.div>
          ))}

          {standalone.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {collections.length > 0 && (
                <div className="section-header" style={{ marginTop: 24 }}>
                  {t('lib.moreMovies', { n: standalone.length })}
                </div>
              )}
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
          {showsQ.isLoading && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 48 }}>{t('common.loading')}</div>
          )}
          {!showsQ.isLoading && filteredShows.length === 0 && (
            <div className="empty-state">
              <div className="icon"><Tv size={48} /></div>
              <p>{t('lib.noShows1')}<br />{t('lib.scanHint')}</p>
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
          <ShowDetailPanel show={selectedShow} onClose={() => setSelectedShow(null)} onUpdated={setSelectedShow} />
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
