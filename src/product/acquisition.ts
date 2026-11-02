// First-party campaign measurement. Never send a URL, fragment, script, email or event properties.
type Labels = { source: string; medium: string; campaign: string; content: string; entry: string }
type Visit = { token: string; until: number; labels: Labels }
const key = 'izzy:campaign-visit:v1'
const excludedKey = 'izzy:analytics:exclude'
const loginKey = 'izzy:campaign-login:v1'
let current: Visit | null = null
let ready: Promise<void> | undefined

export function analyticsExcluded() {
  try {
    return navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true ||
      navigator.webdriver || localStorage.getItem(excludedKey) === '1'
  } catch { return true }
}

function parseVisit(value: string | null): Visit | null {
  try {
    const visit = JSON.parse(value ?? 'null') as Visit | null
    return visit && typeof visit.token === 'string' && visit.token.length <= 512 && visit.until > Date.now() &&
      visit.labels && Object.values(visit.labels).every(v => typeof v === 'string' && /^[a-z0-9_-]{0,48}$/.test(v)) ? visit : null
  } catch { return null }
}

function readVisit(): Visit | null {
  try {
    const visit = parseVisit(sessionStorage.getItem(key))
    if (visit) return visit
    if (window.location.pathname === '/account/login') {
      const handoff = parseVisit(localStorage.getItem(loginKey))
      localStorage.removeItem(loginKey)
      if (handoff) { sessionStorage.setItem(key, JSON.stringify(handoff)); return handoff }
    }
    return null
  } catch { return null }
}

// Email links commonly open another tab. This carries measurement only, never login authority.
export function rememberCampaignForLogin() {
  try {
    if (analyticsExcluded()) return
    const visit = current ?? readVisit()
    if (visit && visit.until > Date.now()) localStorage.setItem(loginKey, JSON.stringify({
      ...visit, until: Math.min(visit.until, Date.now() + 900_000),
    }))
  } catch { /* Optional handoff must never prevent delivery of a sign-in link. */ }
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
    if (analyticsExcluded()) { sessionStorage.removeItem(key); localStorage.removeItem(loginKey); return }
    if (!parseVisit(localStorage.getItem(loginKey))) localStorage.removeItem(loginKey)
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
    ready = fetch('/api/analytics/visit', { method: 'POST', credentials: 'same-origin', signal: controller.signal,
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
    if (token) void fetch('/api/analytics/event', { method: 'POST', credentials: 'same-origin', keepalive: true,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, event: 'start_clicked' }) }).catch(() => {})
  })
}
