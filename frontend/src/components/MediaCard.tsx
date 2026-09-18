import { motion } from 'framer-motion'
import { Play } from 'lucide-react'
import type { MissingEpisode, MissingMovie } from '../api/types'
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
            {movie.release_date ? ` · ${new Date(movie.release_date).toLocaleDateString('de-DE')}` : ''}
          </div>
          {movie.streaming_services.length > 0 && (
            <div style={{ marginTop: 6 }}>
              {movie.streaming_services.map(s => (
                <span key={s.provider_id} className="streaming-chip"><Play size={10} fill="currentColor" /> {s.name}</span>
              ))}
            </div>
          )}
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
              {new Date(episode.air_date).toLocaleDateString('de-DE')}
            </div>
          )}
          {episode.streaming_services.length > 0 && (
            <div style={{ marginTop: 6 }}>
              {episode.streaming_services.map(s => (
                <span key={s.provider_id} className="streaming-chip"><Play size={10} fill="currentColor" /> {s.name}</span>
              ))}
            </div>
          )}
        </div>
        <StatusBadge status={episode.status} />
      </div>
    </motion.div>
  )
}
