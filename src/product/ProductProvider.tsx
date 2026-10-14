import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiUrl } from '../realtime/endpoints'

export type Product = {
  id: string; name: string; currency: 'USD'; price_minor: number; reference_price_minor: number
  discount_percent: number; launch_offer: boolean; checkout_available: boolean; free_script_limit: number
}
const Context = createContext<Product | null>(null)
export function ProductProvider({ children }: { children: ReactNode }) {
  const [product, setProduct] = useState<Product | null>(null)
  useEffect(() => {
    let active = true
    let controller: AbortController | null = null
    const load = async () => {
      controller?.abort(); const request = new AbortController(); controller = request
      const timer = window.setTimeout(() => request.abort(), 8000)
      try {
        const response = await fetch(apiUrl('product'), { signal: request.signal })
        if (!response.ok) throw new Error()
        const data: Product = await response.json()
        if (data.id !== 'lifetime_pro' || data.currency !== 'USD' || !Number.isSafeInteger(data.price_minor) || data.price_minor <= 0) throw new Error()
        if (active && controller === request) setProduct(data)
      } catch { if (active && controller === request) setProduct(null) }
      finally { window.clearTimeout(timer) }
    }
    void load()
    window.addEventListener('online', load); window.addEventListener('focus', load)
    return () => { active = false; controller?.abort(); window.removeEventListener('online', load); window.removeEventListener('focus', load) }
  }, [])
  return <Context value={product}>{children}</Context>
}
export const useProduct = () => useContext(Context)
export const money = (minor: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(minor / 100)
export function Offer({ compact = false }: { compact?: boolean }) {
  const product = useProduct()
  if (!product) return <span className="offer-loading">Price temporarily unavailable</span>
  return <span className={`product-offer ${compact ? 'offer-compact' : ''}`}>
    {product.launch_offer && product.reference_price_minor > product.price_minor && <del>{money(product.reference_price_minor)}</del>}
    <strong>{money(product.price_minor)}</strong>
    {!compact && <span>One payment.<br />Yours for good.</span>}
  </span>
}
export function Discount() {
  const product = useProduct()
  return product?.launch_offer && product.discount_percent > 0 ? <span className="discount-pill">−{product.discount_percent}%</span> : null
}
