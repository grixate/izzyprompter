import { useEffect, useRef, useState, type RefObject } from 'react'
import { clamp } from '../prompt/position'
import { previewFrame } from '../prompt/preview'

/** Isolated showroom transport: no sessions, account writes or device preferences. */
export function useInstrumentPreview(root: RefObject<HTMLDivElement | null>, enabled: boolean, controlledPlaying?: boolean, onPlayingChange?: (value: boolean) => void) {
  const maximum = 18_000
  const [position, setPosition] = useState(0)
  const current = useRef(0)
  const [speed, setSpeed] = useState(.56)
  const [localPlaying, setLocalPlaying] = useState(false)
  const [visible, setVisible] = useState(false)
  const [foreground, setForeground] = useState(document.visibilityState === 'visible')
  const playing = controlledPlaying ?? localPlaying
  const setPlaying = (value: boolean) => { setLocalPlaying(value); onPlayingChange?.(value) }
  const latest = useRef(setPlaying)
  latest.current = setPlaying
  const running = enabled && playing && visible && foreground
  const seek = (value: number) => { current.current = clamp(value, 0, maximum); setPosition(current.current) }

  useEffect(() => {
    if (!enabled) return
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .05 })
    if (root.current) observer.observe(root.current)
    const visibility = () => setForeground(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', visibility)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility) }
  }, [root, enabled])

  useEffect(() => {
    if (!running) return
    let frame = 0, last = performance.now(), published = last
    const advance = (now: number) => {
      current.current = previewFrame(current.current, maximum, speed, Math.min((now - last) / 1000, .1))
      last = now
      if (now - published >= 100 || current.current === maximum) { setPosition(current.current); published = now }
      if (current.current === maximum) { latest.current(false); return }
      frame = requestAnimationFrame(advance)
    }
    frame = requestAnimationFrame(advance)
    return () => cancelAnimationFrame(frame)
  }, [running, speed])

  return { position, maximum, speed, setSpeed, playing, running,
    toggle: () => { if (!playing && current.current === maximum) seek(0); setPlaying(!playing) },
    jog: (delta: number) => seek(current.current + delta),
    edge: (edge: 'start' | 'end') => seek(edge === 'start' ? 0 : maximum) }
}
