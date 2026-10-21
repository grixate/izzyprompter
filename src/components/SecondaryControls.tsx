import type { ComponentProps } from 'react'
import { Pencil } from 'lucide-react'

export function PhraseNavigation({ enabled, index, total, onPrevious, onNext }: {
  enabled: boolean; index: number; total: number; onPrevious: () => void; onNext: () => void
}) {
  return <div className="phrase-nav">
    <button disabled={!enabled || index < 0} onClick={onPrevious} aria-label="Previous phrase"><span>←</span><small>PREV</small></button>
    <span className="phrase-count"><small>PHRASE</small>{index < 0 ? '—' : String(index + 1).padStart(2, '0')} / {String(Math.max(1, total)).padStart(2, '0')}</span>
    <button disabled={!enabled || index < 0} onClick={onNext} aria-label="Next phrase"><small>NEXT</small><span>→</span></button>
  </div>
}

export function QuickEditTrigger({ children = 'QUICK EDIT', ...props }: ComponentProps<'button'>) {
  return <button type="button" className="quick-edit-trigger" aria-label="Quick edit current paragraph" {...props}><Pencil size={12} /><span>{children}</span></button>
}
