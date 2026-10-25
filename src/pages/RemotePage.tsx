import { RemoteBrand } from '../components/BrandLogo'
import { PhraseNavigation } from '../components/SecondaryControls'
import { useEffect, useMemo, useRef, useState } from 'react'
import { JogControls, TransportReadout } from '../components/JogControls'
import { legacySessionScriptToDocument } from '../domain/document'
import {
  createDebouncedStorageWriter,
  loadWorkspaceStorage,
  savePromptPosition,
  rememberPlaybackSpeed,
} from '../domain/storage'
import { useSession } from '../realtime/useSession'
import { SessionNotice } from '../realtime/SessionNotice'
import { latestReading, measuredPosition } from '../realtime/reading'
import { serverPosition } from '../prompt/motion'
import { QuickEdit } from './QuickEdit'
import { boundedSpeed } from '../realtime/keyboard'
import type { TransportState, SessionSnapshot } from '../realtime/protocol'
import type { SessionControllerView } from '../realtime/controller'
import { useRemoteAppearance } from '../product/useRemoteAppearance'
import { RemoteSkinLibrary } from '../product/RemoteSkinLibrary'
import { ReadingControls } from '../components/ReadingControls'
import { skinById, controlCraftSkins } from '../product/catalog'
import '../product/skins.css'

export function RemotePage({ sessionId }: { sessionId: string }) {
  const session = useSession(sessionId, 'remote')
  return <RemoteSurface sessionId={sessionId} session={session} />
}

