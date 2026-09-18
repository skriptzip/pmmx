import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Clapperboard, Headphones, Tv } from 'lucide-react'
import { getMissingAudio } from '../api/client'

export function Audio() {
  const { data, isLoading } = useQuery({ queryKey: ['missing-audio'], queryFn: getMissingAudio })

  return (
    <div className="page">
      <h1 className="page-title">Fehlende Sprachspuren</h1>

      {isLoading && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 32 }}>Lädt…</div>}

      {!isLoading && !data?.length && (
        <div className="empty-state">
          <div className="icon"><Headphones size={48} /></div>
          <p>Alle konfigurierten Sprachen sind vorhanden.</p>
        </div>
      )}

      {data?.map(item => (
        <motion.div
          key={item.id}
          className="card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{item.title}</div>
          {item.missing_audio.length > 0 && (
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 8 }}>Audio fehlt:</span>
              {item.missing_audio.map(l => (
                <span key={l} className="lang-tag missing">{l}</span>
              ))}
            </div>
          )}
          {item.missing_subtitles.length > 0 && (
            <div>
              <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 8 }}>Untertitel fehlt:</span>
              {item.missing_subtitles.map(l => (
                <span key={l} className="lang-tag missing">{l}</span>
              ))}
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {item.media_type === 'movie' ? <Clapperboard size={13} /> : <Tv size={13} />}
            </span>
            {item.plex_link ? (
              <a href={item.plex_link} target="_blank" rel="noreferrer" className="streaming-chip" style={{ fontSize: 11 }}>
                In Plex öffnen
              </a>
            ) : null}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
