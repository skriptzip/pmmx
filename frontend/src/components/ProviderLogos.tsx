import type { StreamingService } from '../api/types'

const TMDB_LOGO = 'https://image.tmdb.org/t/p/w92'

export const TYPE_LABEL: Record<StreamingService['type'], string> = {
  flatrate: 'Abo',
  rent: 'Leihen',
  buy: 'Kaufen',
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

export function ProviderLegend() {
  return (
    <div className="provider-legend">
      {TYPE_ORDER.map(t => (
        <span key={t} className={`provider-type-label ${t}`}>{TYPE_LABEL[t]}</span>
      ))}
    </div>
  )
}
