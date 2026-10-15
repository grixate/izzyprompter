import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { BrandLogo } from './BrandLogo'
import { useAccount } from '../account/AccountProvider'
import { Discount } from '../product/ProductProvider'
import { track } from '../product/events'

export function ModeSwitch({ mode, disabled = false, beforeNavigate }: { mode: 'online' | 'offline'; disabled?: boolean; beforeNavigate?: () => void }) {
  const change = (next: 'online' | 'offline') => {
    if (next === mode || disabled) return
    beforeNavigate?.()
    try { localStorage.setItem('izzy:connection-mode', next) } catch { /* Optional preference. */ }
    track('connection_mode_changed', { from: mode, to: next, surface: 'nav' })
    window.location.assign(next === 'online' ? '/' : '/local')
  }
  return <div className="mode-choice" role="group" aria-label="Connection mode" title={disabled ? 'End the current session to change connection mode' : undefined}>
    <button disabled={disabled} aria-pressed={mode === 'online'} onClick={() => change('online')}>Online</button>
    <button disabled={disabled} aria-pressed={mode === 'offline'} onClick={() => change('offline')}>Offline</button>
  </div>
}
export function PublicNav({ mode = 'online', beforeNavigate, light = false }: { mode?: 'online' | 'offline'; beforeNavigate?: () => void; light?: boolean }) {
  const { status } = useAccount()
  const [open, setOpen] = useState(false)
  return <header className="public-nav">
    <a className="public-brand" href="/" aria-label="IZZY home" onClick={beforeNavigate}><BrandLogo context="TELEPROMPTER" light={light} /></a>
    <nav className="public-links" aria-label="Main navigation">
      <a className="nav-pro" href="/pro" onClick={() => { beforeNavigate?.(); track('homepage_pro_clicked', { source: 'nav' }) }}>Pro <Discount /></a>
    </nav>
    <div className="public-nav-actions"><ModeSwitch mode={mode} beforeNavigate={beforeNavigate} />
      <a className="nav-account" href="/account" onClick={beforeNavigate}>{status?.user ? 'My scripts' : 'Log in'}</a>
      <button className="menu-toggle" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
    </div>
    {open && <nav className="mobile-nav" id="mobile-nav" aria-label="Mobile navigation"><a href="/pro" onClick={beforeNavigate}>Izzy Pro <Discount /></a><a href="/account">{status?.user ? 'My scripts' : 'Log in'}</a></nav>}
  </header>
}
export function PublicFooter({ light = false }: { light?: boolean }) {
  return <footer className="public-footer"><a href="/" aria-label="IZZY home"><BrandLogo context="" light={light} /></a><nav aria-label="Footer"><a href="/pro">Lifetime Pro</a><a href="/local">Offline</a><a href="/account">My scripts</a></nav></footer>
}
