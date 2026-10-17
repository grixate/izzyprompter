import { useEffect, useState } from 'react'
import { legalLinks } from './siteDetails'

export function LegalLinks({ beforeNavigate, offlineHint = false }: { beforeNavigate?: () => void; offlineHint?: boolean }) {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  return <div className="legal-links-group"><nav className="legal-links" aria-label="Legal">
    {legalLinks.map(link => <a key={link.href} href={link.href} onClick={beforeNavigate}>{link.label}</a>)}
  </nav>{offlineHint && !online && <span className="legal-online-note">Policies are available online.</span>}</div>
}

export function PurchaseTerms() {
  // Keep a running take or an open finish dialog intact while reading policies.
  return <p className="purchase-terms">By purchasing, you agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms</a> and <a href="/refunds" target="_blank" rel="noreferrer">Refund Policy</a>.</p>
}
