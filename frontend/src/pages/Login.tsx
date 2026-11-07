import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPlexPin, pollPlexPin, selectServer } from '../api/client'
import { t } from '../i18n'

type Stage = 'idle' | 'waiting' | 'server_select' | 'done'

interface Server {
  name: string
  owned: boolean
  client_identifier: string
}

// Store JWT in localStorage immediately so req() can use it before onLogin() is called.
function storeJwt(jwt: string) {
  try { localStorage.setItem('pmmx_token', jwt) } catch { /* */ }
}

export function Login({ onLogin }: { onLogin: (jwt: string) => void }) {
  const [stage, setStage] = useState<Stage>('idle')
  const [authUrl, setAuthUrl] = useState('')
  const [servers, setServers] = useState<Server[]>([])
  const [pendingJwt, setPendingJwt] = useState('')
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startLogin = useCallback(async () => {
    setError('')
    setStage('waiting')
    try {
      const { pin_id, code, client_id, auth_url } = await createPlexPin()
      setAuthUrl(auth_url)

      // Poll every 2 s until the user has logged in on plex.tv
      pollRef.current = setInterval(async () => {
        try {
          const res = await pollPlexPin(pin_id, code, client_id)
          if (res.status === 'expired') {
            clearInterval(pollRef.current!)
            setStage('idle')
            setError(t('login.errExpired'))
            return
          }
          if (res.status !== 'authorized') return

          clearInterval(pollRef.current!)

          // Fix: store JWT in localStorage NOW so selectServer() can send it
          storeJwt(res.jwt)
          setPendingJwt(res.jwt)

          const srvList = res.servers as Server[]

          if (srvList.length === 1) {
            await selectServer(srvList[0].name, srvList[0].client_identifier ?? '')
            onLogin(res.jwt)
          } else {
            setServers(srvList)
            setStage('server_select')
          }
        } catch {
          // keep polling
        }
      }, 2000)
    } catch {
      setStage('idle')
      setError(t('login.errPin'))
    }
  }, [onLogin])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const handleServerSelect = async (server: Server) => {
    setError('')
    try {
      // JWT is already in localStorage (stored above), so selectServer() is authenticated
      await selectServer(server.name, server.client_identifier ?? '')
      onLogin(pendingJwt)
    } catch {
      setError(t('login.errServer'))
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 32,
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <img src="/icon.svg" alt="" width={72} height={72} style={{ borderRadius: 16 }} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>pmmx</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 28 }}>
          {t('login.subtitle')}
        </p>

        <AnimatePresence mode="wait">
          {stage === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={startLogin}
              >
                {t('login.button')}
              </button>
            </motion.div>
          )}

          {stage === 'waiting' && (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {authUrl ? (
                <>
                  <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
                    {t('login.hint')}<br />
                    {t('login.hint2')}
                  </p>
                  {/* Link statt window.open — vermeidet Popup-Blocker */}
                  <a
                    href={authUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{ display: 'flex', width: '100%', justifyContent: 'center', marginBottom: 20 }}
                  >
                    {t('login.link')}
                  </a>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                      />
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>{t('login.waiting')}</p>
                </>
              ) : (
                <p style={{ color: 'var(--muted)', fontSize: 14 }}>{t('login.creatingPin')}</p>
              )}
              <button
                className="btn btn-ghost"
                style={{ marginTop: 16, width: '100%', justifyContent: 'center', fontSize: 13 }}
                onClick={() => { clearInterval(pollRef.current!); setStage('idle') }}
              >
                {t('login.cancel')}
              </button>
            </motion.div>
          )}

          {stage === 'server_select' && (
            <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p style={{ marginBottom: 14, color: 'var(--muted)', fontSize: 14 }}>{t('login.selectServer')}</p>
              {servers.map(s => (
                <button
                  key={s.name}
                  className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}
                  onClick={() => handleServerSelect(s)}
                >
                  <span>{s.name}</span>
                  {s.owned && <span style={{ fontSize: 11, color: 'var(--success)' }}>{t('login.owned')}</span>}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <p style={{ marginTop: 16, color: 'var(--danger)', fontSize: 13 }}>{error}</p>
        )}
      </motion.div>
    </div>
  )
}
