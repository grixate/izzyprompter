import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { RemoteInstrument } from '../components/RemoteInstrument'
import type { SkinId } from './catalog'
import './remote-skin-sample.css'

export function RemoteSkinSample({ skin, children }: { skin: SkinId; children?: ReactNode }) {
  const host = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const stage = host.current, instrument = stage?.querySelector<HTMLElement>('.remote-instrument')
    if (!stage || !instrument) return
    const fit = () => {
      if (!stage.clientHeight || !instrument.offsetHeight) return
      const scale = Math.min((stage.clientWidth - 16) / instrument.offsetWidth, (stage.clientHeight - 28) / instrument.offsetHeight)
      stage.style.setProperty('--sample-scale', String(Math.max(.05, scale)))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(stage); observer.observe(instrument)
    return () => observer.disconnect()
  }, [skin])
  return <span ref={host} className="remote-skin-sample"><RemoteInstrument interactive={false} skin={skin} motion={false} />{children}</span>
}
