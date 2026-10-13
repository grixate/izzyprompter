import { clamp } from './position.ts'
import type { TransportState } from '../realtime/protocol'

export const BASE_PIXELS_PER_SECOND = 52
export const serverPosition = (transport: TransportState, clockOffset: number, now = Date.now()) =>
  transport.anchor_position + (transport.status === 'playing'
    ? Math.max(0, now + clockOffset - transport.anchor_server_time) / 1_000 * BASE_PIXELS_PER_SECOND * transport.speed
    : 0)

/** Local pixels can change when typography changes. Projection keeps incoming
 * server deltas useful without undoing the local semantic restoration. */
export class PromptMotion {
  position = 0
  maximum = 1
  private projection = 0

  reproject(localPosition: number, authoritativePosition: number) {
    this.position = clamp(localPosition, 0, this.maximum)
    this.projection = this.position - authoritativePosition
  }

  reconcile(authoritativePosition: number, paused: boolean) {
    const projected = authoritativePosition + this.projection
    const expected = clamp(projected, 0, this.maximum)
    if (paused || Math.abs(expected - this.position) > 380) this.position = expected
    if (projected < 0 || projected > this.maximum) this.projection = this.position - authoritativePosition
  }

  frame(transport: TransportState, authoritativePosition: number, deltaSeconds: number) {
    // Use full elapsed time so a low frame rate does not slow down reading.
    let next = this.position + (transport.status === 'playing'
      ? BASE_PIXELS_PER_SECOND * transport.speed * deltaSeconds : 0)
    const projected = authoritativePosition + this.projection
    const expected = clamp(projected, 0, this.maximum)
    const difference = expected - next
    if (Math.abs(difference) > 380) next = expected
    else next += difference * Math.min(1, deltaSeconds * 12)
    this.position = clamp(next, 0, this.maximum)
    // Playback can run against an edge for a long time. Discard that excess
    // distance so reversing the wheel moves immediately, not after dead travel.
    if (projected < 0 || projected > this.maximum) this.projection = this.position - authoritativePosition
    return this.position
  }
}
