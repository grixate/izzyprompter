import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

const turn = Math.PI * 2
type MovingPart = { element: HTMLElement | SVGElement; ratio: number; distance: number | null }
const pose = (part: MovingPart, angle: number) => part.distance === null
  ? { transform: `rotate(${angle * part.ratio}rad)` }
  : { strokeDashoffset: String(-angle / turn * part.distance) }

/** One compositor clock drives the rotor and its mechanically linked parts. */
export function useWheelMotion(root: RefObject<HTMLDivElement | null>, { enabled, playing, speed, dragging = false, phase = 0, ambient = false, artwork = '' }: {
  enabled: boolean; playing: boolean; speed: number; dragging?: boolean; phase?: number; ambient?: boolean; artwork?: string
}) {
  const angle = useRef(phase)
  const motion = useRef<{ start: number; duration: number; animations: Animation[]; parts: MovingPart[] } | null>(null)
  const [visible, setVisible] = useState(false)
  const [foreground, setForeground] = useState(document.visibilityState === 'visible')
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [version, setVersion] = useState(0)
  const parts = useCallback((): MovingPart[] => {
    const rotor = root.current?.querySelector<HTMLElement>('.wheel-rotor')
    return [
      ...(rotor ? [{ element: rotor, ratio: 1, distance: null }] : []),
      ...Array.from(root.current?.querySelectorAll<HTMLElement | SVGElement>('[data-wheel-ratio], [data-wheel-distance]') ?? []).map(element => ({
        element, ratio: Number(element.dataset.wheelRatio ?? 1),
        distance: element.dataset.wheelDistance === undefined ? null : Number(element.dataset.wheelDistance),
      })),
    ]
  }, [root])
  const write = useCallback((value: number, targets = parts()) => {
    for (const part of targets) Object.assign(part.element.style, pose(part, value))
  }, [parts])
  const freeze = useCallback(() => {
    const current = motion.current
    if (!current) return
    // Keep complete turns: recovering an angle from a matrix loses gear phase.
    const elapsed = Number(current.animations[0]?.currentTime ?? 0)
    angle.current = current.start + elapsed / current.duration * turn
    write(angle.current, current.parts)
    for (const animation of current.animations) animation.cancel()
    motion.current = null
  }, [write])
  const rotate = useCallback((delta: number) => {
    freeze(); angle.current += delta; write(angle.current)
    if (root.current && delta !== 0) root.current.dataset.motionDirection = delta < 0 ? 'reverse' : 'forward'
  }, [root, freeze, write])
  useEffect(() => {
    if (!enabled) { setVisible(false); return }
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(media.matches)
    setForeground(document.visibilityState === 'visible')
    const preference = () => setReduced(media.matches)
    const focus = () => setForeground(document.visibilityState === 'visible')
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .05 })
    if (root.current) observer.observe(root.current)
    media.addEventListener('change', preference); document.addEventListener('visibilitychange', focus)
    return () => { observer.disconnect(); media.removeEventListener('change', preference); document.removeEventListener('visibilitychange', focus); freeze() }
  }, [root, freeze, enabled])
  useEffect(() => {
    freeze()
    const targets = parts()
    write(angle.current, targets)
    if (targets.length && enabled && (playing || ambient) && visible && foreground && !reduced && !dragging) {
      if (root.current) root.current.dataset.motionDirection = 'forward'
      const duration = playing ? 24_000 / Math.max(.5, speed) : 160_000
      const startTime = document.timeline.currentTime
      const animations = targets.map(part => {
        const animation = part.element.animate([pose(part, angle.current), pose(part, angle.current + turn)], { duration, iterations: Infinity, easing: 'linear' })
        if (startTime !== null) animation.startTime = startTime
        return animation
      })
      motion.current = { start: angle.current, duration, animations, parts: targets }
    }
    return freeze
  }, [root, enabled, playing, speed, ambient, visible, foreground, reduced, dragging, version, artwork, freeze, parts, write])
  return { freeze, rotate, nudge: (delta: number) => { rotate(delta); setVersion(value => value + 1) } }
}
