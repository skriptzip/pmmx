import type { StreamingService } from '../api/types'
import { t } from '../i18n'

const TMDB_LOGO = 'https://image.tmdb.org/t/p/w92'

export const TYPE_LABEL: Record<StreamingService['type'], string> = {
  flatrate: t('type.flatrate'),
  rent: t('type.rent'),
  buy: t('type.buy'),
}

const TYPE_ORDER: StreamingService['type'][] = ['flatrate', 'rent', 'buy']

export function ProviderLogos({ services }: { services: StreamingService[] }) {
  if (!services.length) return null
  const sorted = [...services].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))
  return (
    <div className="provider-logos">
      {sorted.map(s => (
        <a
          key={s.provider_id}
          className={`provider-logo-chip ${s.type}`}
          href={s.watch_link || undefined}
          target="_blank"
          rel="noopener noreferrer"
          title={`${s.name} (${TYPE_LABEL[s.type]})`}
        >
          {s.logo_path ? (
            <img src={`${TMDB_LOGO}${s.logo_path}`} alt={s.name} loading="lazy" />
          ) : (
            <span>{s.name.slice(0, 2)}</span>
          )}
        </a>
      ))}
    </div>
  )
}

const POSTER_MAX = 3

export function PosterProviders({ services }: { services: StreamingService[] }) {
  if (!services.length) return null
  const sorted = [...services].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))
  const shown = sorted.slice(0, POSTER_MAX)
  const rest = sorted.length - shown.length
  return (
    <div className="poster-logos">
      {shown.map(s => (
        <span key={s.provider_id} className={`provider-logo-chip small ${s.type}`} title={`${s.name} (${TYPE_LABEL[s.type]})`}>
          {s.logo_path ? <img src={`${TMDB_LOGO}${s.logo_path}`} alt={s.name} loading="lazy" /> : <span>{s.name.slice(0, 2)}</span>}
        </span>
      ))}
      {rest > 0 && <span className="poster-logos-more">+{rest}</span>}
    </div>
  )
}

export function ProviderLegend() {
  return (
    <div className="provider-legend">
      {TYPE_ORDER.map(t => (
        <span key={t} className={`provider-type-label ${t}`}>{TYPE_LABEL[t]}</span>
      ))}
    </div>
  )
}
