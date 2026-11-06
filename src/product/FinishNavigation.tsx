import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function FinishNavigation({ label, onStep, disabled, children }: {
  label: string
  onStep: (direction: number) => void
  disabled?: boolean
  children: ReactNode
}) {
  return <div className="finish-navigation" role="group" aria-label={label}>
    {children}
    <button type="button" aria-label="Previous finish" disabled={disabled} onClick={() => onStep(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
    <button type="button" aria-label="Next finish" disabled={disabled} onClick={() => onStep(1)}><ChevronRight size={20} aria-hidden="true" /></button>
  </div>
}
