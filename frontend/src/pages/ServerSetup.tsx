import { motion } from 'framer-motion'
import { Server } from 'lucide-react'
import { useState } from 'react'
import { checkServer, normalizeServerUrl, setServerUrl } from '../api/server'
import { t } from '../i18n'

export function ServerSetup({ onDone }: { onDone: () => void }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!value.trim()) return
    setBusy(true)
    setError('')
    const url = normalizeServerUrl(value)
    if (await checkServer(url)) {
      setServerUrl(url)
      onDone()
    } else {
      setError(t('setup.errUnreachable'))
    }
    setBusy(false)
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          width: '100%', maxWidth: 360, background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 16, padding: 32, textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: 12, color: 'var(--accent)' }}><Server size={48} /></div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>{t('setup.title')}</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>{t('setup.hint')}</p>
        <input
          type="url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="https://pmmx.example.com"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          style={{
            width: '100%', padding: '10px 12px', marginBottom: 12, borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg)', color: 'inherit', fontSize: 15,
          }}
        />
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
          disabled={busy || !value.trim()} onClick={submit}>
          {busy ? t('setup.checking') : t('setup.connect')}
        </button>
        {error && <p style={{ marginTop: 16, color: 'var(--danger)', fontSize: 13 }}>{error}</p>}
      </motion.div>
    </div>
  )
}
