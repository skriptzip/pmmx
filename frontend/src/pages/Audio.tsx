import { useQuery } from '@tanstack/react-query'
import { Clapperboard, Headphones, Loader2, Tv } from 'lucide-react'
import { getMissingAudio } from '../api/client'
import { useProgressive } from '../hooks/useProgressive'
import { t } from '../i18n'

export function Audio() {
  const { data, isLoading } = useQuery({ queryKey: ['missing-audio'], queryFn: getMissingAudio })
  const items = data ?? []
  // Lange Listen schrittweise rendern, damit die Seite auf dem Handy nicht einfriert
  const { count, hasMore, sentinelRef } = useProgressive(items.length, 'audio', 40)

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{t('audio.title')}</h1>
      </div>

      {isLoading && <div className="loading-line">{t('common.loading')}</div>}

      {!isLoading && !items.length && (
        <div className="empty-state">
          <div className="icon"><Headphones size={48} /></div>
          <p>{t('audio.allPresent')}</p>
        </div>
      )}

      <div className="card-grid">
        {items.slice(0, count).map(item => (
          <div key={item.id} className="card audio-card">
            <div className="audio-title">{item.title}</div>
            {item.missing_audio.length > 0 && (
              <div className="audio-line">
                <span className="lbl">{t('audio.audioMissing')}</span>
                <span>{item.missing_audio.map(l => <span key={l} className="lang-tag missing">{l}</span>)}</span>
              </div>
            )}
            {item.missing_subtitles.length > 0 && (
              <div className="audio-line">
                <span className="lbl">{t('audio.subsMissing')}</span>
                <span>{item.missing_subtitles.map(l => <span key={l} className="lang-tag missing">{l}</span>)}</span>
              </div>
            )}
            <div className="row" style={{ marginTop: 2 }}>
              <span style={{ color: 'var(--muted)', display: 'flex' }}>
                {item.media_type === 'movie' ? <Clapperboard size={14} /> : <Tv size={14} />}
              </span>
              {item.plex_link && (
                <a href={item.plex_link} target="_blank" rel="noreferrer" className="streaming-chip">
                  {t('audio.openPlex')}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && <div ref={sentinelRef} className="load-more"><Loader2 size={16} className="icon-spin" /></div>}
    </div>
  )
}
