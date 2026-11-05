import { AnimatePresence, motion } from 'framer-motion'
import { Clapperboard, Film, Headphones, LayoutDashboard, Settings } from 'lucide-react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { t } from './i18n'
import { Audio } from './pages/Audio'
import { Dashboard } from './pages/Dashboard'
import { Library } from './pages/Library'
import { Login } from './pages/Login'
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
        <Clapperboard size={20} /> pmmx
      </div>
      {user && (
        <div className="sidebar-user">
          {user.thumb
            ? <img src={user.thumb} alt="" className="sidebar-avatar" />
            : <div className="sidebar-avatar" />}
          <span className="sidebar-username">{user.username}</span>
        </div>
      )}
      <div className="sidebar-links">
        {NAV.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <span className="sidebar-icon"><Icon size={17} /></span>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function BottomNav() {
  return (
    <nav className="bottom-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 'var(--nav-h)',
      background: 'rgba(15,15,15,0.92)',
      backdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {NAV.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} end={to === '/'}
          style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 3,
            color: isActive ? 'var(--accent)' : 'var(--muted)',
            transition: 'color .15s',
            textDecoration: 'none',
          })}>
          <Icon size={22} />
          {to !== '/settings' && (
            <span style={{ fontSize: 10 }}>{label}</span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function App() {
  const { user, loading, isAuthenticated, login, logout } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}>
          <Clapperboard size={36} color="var(--accent)" />
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
      <div className="main-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
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
        </AnimatePresence>
      </div>
      <BottomNav />
    </div>
  )
}
