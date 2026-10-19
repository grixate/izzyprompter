import { BASE_PIXELS_PER_SECOND } from './motion.ts'
import { clamp } from './position.ts'

/** Preview motion never touches sockets or a paired session. */
export function previewFrame(position: number, maximum: number, speed: number, seconds: number) {
  return clamp(position + BASE_PIXELS_PER_SECOND * speed * Math.max(0, seconds), 0, maximum)
}
