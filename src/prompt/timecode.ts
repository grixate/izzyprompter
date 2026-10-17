import { BASE_PIXELS_PER_SECOND } from './motion.ts'

/** Nominal reading time at the current speed, not a recording/session timer. */
export function positionTimecode(position: number, speed: number): string {
  const tenths = Math.floor(Math.max(0, position) / (BASE_PIXELS_PER_SECOND * speed) * 10)
  const seconds = Math.floor(tenths / 10)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}.${tenths % 10}`
}
