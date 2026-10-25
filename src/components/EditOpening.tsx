import { ArrowRight } from 'lucide-react'
import './edit-opening.css'

export function EditOpening({ failed, message, onRetry }: { failed: boolean; message: string; onRetry: () => void }) {
  return <div className="edit-opening" data-failed={failed} aria-busy={!failed}>
    <div className="edit-line-finder" aria-hidden="true">
      <div className="edit-paper-lines">{[72, 94, 83, 64, 90].map((width, index) => <i key={index} style={{ width: `${width}%` }} />)}</div>
      <div className="edit-line-scan"><span /><i /></div>
    </div>
    <h2>{failed ? 'Let’s try that again.' : 'Finding your line'}</h2>
    <p role={failed ? 'alert' : undefined}>{failed ? message : 'Pausing the display and lining up your paragraph.'}</p>
    {failed && <button type="button" className="edit-opening-retry" onClick={onRetry}>Try again <ArrowRight size={18} aria-hidden="true" /></button>}
  </div>
}
