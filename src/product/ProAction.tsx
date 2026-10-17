import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useAccount } from '../account/AccountProvider'
import { accountApi, accountMessage } from '../account/api'
import { useProduct } from './ProductProvider'
import { track } from './events'
import { rememberPurchaseReturn } from './navigation'
import { PurchaseTerms } from '../legal/LegalLinks'

export function ProAction({ source, label = 'Get Izzy Pro', returnTo = '/pro' }: { source: string; label?: string; returnTo?: string }) {
  const { status, verified } = useAccount()
  const product = useProduct()
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('')
  if (verified && status?.user?.pro) return <a className="action-primary" href="/">Pro active · Open Izzy <ArrowUpRight size={17} /></a>
  if (!product?.checkout_available) return <div className="purchase-unavailable"><span>{product ? 'Purchases opening soon' : 'Checking availability…'}</span></div>
  const purchase = async () => {
    track('pro_checkout_clicked', { source })
    if (!status?.user) { window.location.assign(`/account?returnTo=${encodeURIComponent(returnTo)}`); return }
    setBusy(true); setNotice('')
    rememberPurchaseReturn(returnTo, status.user.id)
    try {
      const result = await accountApi<{ status: string; checkout_url: string | null }>('/checkout', 'POST', { provider: 'lava', currency: 'USD', confirm_switch: false })
      if (result.status === 'pending' && result.checkout_url) window.location.assign(result.checkout_url)
      else { setNotice('Review your purchase status before trying again.'); setBusy(false) }
    } catch (error) { setNotice(accountMessage(error)); setBusy(false) }
  }
  return <div className="purchase-action"><button className="action-primary" disabled={busy} onClick={() => void purchase()}>{busy ? 'Preparing checkout…' : label}<ArrowUpRight size={17} /></button>
    <PurchaseTerms />
    {notice && <p className="purchase-notice" role="status">{notice} <a href="/account">Review purchases</a></p>}</div>
}
