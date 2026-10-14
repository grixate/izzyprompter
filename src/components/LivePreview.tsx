import { RemoteBrand } from './BrandLogo'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { JogControls, TransportReadout } from './JogControls'
import { PromptSurface } from './PromptSurface'
import { PREVIEW_SCRIPT, previewFrame } from '../prompt/preview'
import { clamp } from '../prompt/position'
import { normalizePlainText } from '../domain/textNormalization'

export function LivePreview({ content, pauseVersion }: { content: string; pauseVersion: number }) {
  const section = useRef<HTMLElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const positionRef = useRef(0)
  const maximumRef = useRef(0)
  const [position, setPosition] = useState(0)
  const [maximum, setMaximum] = useState(0)
  const [speed, setSpeed] = useState(0.86)
  const [playing, setPlaying] = useState(() => !content.trim() && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [visible, setVisible] = useState(true)
  const [foreground, setForeground] = useState(document.visibilityState === 'visible')
  const ownScript = Boolean(content.trim())
  // Large imports remain intact in the editor; the miniature only needs an excerpt.
  const blocks = useMemo(() => normalizePlainText(content.trim() ? content.slice(0, 20_000) : PREVIEW_SCRIPT)
    .split('\n\n').map((text, index) => ({ id: `preview-${index}`, text })), [content])
  const running = playing && visible && foreground

  const paint = (next: number, publish = true) => {
    positionRef.current = clamp(next, 0, maximumRef.current)
    if (track.current) track.current.style.transform = `translateY(${-positionRef.current}px)`
    if (publish) setPosition(positionRef.current)
  }

  useLayoutEffect(() => {
    paint(0)
    const measure = () => {
      if (!track.current || !viewport.current) return
      const next = Math.max(0, track.current.scrollHeight - viewport.current.clientHeight - 26)
      maximumRef.current = next
      setMaximum(next)
      paint(positionRef.current)
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (track.current) observer.observe(track.current)
    if (viewport.current) observer.observe(viewport.current)
    document.fonts.ready.then(measure)
    return () => observer.disconnect()
  }, [blocks])

  useEffect(() => { if (pauseVersion > 0) setPlaying(false) }, [pauseVersion])
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const reduce = () => { if (media.matches) setPlaying(false) }
    const visibility = () => setForeground(document.visibilityState === 'visible')
    media.addEventListener('change', reduce)
    document.addEventListener('visibilitychange', visibility)
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.05 })
    if (section.current) observer.observe(section.current)
    return () => { media.removeEventListener('change', reduce); document.removeEventListener('visibilitychange', visibility); observer.disconnect() }
  }, [])

  useEffect(() => {
    if (!running) return
    let frame = 0
    let last = performance.now()
    let published = last
    const advance = (now: number) => {
      const next = previewFrame(positionRef.current, maximumRef.current, speed, Math.min((now - last) / 1000, 0.1))
      last = now
      paint(next, now - published >= 160)
      if (now - published >= 160) published = now
      if (maximumRef.current > 0 && next >= maximumRef.current) { setPlaying(false); paint(next); return }
      frame = requestAnimationFrame(advance)
    }
    frame = requestAnimationFrame(advance)
    return () => cancelAnimationFrame(frame)
  }, [running, speed])

  return <aside className="preview-stage" ref={section} aria-label="Interactive teleprompter preview">
    <div className="preview-heading"><h2>PHONE REMOTE</h2><span>{ownScript ? 'YOUR SCRIPT' : 'LIVE PREVIEW'}</span></div>
    <div ref={viewport} className="display-panel live-preview" aria-label={ownScript ? 'Your script preview' : 'Sample script preview'}>
      <PromptSurface blocks={blocks} trackRef={track} />
    </div>
    <div className="remote-panel preview-remote" aria-label="Preview remote">
      <header className="remote-header"><div className="remote-identity"><strong>R–01</strong><RemoteBrand /></div><span className="preview-only">PREVIEW</span></header>
      <TransportReadout position={position} speed={speed} playing={running} label={ownScript ? 'YOUR SCRIPT' : 'SAMPLE SCRIPT'} />
      <JogControls enabled playing={running} speed={speed} position={position} maximum={Math.max(1, maximum)}
        positionText={`Preview position ${Math.round(position)} of ${Math.round(maximum)} pixels`}
        onToggle={() => { if (positionRef.current >= maximumRef.current) paint(0); setPlaying(!playing) }}
        onSeek={(delta) => paint(positionRef.current + delta)}
        onEdge={(edge) => paint(edge === 'start' ? 0 : maximumRef.current)}
        onSpeedChange={setSpeed} pageSize={viewport.current?.clientHeight ?? 240} />
    </div>
    <p className="preview-caption">{content.length > 20_000 ? 'Showing the first 20,000 characters. Your full script is kept.' : 'Playback control and live corrections, from your phone.'}</p>
  </aside>
}
