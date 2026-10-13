import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import type { IzzyDocumentV1 } from '../domain/document'
import { loadDisplayCheckpoint, saveDisplayCheckpoint } from '../domain/storage'
import type { ConnectionState, ReadingState, TransportState } from '../realtime/protocol'
import { latestReading } from '../realtime/reading'
import { measurePromptLayout } from './layout'
import { PromptMotion, serverPosition } from './motion'
import { anchorAtPosition, positionAtAnchor, type ParagraphLayout } from './position'

type Options = {
  sessionId: string
  sessionEpoch: string | null
  scriptRevision: number
  reading: ReadingState
  displayId: string | null
  connection: ConnectionState
  send: (event: string, payload?: Record<string, unknown>) => boolean
  document: IzzyDocumentV1
  transport: TransportState
  clockOffset: number
  now?: () => number
  trackRef: RefObject<HTMLDivElement | null>
  displayRef: RefObject<HTMLElement | null>
  layoutKey: string
}

export function usePromptEngine(options: Options) {
  const { sessionId, sessionEpoch, document: scriptDocument, transport, clockOffset, trackRef, displayRef, layoutKey } = options
  const motionRef = useRef(new PromptMotion())
  const layoutRef = useRef<ParagraphLayout[]>([])
  const readLineRef = useRef(0)
  const initializedRef = useRef(false)
  const transportRef = useRef(transport)
  const clockRef = useRef(clockOffset)
  const key = `${sessionEpoch ?? 'pending'}:${scriptDocument.id}:${options.scriptRevision}:${scriptDocument.blocks.map((block) => block.id).join('|')}`
  const layoutRevisionRef = useRef(-1)
  const documentKeyRef = useRef(key)
  const [stored] = useState(() => loadDisplayCheckpoint(sessionId))
  const metadataRef = useRef(options)
  const publicationRef = useRef('')
  const appliedIntentRef = useRef(0)
  const wasSecondaryRef = useRef(false)

  useLayoutEffect(() => { metadataRef.current = options })

  const renderPosition = useCallback(() => {
    if (trackRef.current) trackRef.current.style.transform = `translate3d(0, ${-motionRef.current.position}px, 0)`
  }, [trackRef])

  const checkpoint = useCallback(() => {
    if (!initializedRef.current || layoutRevisionRef.current !== metadataRef.current.scriptRevision) return
    const anchor = anchorAtPosition(layoutRef.current, motionRef.current.position, readLineRef.current)
    if (!anchor) return
    saveDisplayCheckpoint(sessionId, {
      documentKey: documentKeyRef.current,
      anchor,
      serverPosition: serverPosition(transportRef.current, clockRef.current, metadataRef.current.now?.()),
      transportRevision: transportRef.current.revision,
    })
    const metadata = metadataRef.current
    if (metadata.connection !== 'connected' || !metadata.displayId || metadata.reading.source_id !== metadata.displayId) return
    const signature = `${metadata.displayId}:${documentKeyRef.current}:${transportRef.current.revision}:${motionRef.current.position}:${motionRef.current.maximum}`
    if (signature === publicationRef.current) return
    const sent = metadata.send('reading:checkpoint', {
      anchor, position: motionRef.current.position, maximum: motionRef.current.maximum,
      transport_position: serverPosition(transportRef.current, clockRef.current, metadataRef.current.now?.()),
      transport_revision: transportRef.current.revision, script_revision: metadata.scriptRevision,
    })
    if (sent) publicationRef.current = signature
  }, [sessionId])

  useLayoutEffect(() => {
    transportRef.current = transport
    clockRef.current = clockOffset
    if (initializedRef.current && layoutRevisionRef.current === options.scriptRevision) {
      const intent = transport.semantic_anchor
      const target = intent && intent.script_revision === options.scriptRevision && intent.revision > appliedIntentRef.current
        ? positionAtAnchor(layoutRef.current, intent.anchor, readLineRef.current) : null
      if (target !== null && intent) {
        const authoritative = serverPosition(transport, clockOffset, options.now?.())
        motionRef.current.reproject(target + authoritative - intent.transport_position, authoritative)
        appliedIntentRef.current = intent.revision
      } else motionRef.current.reconcile(serverPosition(transport, clockOffset, options.now?.()), transport.status === 'paused')
      renderPosition()
      checkpoint()
    }
  }, [transport, clockOffset, options.scriptRevision, checkpoint, renderPosition])

  useLayoutEffect(() => {
    if (!trackRef.current || !displayRef.current || scriptDocument.blocks.length === 0) return
    let active = true
    const measure = () => {
      if (!active || !trackRef.current || !displayRef.current) return
      const motion = motionRef.current
      const sameDocument = documentKeyRef.current === key
      const previousAnchor = initializedRef.current && sameDocument
        ? anchorAtPosition(layoutRef.current, motion.position, readLineRef.current) : null
      const previousAnchorPosition = previousAnchor
        ? positionAtAnchor(layoutRef.current, previousAnchor, readLineRef.current) : null
      // Keep the fractional progress through a line. Repeated resize/font
      // notifications must not snap an authoritative seek to the line centre.
      const withinLine = previousAnchorPosition === null ? 0 : motion.position - previousAnchorPosition
      const authoritative = serverPosition(transportRef.current, clockRef.current, metadataRef.current.now?.())
      const layout = measurePromptLayout(trackRef.current)
      const readLine = displayRef.current.clientHeight * 0.42
      motion.maximum = Math.max(0, trackRef.current.scrollHeight - displayRef.current.clientHeight * 0.48)
      const canRestore = !initializedRef.current && stored?.documentKey === key
        && stored.transportRevision === transportRef.current.revision
      const restored = canRestore ? positionAtAnchor(layout, stored.anchor, readLine) : null
      const preservedLine = previousAnchor ? positionAtAnchor(layout, previousAnchor, readLine) : null
      const preserved = preservedLine === null ? null : preservedLine + withinLine
      // An unchanged playing transport may have advanced during a refresh.
      const advancedRestored = restored === null ? null
        : restored + authoritative - stored!.serverPosition
      const shared = latestReading(metadataRef.current.reading, transportRef.current, metadataRef.current.scriptRevision)
      const sharedPosition = shared ? positionAtAnchor(layout, shared.anchor, readLine) : null
      const projectedShared = sharedPosition === null || !shared ? null : sharedPosition + authoritative - shared.transportPosition
      motion.reproject(preserved ?? advancedRestored ?? projectedShared ?? authoritative, authoritative)
      appliedIntentRef.current = transportRef.current.semantic_anchor?.revision ?? 0
      layoutRef.current = layout
      readLineRef.current = readLine
      documentKeyRef.current = key
      layoutRevisionRef.current = metadataRef.current.scriptRevision
      initializedRef.current = true
      renderPosition()
      checkpoint()
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(displayRef.current)
    observer.observe(trackRef.current)
    // Late-loaded fonts can reflow a paragraph without a viewport change.
    void document.fonts?.ready.then(measure)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [key, scriptDocument.blocks.length, layoutKey, stored, checkpoint, renderPosition, trackRef, displayRef])

  // Authority hand-off and reconnect need a fresh checkpoint even while paused.
  useEffect(() => {
    const metadata = metadataRef.current
    if (metadata.displayId && metadata.reading.source_id && metadata.displayId !== metadata.reading.source_id) wasSecondaryRef.current = true
    if (wasSecondaryRef.current && metadata.displayId === metadata.reading.source_id && initializedRef.current) {
      const shared = latestReading(metadata.reading, transportRef.current, metadata.scriptRevision)
      const target = shared ? positionAtAnchor(layoutRef.current, shared.anchor, readLineRef.current) : null
      if (target !== null && shared) {
        const authoritative = serverPosition(transportRef.current, clockRef.current, metadataRef.current.now?.())
        motionRef.current.reproject(target + authoritative - shared.transportPosition, authoritative)
        renderPosition()
      }
      wasSecondaryRef.current = false
    }
    publicationRef.current = ''
    checkpoint()
  }, [options.connection, options.displayId, options.reading.source_id, checkpoint, renderPosition])

  useEffect(() => {
    let frameId = 0
    let previous = performance.now()
    const frame = (now: number) => {
      const delta = Math.max(0, (now - previous) / 1_000)
      previous = now
      if (initializedRef.current) {
        const current = transportRef.current
        motionRef.current.frame(current, serverPosition(current, clockRef.current, metadataRef.current.now?.()), delta)
        renderPosition()
      }
      frameId = requestAnimationFrame(frame)
    }
    frameId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(frameId)
  }, [renderPosition])

  useEffect(() => {
    const interval = window.setInterval(checkpoint, 500)
    const onVisibility = () => { if (document.visibilityState === 'hidden') checkpoint() }
    window.addEventListener('pagehide', checkpoint)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('pagehide', checkpoint)
      document.removeEventListener('visibilitychange', onVisibility)
      checkpoint()
    }
  }, [checkpoint])
}
