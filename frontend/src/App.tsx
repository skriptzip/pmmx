import { motion } from 'framer-motion'
import { Film, Headphones, LayoutDashboard, Settings } from 'lucide-react'
import { useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { t } from './i18n'
import { Audio } from './pages/Audio'
import { Dashboard } from './pages/Dashboard'
import { Library } from './pages/Library'
import { Login } from './pages/Login'
import { ServerSetup } from './pages/ServerSetup'
import { getServerUrl, isNative } from './api/server'
import { Settings as SettingsPage } from './pages/Settings'
import type { Me } from './api/types'

const NAV = [
  { to: '/',         label: t('nav.home'),     Icon: LayoutDashboard },
  { to: '/library',  label: t('nav.library'),  Icon: Film            },
  { to: '/audio',    label: t('nav.audio'),    Icon: Headphones      },
  { to: '/settings', label: t('nav.settings'), Icon: Settings        },
]

function SideNav({ user }: { user: Me | null }) {
  return (
    <nav className="sidebar-nav">
      <div className="sidebar-brand">
        <img src="/icon.svg" alt="" width={28} height={28} style={{ borderRadius: 7 }} /> pmmx
      </div>
      <div className="sidebar-links">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <span className="sidebar-icon"><Icon size={18} /></span>
            {label}
          </NavLink>
        ))}
      </div>
      {user && (
        <div className="sidebar-user">
          {user.thumb
            ? <img src={user.thumb} alt="" className="sidebar-avatar" />
            : <div className="sidebar-avatar" />}
          <span className="sidebar-username">{user.username}</span>
        </div>
      )}
    </nav>
  )
}

function BottomNav() {
  return (
    <nav className="bottom-nav">
      {NAV.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} end={to === '/'}
          className={({ isActive }) => `bottom-link${isActive ? ' active' : ''}`}>
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export function App() {
  const { user, loading, isAuthenticated, login, logout } = useAuth()
  const location = useLocation()
  const [hasServer, setHasServer] = useState(() => !isNative || !!getServerUrl())

  if (!hasServer) return <ServerSetup onDone={() => setHasServer(true)} />

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}>
          <img src="/icon.svg" alt="pmmx" width={64} height={64} style={{ borderRadius: 14 }} />
        </motion.div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Login onLogin={login} />
  }

  return (
    <div className="app-shell">
      <SideNav user={user} />
      <main className="main-content">
        {/* Nur Fade, kein seitlicher Versatz und kein exit-Warten: das liess Seiten springen und verschob die Breite */}
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          <Routes location={location}>
            <Route path="/"         element={<Dashboard user={user!} />} />
            <Route path="/library"  element={<Library />} />
            <Route path="/audio"    element={<Audio />} />
            <Route path="/settings" element={<SettingsPage onLogout={logout} />} />
            <Route path="*"         element={<Navigate to="/" replace />} />
          </Routes>
        </motion.div>
      </main>
      <BottomNav />
    </div>
  )
}
