import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Rendert eine grosse Liste schrittweise. Auf Handys mit hunderten Postern
 * friert sonst die Seite ein oder springt, weil alles auf einmal gebaut wird.
 * Gibt die sichtbare Anzahl und eine Ref fuer das Sentinel-Element am Listenende zurueck.
 */
export function useProgressive(total: number, resetKey: string, step = 48) {
  const [count, setCount] = useState(step)
  const observer = useRef<IntersectionObserver | null>(null)

  useEffect(() => { setCount(step) }, [resetKey, step])

  const sentinelRef = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect()
    if (!node) return
    observer.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) setCount(c => c + step)
      },
      { rootMargin: '600px 0px' },
    )
    observer.current.observe(node)
  }, [step])

  useEffect(() => () => observer.current?.disconnect(), [])

  return { count: Math.min(count, total), hasMore: count < total, sentinelRef }
}
