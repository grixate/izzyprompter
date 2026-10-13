import { useEffect, useRef } from 'react'
import type { ConnectionState } from './protocol'
import { saveEditorSession } from './credentials'

const problems = {
  expired: ['Session ended', 'Start a new session from the script page on your reading device, then scan its new pairing link.'],
  unauthorized: ['Pairing link required', 'Open the complete pairing link or scan the QR code again. The session code alone does not grant access.'],
  incompatible: ['Please refresh', 'This page uses an older connection protocol. Refresh the editor and create a new pairing link.'],
  limited: ['Session limit reached', 'Close unused devices or create a new session from the editor, then scan its QR code.'],
} as const

export function SessionNotice({ connection, surface = 'display', onBackToScript, onRetry }: {
  connection: ConnectionState
  surface?: 'editor' | 'display' | 'remote'
  onBackToScript?: () => void
  onRetry?: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const action = useRef<HTMLAnchorElement>(null)
  const terminal = connection in problems
  useEffect(() => {
    const node = dialog.current
    if (terminal && node && !node.open) {
      node.showModal()
      action.current?.focus()
    }
    return () => { if (node?.open) node.close() }
  }, [terminal, connection])

  if (!terminal) {
    if (connection !== 'offline' && connection !== 'reconnecting') return null
    return <div className="session-reconnecting">
      <span role="status">CONNECTION LOST · RECONNECTING · {surface === 'display' ? 'DISPLAY MAY CONTINUE LOCALLY' : 'CONTROLS PAUSED'}</span>
      {onRetry && <button onClick={onRetry}>RETRY CONNECTION</button>}
    </div>
  }
  const [title, description] = problems[connection as keyof typeof problems]
  return (
      <dialog ref={dialog} className="session-problem" role="alertdialog" aria-labelledby="session-problem-title" aria-describedby="session-problem-description" onCancel={(event) => event.preventDefault()}>
        <span>SESSION / {connection.toUpperCase()}</span>
        <h1 id="session-problem-title">{title}</h1>
        <p id="session-problem-description">{connection === 'expired' && surface === 'editor'
          ? 'This session ended. Return to the current script and explicitly start a new session. Your text will stay in this tab.' : description}</p>
        <a ref={action} href="/" onClick={(event) => {
          try { saveEditorSession(null, window.sessionStorage) } catch { /* storage unavailable */ }
          if (onBackToScript) { event.preventDefault(); onBackToScript() }
        }}>BACK TO SCRIPT <span aria-hidden="true">↗</span></a>
      </dialog>
  )
}
