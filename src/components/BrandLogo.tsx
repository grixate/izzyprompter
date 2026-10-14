import darkLogo from '../assets/brand/izzy-logo-dark.svg'
import lightLogo from '../assets/brand/izzy-logo-light.svg'
import lightWordmark from '../assets/brand/izzy-wordmark-light.svg'

export function BrandLogo({ context, light = false }: { context: string; light?: boolean }) {
  return <span className={`wordmark${light ? '' : ' dark'}`}>
    <img className="brand-logo" src={light ? lightLogo : darkLogo} alt="IZZY" width="398" height="106" />
    <span className="brand-context">/ {context}</span>
  </span>
}

export function RemoteBrand({ sessionId }: { sessionId?: string }) {
  return <span className="eyebrow remote-brand">
    <img src={lightWordmark} alt="IZZY" width="278" height="64" />
    <span>REMOTE{sessionId ? ` · ${sessionId}` : ''}</span>
  </span>
}
