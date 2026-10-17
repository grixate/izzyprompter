import details from './siteDetails.json'

type SiteDetails = {
  operatorName: string | null
  operatorCountry: string | null
  operatorAddress: string | null
  supportEmail: string | null
  policiesApproved: boolean
  updatedDate: string
}

// Public information only. A sending identity is not proof of a receiving inbox.
export const siteDetails: SiteDetails = details
export const legalReady = siteDetails.policiesApproved
  && Boolean(siteDetails.operatorName?.trim() && siteDetails.operatorCountry?.trim() && siteDetails.operatorAddress?.trim())
  && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(siteDetails.supportEmail ?? '')

export const legalLinks = [
  { href: '/terms', label: 'Terms', title: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy', title: 'Privacy Policy' },
  { href: '/refunds', label: 'Refunds', title: 'Refund Policy' },
  { href: '/contact', label: 'Contact', title: 'Contact' },
] as const

export const legalDocument = (pathname: string) => legalLinks.find(link => pathname === link.href || pathname === `${link.href}/`)
