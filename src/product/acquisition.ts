// First-party campaign measurement. Never send a URL, fragment, script, email or event properties.
type Labels = { source: string; medium: string; campaign: string; content: string; entry: string }
type Visit = { token: string; until: number; labels: Labels }
const key = 'izzy:campaign-visit:v1'
const excludedKey = 'izzy:analytics:exclude'
let current: Visit | null = null
let ready: Promise<void> | undefined

export function analyticsExcluded() {
  try {
    return navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true ||
      navigator.webdriver || localStorage.getItem(excludedKey) === '1'
  } catch { return true }
}

function readVisit(): Visit | null {
  try {
    const visit = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Visit | null
    return visit && typeof visit.token === 'string' && visit.token.length <= 512 && visit.until > Date.now() &&
      visit.labels && Object.values(visit.labels).every(v => typeof v === 'string' && /^[a-z0-9_-]{0,48}$/.test(v)) ? visit : null
  } catch { return null }
}

const label = (value: string | null) => {
  const normalized = value?.toLowerCase() ?? ''
  return /^[a-z0-9][a-z0-9_-]{0,47}$/.test(normalized) ? normalized : ''
}

export function initializeAnalytics() {
  if (ready) return
  try {
    const query = new URLSearchParams(window.location.search)
    if (query.get('analytics') === 'off') localStorage.setItem(excludedKey, '1')
    if (analyticsExcluded()) { sessionStorage.removeItem(key); return }
    const entry = ({ '/': 'home', '/pro': 'pro', '/skins': 'skins', '/account': 'account' } as Record<string, string>)[window.location.pathname]
    if (!entry || window.location.protocol !== 'https:' && window.location.protocol !== 'http:') return
    const saved = readVisit()
    const tagged = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].some(k => query.has(k))
    let referral = ''
    try {
      const ref = new URL(document.referrer)
      if (ref.origin !== window.location.origin) {
        const known: Record<string, string> = { 't.me': 'telegram', 'telegram.org': 'telegram', 'x.com': 'x', 't.co': 'x',
          'twitter.com': 'x', 'instagram.com': 'instagram', 'l.instagram.com': 'instagram', 'facebook.com': 'facebook',
          'linkedin.com': 'linkedin', 'youtube.com': 'youtube', 'google.com': 'google', 'bing.com': 'bing' }
        referral = known[ref.hostname.replace(/^www\./, '')] ?? 'other-referral'
      }
    } catch { /* Missing referrers stay direct/unknown. */ }
    const labels: Labels = !tagged && saved ? saved.labels : {
      source: label(query.get('utm_source')) || referral || 'direct', medium: label(query.get('utm_medium')),
      campaign: label(query.get('utm_campaign')), content: label(query.get('utm_content')), entry,
    }
    if (saved && tagged && ['source', 'medium', 'campaign', 'content'].every(k => labels[k as keyof Labels] === saved.labels[k as keyof Labels])) labels.entry = saved.labels.entry
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 2000)
    ready = fetch('/api/analytics/visit', { method: 'POST', credentials: 'omit', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...labels, token: saved?.token }) })
      .then(async response => {
        if (!response.ok || response.status === 204) return
        const data = await response.json()
        if (typeof data.token !== 'string' || data.token.length > 512) return
        current = { token: data.token, until: saved && saved.token === data.token ? saved.until : Date.now() + 1_800_000, labels }
        try { sessionStorage.setItem(key, JSON.stringify(current)) } catch { /* Memory-only measurement remains optional. */ }
      }).catch(() => {}).finally(() => window.clearTimeout(timer))
  } catch { /* Measurement must never affect prompting. */ }
}

export function analyticsHeaders(): Record<string, string> {
  if (analyticsExcluded()) return {}
  const visit = current ?? readVisit()
  return visit && visit.until > Date.now() ? { 'x-izzy-visit': visit.token } : {}
}

export function measureStart() {
  if (analyticsExcluded()) return
  void (ready ?? Promise.resolve()).then(() => {
    const token = analyticsHeaders()['x-izzy-visit']
    if (token) void fetch('/api/analytics/event', { method: 'POST', credentials: 'omit', keepalive: true,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, event: 'start_clicked' }) }).catch(() => {})
  })
}
