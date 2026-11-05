import { motion } from 'framer-motion'
import type { MissingEpisode, MissingMovie } from '../api/types'
import { dateLocale } from '../i18n'
import { ProviderLogos } from './ProviderLogos'
import { StatusBadge } from './StatusBadge'

export function MovieCard({ movie }: { movie: MissingMovie }) {
  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {movie.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {movie.collection_name}{movie.year ? ` · ${movie.year}` : ''}
            {movie.release_date ? ` · ${new Date(movie.release_date).toLocaleDateString(dateLocale)}` : ''}
          </div>
          <ProviderLogos services={movie.streaming_services} />
        </div>
        <StatusBadge status={movie.status} />
      </div>
    </motion.div>
  )
}

export function EpisodeCard({ episode }: { episode: MissingEpisode }) {
  const epLabel = `S${String(episode.season_number).padStart(2, '0')}E${String(episode.episode_number).padStart(2, '0')}`
  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{episode.show_title}</div>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            {epLabel}{episode.episode_title ? ` – ${episode.episode_title}` : ''}
          </div>
          {episode.air_date && (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {new Date(episode.air_date).toLocaleDateString(dateLocale)}
            </div>
          )}
          <ProviderLogos services={episode.streaming_services} />
        </div>
        <StatusBadge status={episode.status} />
      </div>
    </motion.div>
  )
}
