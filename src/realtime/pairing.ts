// Presentation only: this describes the pairing URL, not network reachability
// or server authorization. The server remains authoritative for both.
export function pairingEnvironment(origin: string): 'loopback' | 'lan' | 'website' {
  const hostname = new URL(origin).hostname.toLowerCase()
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '[::1]') return 'loopback'
  const ipv4 = hostname.split('.').map(Number)
  if (ipv4.length === 4 && ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [a, b] = ipv4
    if (a === 127) return 'loopback'
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) return 'lan'
  }
  if (hostname.endsWith('.local') || /^\[(?:f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)/.test(hostname)) return 'lan'
  return 'website'
}