export function RemoteSurface({ sessionId, session, onPairing }: { sessionId: string; session: SessionControllerView; onPairing?:()=>void }) {
  const { connection, transport, script, presence, clockOffset, reading, send, request, editing, connectionId, sessionEpoch, reconnect, now } = session
  const controlsReady = connection === 'connected' && !editing.active
  const appearance = useRemoteAppearance(sessionId, connection === 'connected')
  const [finishOpen, setFinishOpen] = useState(false)
  const [restoredStorage] = useState(() => loadWorkspaceStorage())
  const pendingSeekRef = useRef(0)
  const seekTimerRef = useRef<number | null>(null)
  const positionRef = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [localPlaying, setLocalPlaying] = useState(false)
  const [localSpeed, setLocalSpeed] = useState(restoredStorage.settings.speed)
  const speedIntent = useRef<number | null>(null)
  const speedSequence = useRef(0)
  const speedRevisionFloor = useRef(0)
  const latestTransport = useRef(transport)
  latestTransport.current = transport
  const [position, setPositionState] = useState(0)
  const [settingsWriter] = useState(() => createDebouncedStorageWriter<number>({
    write: rememberPlaybackSpeed,
  }))
  const [positionWriter] = useState(() => createDebouncedStorageWriter<{
    blockId: string | null
    characterOffset: number
  }>({
    delay: 500,
    write: savePromptPosition,
  }))

  useEffect(() => {
    if (controlsReady) return
    speedIntent.current = null
    speedSequence.current += 1
    speedRevisionFloor.current = 0
    setLocalSpeed(latestTransport.current.speed)
    if (seekTimerRef.current !== null) window.clearTimeout(seekTimerRef.current)
    seekTimerRef.current = null
    pendingSeekRef.current = 0
    setIsDragging(false)
  }, [controlsReady])

  const setPosition = (value: number | ((previous: number) => number)) => {
    const next = typeof value === 'function' ? value(positionRef.current) : value
    positionRef.current = next
    setPositionState(next)
  }

  const izzyDocument = useMemo(
    () => legacySessionScriptToDocument(script, sessionId).document,
    [script, sessionId],
  )
  const confirmed = latestReading(reading, transport, script.revision)
  const currentPhraseIndex = izzyDocument.blocks.findIndex((block) => block.id === confirmed?.anchor.blockId)
  const hasDisplayPosition = reading.source_id !== null && reading.checkpoint?.source_id === reading.source_id
    && measuredPosition(reading, transport, script.revision, clockOffset, now?.()) !== null

  useEffect(() => {
    if (connection !== 'connected') return
    setLocalPlaying(transport.status === 'playing')
    if (speedIntent.current === null && transport.revision >= speedRevisionFloor.current) setLocalSpeed(transport.speed)
    if (!isDragging) setPosition(measuredPosition(reading, transport, script.revision, clockOffset, now?.()) ?? serverPosition(transport, clockOffset, now?.()))
  }, [clockOffset, connection, transport, reading, script.revision])

  useEffect(() => {
    settingsWriter.schedule(localSpeed)
  }, [localSpeed, settingsWriter])

  useEffect(() => {
    if (!localPlaying || !controlsReady || isDragging) return
    const timer = window.setInterval(() => {
      setPosition(measuredPosition(reading, transport, script.revision, clockOffset, now?.()) ?? serverPosition(transport, clockOffset, now?.()))
    }, 200)
    return () => window.clearInterval(timer)
  }, [localPlaying, controlsReady, isDragging, reading, transport, script.revision, clockOffset])

  useEffect(() => {
    if (connection !== 'connected') return

    positionWriter.schedule(confirmed?.anchor ?? { blockId: null, characterOffset: 0 })
  }, [connection, confirmed?.anchor.blockId, confirmed?.anchor.characterOffset, positionWriter])

  useEffect(() => {
    const flush = () => {
      settingsWriter.flush()
      positionWriter.flush()
    }
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flushWhenHidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flushWhenHidden)
      settingsWriter.dispose()
      positionWriter.dispose()
    }
  }, [positionWriter, settingsWriter])

  const flushSeek = () => {
    if (seekTimerRef.current !== null) window.clearTimeout(seekTimerRef.current)
    seekTimerRef.current = null
    const delta = pendingSeekRef.current
    pendingSeekRef.current = 0
    if (delta !== 0) send('transport:seek_delta', { delta })
  }

  const queueSeek = (delta: number) => {
    if (!controlsReady) return
    setPosition((value) => Math.max(0, value + delta))
    pendingSeekRef.current += delta
    if (seekTimerRef.current === null) seekTimerRef.current = window.setTimeout(flushSeek, 33)
  }

  useEffect(() => () => {
    if (seekTimerRef.current !== null) window.clearTimeout(seekTimerRef.current)
  }, [])

  const toggle = () => {
    if (!controlsReady) return
    const next = !localPlaying
    setLocalPlaying(next)
    send(next ? 'transport:play' : 'transport:pause')
    navigator.vibrate?.(next ? 18 : [12, 25, 12])
  }

  const changeSpeed = (next: number) => {
    if (!controlsReady) return
    const speed = boundedSpeed(next)
    const sequence = ++speedSequence.current
    speedIntent.current = sequence
    setLocalSpeed(speed)
    // Earlier reading checkpoints and acknowledgements must not undo a newer
    // drag/keyboard intent. The existing protocol still owns the final value.
    void request<TransportState | SessionSnapshot>('transport:set_speed', { speed }).then(result => {
      if (speedIntent.current !== sequence) return
      speedIntent.current = null
      const confirmed = result.ok ? ('transport' in result.value ? result.value.transport : result.value) : latestTransport.current
      if (result.ok) speedRevisionFloor.current = Math.max(speedRevisionFloor.current, confirmed.revision)
      setLocalSpeed(confirmed.speed)
    })
  }

  const jumpPhrase = (direction: -1 | 1) => {
    if (!controlsReady || currentPhraseIndex < 0) return
    flushSeek()
    send('transport:step_block', { direction })
    navigator.vibrate?.(10)
  }

  const seekEdge = (edge: 'start' | 'end') => {
    const block = edge === 'start' ? izzyDocument.blocks[0] : izzyDocument.blocks.at(-1)
    if (!controlsReady || !block) return
    flushSeek()
    send('transport:seek_anchor', { anchor: { blockId: block.id, characterOffset: edge === 'start' ? 0 : block.text.length } })
  }

  return (
    <main className={`remote-panel standalone-remote skin-face skin--${appearance.skin}${controlCraftSkins.has(appearance.skin) ? ' skin-controls' : ''}`} aria-label="Remote controller">
      <SessionNotice connection={connection} surface="remote" onRetry={reconnect} />
      <header className="remote-header">
        <div className="remote-identity">
          <strong>R–{skinById(appearance.skin).number}</strong>
          <RemoteBrand sessionId={sessionId} />
        </div>
        <div className="remote-link-state">
          <span className={`network-state ${connection}`}><i /> {connection === 'connected' ? session.path?.toUpperCase() ?? 'CONNECTED' : connection.toUpperCase()}</span>
          <small>DSP {presence.display > 0 ? '01 READY' : '00 WAIT'}</small>
        </div>
      </header>

      <TransportReadout skin={appearance.skin} position={position} speed={localSpeed} playing={localPlaying} available={hasDisplayPosition} scrubbing={isDragging} />
      <JogControls skin={appearance.skin} enabled={controlsReady} playing={localPlaying} speed={localSpeed} position={position}
        maximum={reading.checkpoint?.maximum ?? 100000000}
        positionText={hasDisplayPosition ? `Display position ${Math.round(position)} pixels` : 'Waiting for display position'}
        onToggle={toggle} onSeek={queueSeek} onEdge={seekEdge} onSpeedChange={changeSpeed}
        onDraggingChange={setIsDragging} onSeekEnd={flushSeek} />

      <PhraseNavigation enabled={controlsReady} index={currentPhraseIndex} total={izzyDocument.blocks.length}
        onPrevious={() => jumpPhrase(-1)} onNext={() => jumpPhrase(1)} />
      <div className="remote-tools">
      <QuickEdit sessionId={sessionId} epoch={sessionEpoch} connectionId={connectionId} connection={connection}
        document={izzyDocument} revision={script.revision} reading={reading} transport={transport} editing={editing} request={request}
        canEdit={hasDisplayPosition} beforeOpen={flushSeek} />
      <ReadingControls session={session} beforeOpen={flushSeek} onPairing={onPairing} skinName={skinById(appearance.skin).name}
        onChooseSkin={appearance.local ? undefined : () => { flushSeek(); setFinishOpen(true) }} />
      </div>
      <footer className="remote-footer"><span>TURN TO SEEK</span><span>PRESS {localPlaying ? 'PAUSE' : 'PLAY'} TO {localPlaying ? 'HOLD' : 'RUN'}</span></footer>
      {finishOpen && <RemoteSkinLibrary selected={appearance.skin} pro={appearance.pro} onApply={appearance.apply} onClose={() => setFinishOpen(false)} />}
    </main>
  )
}
