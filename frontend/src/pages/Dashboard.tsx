import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { AlertTriangle, Check, HardDrive, Loader2, Search, X } from 'lucide-react'
import { getMissingAudio, getMissingEpisodes, getMissingMovies, getScanProgress, getScanStatus, triggerScan } from '../api/client'
import type { Me, ScanProgress } from '../api/types'
import { dateLocale, t } from '../i18n'

function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ background: 'var(--surface-alt, #222)', borderRadius: 4, height: 6, overflow: 'hidden', marginTop: 4 }}>
      <motion.div
        style={{ height: '100%', background: 'var(--accent)', borderRadius: 4 }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ ease: 'easeOut', duration: 0.3 }}
      />
    </div>
  )
}

function stageName(stage: ScanProgress['stage']) {
  const map: Record<ScanProgress['stage'], string> = {
    starting: t('dash.stage.starting'),
    plex: t('dash.stage.plex'),
    movies: t('dash.stage.movies'),
    series: t('dash.stage.series'),
    audio: t('dash.stage.audio'),
    availability: t('dash.stage.availability'),
    done: t('dash.stage.done'),
  }
  return map[stage] ?? stage
}

function ScanProgressCard({ progress }: { progress: ScanProgress }) {
  const showMovies = progress.movies_total > 0
  const showShows = progress.shows_total > 0

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Loader2 size={15} className="icon-spin" /> {stageName(progress.stage)}
      </div>

      {showMovies && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
            <span>{t('common.movies')}</span>
            <span>{progress.movies_checked} / {progress.movies_total}</span>
          </div>
          <ProgressBar value={progress.movies_checked} total={progress.movies_total} />
        </div>
      )}

      {showShows && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
            <span>{t('common.series')}</span>
            <span>{progress.shows_checked} / {progress.shows_total}</span>
          </div>
          <ProgressBar value={progress.shows_checked} total={progress.shows_total} />
        </div>
      )}

      {progress.current_item && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {progress.current_item}
        </div>
      )}
    </motion.div>
  )
}

export function Dashboard({ user }: { user: Me }) {
  const movies = useQuery({ queryKey: ['missing-movies'], queryFn: () => getMissingMovies() })
  const episodes = useQuery({ queryKey: ['missing-episodes'], queryFn: () => getMissingEpisodes() })
  const audio = useQuery({ queryKey: ['missing-audio'], queryFn: getMissingAudio })
  const scans = useQuery({ queryKey: ['scan-status'], queryFn: getScanStatus, refetchInterval: 5000 })

  const latestScan = scans.data?.[0]
  const isScanning = latestScan?.status === 'running'

  const progress = useQuery({
    queryKey: ['scan-progress'],
    queryFn: getScanProgress,
    refetchInterval: isScanning ? 1000 : false,
    enabled: isScanning,
  })

  const streamable = [
    ...(movies.data?.filter(m => m.status === 'streamable') ?? []),
    ...(episodes.data?.filter(e => e.status === 'streamable') ?? []),
  ].length

  // Nach Ende eines Scans alle Listen neu laden (Bibliothek, Fehlendes, Audio)
  const queryClient = useQueryClient()
  const wasScanning = useRef(false)
  useEffect(() => {
    if (wasScanning.current && !isScanning) queryClient.invalidateQueries()
    wasScanning.current = isScanning
  }, [isScanning, queryClient])

  const handleScan = async (type: 'full' | 'plex') => {
    await triggerScan(type)
    scans.refetch()
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('dash.title')}</h1>
          {user.server_name && <div className="page-sub">{user.server_name}</div>}
        </div>
        {user.thumb && (
          <img src={user.thumb} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
        )}
      </div>

      <div className="stat-grid" style={{ marginBottom: 14 }}>
        {[
          { label: t('dash.missingMovies'), value: movies.data?.filter(m => m.status !== 'upcoming').length ?? '–', accent: 'var(--danger)' },
          { label: t('dash.missingEpisodes'), value: episodes.data?.filter(e => e.status !== 'upcoming').length ?? '–', accent: 'var(--danger)' },
          { label: t('dash.upcoming'), value: (movies.data?.filter(m => m.status === 'upcoming').length ?? 0) + (episodes.data?.filter(e => e.status === 'upcoming').length ?? 0), accent: 'var(--warning)' },
          { label: t('dash.streamable'), value: streamable, accent: 'var(--streamable)' },
        ].map(stat => (
          <div key={stat.label} className="stat-card" style={{ ['--stat-color' as string]: stat.accent }}>
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
      <div>
      {isScanning && progress.data && (
        <ScanProgressCard progress={progress.data} />
      )}

      {audio.data && audio.data.length > 0 && (
        <div className="card">
          <span style={{ color: 'var(--warning)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 6 }}>
            <AlertTriangle size={14} /> {t('dash.filesCount', { n: audio.data.length })}
          </span>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>{t('dash.withMissingLangs')}</span>
        </div>
      )}
      </div>

      <div className="card">
      <div className="action-stack">
      <button
        className="btn btn-primary"
        onClick={() => handleScan('full')}
        disabled={isScanning}
      >
        {isScanning
          ? <><Loader2 size={15} className="icon-spin" /> {t('dash.scanRunning')}</>
          : <><Search size={15} /> {t('dash.scanStart')}</>}
      </button>

      <button
        className="btn btn-ghost"
        onClick={() => handleScan('plex')}
        disabled={isScanning}
        title={t('dash.rescanTitle')}
      >
        <HardDrive size={15} /> {t('dash.rescanPlex')}
      </button>
      </div>

      {latestScan && !isScanning && (
        <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 14 }}>
          {t('dash.lastScan')} {latestScan.started_at ? new Date(latestScan.started_at).toLocaleString(dateLocale) : '–'}
          {' · '}
          <span style={{ color: latestScan.status === 'completed' ? 'var(--success)' : latestScan.status === 'failed' ? 'var(--danger)' : 'var(--muted)' }}>
            {latestScan.status === 'completed'
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={12} /> {t('dash.scanDone')}</span>
              : latestScan.status === 'failed'
              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><X size={12} /> {t('dash.scanFailed')}</span>
              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Loader2 size={12} className="icon-spin" /> {t('dash.scanRunningShort')}</span>}
          </span>
        </div>
      )}
      </div>
      </div>
    </div>
  )
}
