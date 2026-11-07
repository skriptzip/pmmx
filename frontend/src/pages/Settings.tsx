import { clearServerUrl, isNative } from '../api/server'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Radio } from 'lucide-react'
import { useState } from 'react'
import { getSettings, triggerScan, updateSettings } from '../api/client'
import { t } from '../i18n'

const STREAMING_OPTIONS = [
  { id: 'netflix', label: 'Netflix' },
  { id: 'disney_plus', label: 'Disney+' },
  { id: 'amazon_prime', label: 'Amazon Prime' },
  { id: 'apple_tv_plus', label: 'Apple TV+' },
  { id: 'hbo_max', label: 'Max (HBO)' },
  { id: 'paramount_plus', label: 'Paramount+' },
  { id: 'sky', label: 'Sky' },
  { id: 'joyn', label: 'Joyn' },
  { id: 'zdf_mediathek', label: 'ZDF Mediathek' },
  { id: 'ard_mediathek', label: 'ARD Mediathek' },
]

function SettingsInput({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

export function Settings({ onLogout }: { onLogout: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const [audioInput, setAudioInput] = useState('')
  const [subInput, setSubInput] = useState('')
  const [streamingRegion, setStreamingRegion] = useState<string | null>(null)
  const [notifProvider, setNotifProvider] = useState<string | null>(null)
  const [ntfyUrl, setNtfyUrl] = useState<string | null>(null)
  const [ntfyTopic, setNtfyTopic] = useState<string | null>(null)
  const [discordUrl, setDiscordUrl] = useState<string | null>(null)
  const [pushoverToken, setPushoverToken] = useState<string | null>(null)
  const [pushoverUser, setPushoverUser] = useState<string | null>(null)
  const [notifSaved, setNotifSaved] = useState(false)

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })

  if (isLoading || !data) return <div className="page" style={{ color: 'var(--muted)' }}>{t('common.loading')}</div>

  const provider = notifProvider ?? data.notification_provider
  const resolvedNtfyUrl = ntfyUrl ?? data.ntfy_url
  const resolvedNtfyTopic = ntfyTopic ?? data.ntfy_topic
  const resolvedDiscordUrl = discordUrl ?? data.discord_webhook_url
  const resolvedPushoverToken = pushoverToken ?? data.pushover_token
  const resolvedPushoverUser = pushoverUser ?? data.pushover_user

  const toggleService = (id: string) => {
    const current = data.owned_streaming_services
    const next = current.includes(id) ? current.filter(s => s !== id) : [...current, id]
    mutation.mutate({ owned_streaming_services: next })
  }

  const addLang = (type: 'audio' | 'sub') => {
    const val = (type === 'audio' ? audioInput : subInput).trim().toLowerCase().slice(0, 3)
    if (!val) return
    if (type === 'audio') {
      if (!data.audio_langs.includes(val)) mutation.mutate({ audio_langs: [...data.audio_langs, val] })
      setAudioInput('')
    } else {
      if (!data.subtitle_langs.includes(val)) mutation.mutate({ subtitle_langs: [...data.subtitle_langs, val] })
      setSubInput('')
    }
  }

  const removeLang = (type: 'audio' | 'sub', lang: string) => {
    if (type === 'audio') mutation.mutate({ audio_langs: data.audio_langs.filter(l => l !== lang) })
    else mutation.mutate({ subtitle_langs: data.subtitle_langs.filter(l => l !== lang) })
  }

  const saveNotifications = () => {
    mutation.mutate({
      notification_config: {
        provider: notifProvider ?? undefined,
        ntfy_url: ntfyUrl ?? undefined,
        ntfy_topic: ntfyTopic ?? undefined,
        discord_webhook_url: discordUrl ?? undefined,
        pushover_token: pushoverToken ?? undefined,
        pushover_user: pushoverUser ?? undefined,
      },
    })
    setNotifSaved(true)
    setTimeout(() => setNotifSaved(false), 2000)
  }

  return (
    <div className="page">
      <div className="page-head"><h1 className="page-title">{t('set.title')}</h1></div>

      <div className="settings-grid">
      {/* Languages */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>{t('set.audioLangs')}</div>
        <div style={{ marginBottom: 10 }}>
          {data.audio_langs.map(l => (
            <button key={l} className="lang-tag" style={{ cursor: 'pointer' }} onClick={() => removeLang('audio', l)}>
              {l} ×
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" value={audioInput} onChange={e => setAudioInput(e.target.value)}
            placeholder={t('set.langPlaceholder')} maxLength={3}
            onKeyDown={e => e.key === 'Enter' && addLang('audio')} />
          <button className="btn btn-ghost" style={{ whiteSpace: 'nowrap' }} onClick={() => addLang('audio')}>+</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>{t('set.subLangs')}</div>
        <div style={{ marginBottom: 10 }}>
          {data.subtitle_langs.map(l => (
            <button key={l} className="lang-tag" style={{ cursor: 'pointer' }} onClick={() => removeLang('sub', l)}>
              {l} ×
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" value={subInput} onChange={e => setSubInput(e.target.value)}
            placeholder={t('set.langPlaceholder')} maxLength={3}
            onKeyDown={e => e.key === 'Enter' && addLang('sub')} />
          <button className="btn btn-ghost" style={{ whiteSpace: 'nowrap' }} onClick={() => addLang('sub')}>+</button>
        </div>
      </div>

      {/* Streaming services */}
      <div className="card">
        <div className="card-title">{t('set.ownServices')}</div>
        <div className="card-hint">{t('set.ownServicesHint')}</div>
        <div className="field">
          <div className="field-label">{t('set.region')}</div>
          <div className="chip-row">
            {(['DE', 'GB', 'US'] as const).map(r => (
              <button
                key={r}
                className={`filter-chip${(streamingRegion ?? data.streaming_region) === r ? ' active' : ''}`}
                onClick={() => {
                  setStreamingRegion(r)
                  mutation.mutate({ streaming_region: r })
                }}
              >
                {r === 'DE' ? '🇩🇪 DE' : r === 'GB' ? '🇬🇧 GB' : '🇺🇸 US'}
              </button>
            ))}
          </div>
        </div>
        {STREAMING_OPTIONS.map(s => (
          <div key={s.id} className="toggle-row">
            <span>{s.label}</span>
            <button
              role="switch"
              aria-checked={data.owned_streaming_services.includes(s.id)}
              aria-label={s.label}
              className={`switch${data.owned_streaming_services.includes(s.id) ? ' on' : ''}`}
              onClick={() => toggleService(s.id)}
            />
          </div>
        ))}
      </div>

      {/* Notifications */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>{t('set.notifications')}</div>

        <div className="field">
          <div className="field-label">{t('set.provider')}</div>
          <div className="chip-row">
            {(['ntfy', 'discord', 'pushover', 'none'] as const).map(p => (
              <button
                key={p}
                className={`filter-chip${provider === p || (p === 'none' && !provider) ? ' active' : ''}`}
                style={{ fontSize: 12 }}
                onClick={() => setNotifProvider(p === 'none' ? '' : p)}
              >
                {p === 'none' ? t('set.off') : p}
              </button>
            ))}
          </div>
        </div>

        {provider === 'ntfy' && (
          <>
            <SettingsInput label={t('set.ntfyUrl')} value={resolvedNtfyUrl}
              onChange={setNtfyUrl} placeholder="https://ntfy.sh" />
            <SettingsInput label={t('set.topic')} value={resolvedNtfyTopic}
              onChange={setNtfyTopic} placeholder="plex-missing-media" />
          </>
        )}

        {provider === 'discord' && (
          <SettingsInput label={t('set.webhookUrl')} value={resolvedDiscordUrl}
            onChange={setDiscordUrl} placeholder="https://discord.com/api/webhooks/…" />
        )}

        {provider === 'pushover' && (
          <>
            <SettingsInput label={t('set.apiToken')} value={resolvedPushoverToken}
              onChange={setPushoverToken} placeholder={t('set.apiTokenPh')} type="password" />
            <SettingsInput label={t('set.userKey')} value={resolvedPushoverUser}
              onChange={setPushoverUser} placeholder={t('set.userKeyPh')} />
          </>
        )}

        <button
          className="btn btn-ghost"
          style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
          onClick={saveNotifications}
        >
          {notifSaved ? t('set.saved') : t('set.saveNotif')}
        </button>
      </div>

      {/* Actions */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>{t('set.actions')}</div>
        <div className="action-stack">
          <button className="btn btn-ghost" onClick={() => triggerScan('availability')}>
            <Radio size={14} /> {t('set.checkAvailability')}
          </button>
          {isNative && (
            <button className="btn btn-ghost"
              onClick={() => { onLogout(); clearServerUrl(); window.location.reload() }}>
              {t('set.changeServer')}
            </button>
          )}
          <button className="btn btn-ghost btn-danger" onClick={onLogout}>
            {t('set.logout')}
          </button>
        </div>
      </div>
      </div>

      <div style={{ marginTop: 24, padding: '16px 0', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer">
          <img
            src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
            alt="The Movie Database"
            style={{ height: 20, marginBottom: 6 }}
          />
        </a>
        <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
          This product uses the TMDB API but is not endorsed or certified by TMDB.
          Streaming availability data is sourced from TMDB Watch Providers.
        </p>
      </div>
    </div>
  )
}
