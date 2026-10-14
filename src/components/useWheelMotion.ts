import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/** Compositor motion for one visible rotor. No React or JS animation loop. */
export function useWheelMotion(root: RefObject<HTMLDivElement | null>, { enabled, playing, speed, dragging = false, phase = 0 }: {
  enabled: boolean; playing: boolean; speed: number; dragging?: boolean; phase?: number
}) {
  const angle = useRef(phase)
  const animation = useRef<Animation | null>(null)
  const [visible, setVisible] = useState(false)
  const [foreground, setForeground] = useState(document.visibilityState === 'visible')
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [version, setVersion] = useState(0)
  const freeze = useCallback(() => {
    const rotor = root.current?.querySelector<HTMLElement>('.wheel-rotor')
    if (rotor && animation.current) {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(rotor).transform)
      angle.current = Math.atan2(matrix.b, matrix.a)
      animation.current.cancel(); animation.current = null
      rotor.style.transform = `rotate(${angle.current}rad)`
    }
  }, [root])
  const rotate = useCallback((delta: number) => {
    freeze(); angle.current += delta
    const rotor = root.current?.querySelector<HTMLElement>('.wheel-rotor')
    if (rotor) rotor.style.transform = `rotate(${angle.current}rad)`
  }, [root, freeze])
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const motion = () => setReduced(media.matches)
    const focus = () => setForeground(document.visibilityState === 'visible')
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .05 })
    if (root.current) observer.observe(root.current)
    media.addEventListener('change', motion); document.addEventListener('visibilitychange', focus)
    return () => { observer.disconnect(); media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', focus); freeze() }
  }, [root, freeze])
  useEffect(() => {
    freeze()
    const rotor = root.current?.querySelector<HTMLElement>('.wheel-rotor')
    if (rotor && enabled && visible && foreground && !reduced && !dragging) {
      animation.current = rotor.animate([
        { transform: `rotate(${angle.current}rad)` }, { transform: `rotate(${angle.current + Math.PI * 2}rad)` },
      ], { duration: playing ? 24_000 / Math.max(.5, speed) : 160_000, iterations: Infinity, easing: 'linear' })
    }
    return freeze
  }, [root, enabled, playing, speed, visible, foreground, reduced, dragging, version, freeze])
  return { freeze, rotate, nudge: (delta: number) => { rotate(delta); setVersion(value => value + 1) } }
}
