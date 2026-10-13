import type { ReadingState, TransportState } from './protocol.ts'
import { clamp } from '../prompt/position.ts'
import { serverPosition } from '../prompt/motion.ts'

/** A semantic seek wins until the display confirms that command's revision. */
export function latestReading(reading: ReadingState, transport: TransportState, scriptRevision: number) {
  const checkpoint = reading.checkpoint?.script_revision === scriptRevision ? reading.checkpoint : null
  const intent = transport.semantic_anchor?.script_revision === scriptRevision ? transport.semantic_anchor : null
  if (intent && (!checkpoint || intent.revision > checkpoint.transport_revision)) {
    return { anchor: intent.anchor, transportPosition: intent.transport_position, measured: false }
  }
  return checkpoint ? { anchor: checkpoint.anchor, transportPosition: checkpoint.transport_position, measured: true } : null
}

export function measuredPosition(reading: ReadingState, transport: TransportState, scriptRevision: number, clockOffset: number, now = Date.now()) {
  const checkpoint = reading.checkpoint
  if (!checkpoint || !latestReading(reading, transport, scriptRevision)?.measured) return null
  return clamp(checkpoint.position + serverPosition(transport, clockOffset, now) - checkpoint.transport_position, 0, checkpoint.maximum)
}
