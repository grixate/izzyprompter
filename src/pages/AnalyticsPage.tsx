import { useEffect, useState, type FormEvent } from 'react'
import { ArrowUpRight, Copy, RefreshCw, LockKeyhole } from 'lucide-react'
import { BrandLogo } from '../components/BrandLogo'
import { useAccount } from '../account/AccountProvider'
import { accountApi } from '../account/api'
import './analytics.css'

type Counts = Record<string, number>
type Campaign = { source: string; medium: string; campaign: string; content: string; entry: string; counts: Counts }
type Report = { enabled: boolean; days: number; from: string; through: string; totals: Counts;
  campaigns: Campaign[]; daily: { day: string; counts: Counts }[];
  payments: { campaign: Omit<Campaign, 'counts'> & { day: string }; status: string; currency: string; count: number; amount_minor: number }[] }
const number = (value = 0) => value.toLocaleString('en-GB')
const rate = (value = 0, visits = 0) => visits ? `${(100 * value / visits).toFixed(1)}%` : '—'
const date = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const steps = [ ['start_clicked', 'Start clicked'], ['session_created', 'Take created'],
  ['remote_connected', 'Remote connected'], ['playback_started', 'Playback started'], ['signed_in', 'Signed in'], ['checkout_started', 'Checkout opened'] ]

export function AnalyticsPage() {
  const { status, loading, verified } = useAccount()
  const [days, setDays] = useState(30)
  const [report, setReport] = useState<Report | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const allowed = verified && status?.analytics_admin === true
  useEffect(() => { document.title = 'Campaigns — IZZY' }, [])
  useEffect(() => {
    setReport(null)
    if (!allowed) return
    // Opening the owner report also excludes this browser from future measurement.
    try { localStorage.setItem('izzy:analytics:exclude', '1'); sessionStorage.removeItem('izzy:campaign-visit:v1') } catch { /* Optional. */ }
    let active = true
    setBusy(true); setNotice('')
    void accountApi<Report>(`/analytics?days=${days}`).then(data => { if (active) setReport(data) })
      .catch(() => { if (active) setNotice('The report could not be loaded. Try refreshing; the existing counters are kept.') })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [allowed, status?.user?.id, days, revision])

  const counts = report?.totals ?? {}
  return <main className="product-page analytics-page">
    <header className="analytics-header"><a href="/" aria-label="IZZY home"><BrandLogo /></a>
      <span><LockKeyhole size={13} aria-hidden="true" /> Private report</span><a href="/account">My workspace <ArrowUpRight size={14} /></a></header>
    <div className="analytics-width">
      <div className="analytics-intro"><div><p className="product-kicker">IZZY / ACQUISITION</p><h1>From post<br />to first take.</h1><p>See what brings people in. Find what gets them reading.</p></div>
        {allowed && <div className="analytics-controls"><label>Reporting window<select value={days} onChange={e => setDays(Number(e.target.value))}>
          <option value={1}>Today (UTC)</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label>
          <button disabled={busy} onClick={() => setRevision(v => v + 1)}><RefreshCw size={14} />{busy ? 'Loading…' : 'Refresh'}</button>
          {report && <small>{date(report.from)} – {date(report.through)} · UTC</small>}</div>}</div>
      {loading ? <p role="status">Checking report access…</p> : !allowed ? <section className="analytics-empty">
        <LockKeyhole size={24} /><h2>For the owner’s eyes.</h2><p>{!verified ? 'Connect to IZZY to verify access.' : status?.user ? 'This account does not have access to campaign reports.' : 'Sign in with an authorized owner account to view campaign activity.'}</p>
        <a className="action-primary" href="/account">Open account <ArrowUpRight size={16} /></a></section> : <>
        {notice && <p className="analytics-notice" role="alert">{notice}</p>}
        {report && <>
          {!report.enabled && <p className="analytics-notice" role="status">Collection is disabled in this environment. Any saved history remains visible.</p>}
          <div className="analytics-stats">
            {[[counts.site_visitors, 'Visitor days', 'Sum of estimated daily visitors'], [counts.visits, 'Visits', 'Up to 30 minutes per visit'],
              [counts.page_views, 'Page views', 'Public pages in tracked visits'], [counts.playback_started, 'Visits with playback', `${rate(counts.playback_started, counts.visits)} of visits`]].map(([value, title, note]) =>
              <section key={String(title)}><span>{String(title)}</span><strong>{number(Number(value) || 0)}</strong><small>{String(note)}</small></section>)}
          </div>
          {!counts.visits && <p className="analytics-notice" role="status">No measured visits in this window yet. Create a tagged link below. Earlier traffic cannot be reconstructed.</p>}
          <section className="analytics-trend"><div className="analytics-section-heading"><h2>Visits over time</h2><span>Daily · UTC</span></div>
            <div className="analytics-bars" role="img" aria-label={report.daily.length ? report.daily.map(d => `${d.day}: ${d.counts.visits ?? 0} visits`).join('; ') : 'No recorded visits'}>
              {Array.from({ length: days }, (_, i) => {
                const day = new Date(`${report.from}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + i)
                const key = day.toISOString().slice(0, 10)
                const value = report.daily.find(d => d.day === key)?.counts.visits ?? 0
                const max = Math.max(1, ...report.daily.map(d => d.counts.visits ?? 0))
                return <div key={key} title={`${date(key)}: ${number(value)} visits`}><i style={{ height: `${Math.max(1, value / max * 100)}%` }} data-empty={!value} /></div>
              })}</div><div className="analytics-axis"><span>{date(report.from)}</span><span>{date(report.through)}</span></div>
          </section>
          <section className="analytics-campaigns"><div className="analytics-section-heading"><div><p className="product-kicker">01 / CAMPAIGNS</p><h2>Which posts lead to use?</h2></div><span>{report.campaigns.length} sources & posts</span></div>
            <div className="analytics-table-wrap" tabIndex={0} role="region" aria-label="Campaign performance, scroll horizontally on small screens"><table><caption className="sr-only">Visit activity by campaign and post</caption><thead><tr><th scope="col">Source / post</th><th scope="col">Visitor days</th><th scope="col">Visits</th><th scope="col">Take created</th><th scope="col">Remote</th><th scope="col">Playback</th><th scope="col">Visit → playback</th></tr></thead><tbody>
              {report.campaigns.map((c, i) => <tr key={i}><th scope="row"><strong>{c.source === 'direct' ? 'Direct / unknown' : c.source}{c.content && ` / ${c.content}`}</strong><small>{[c.campaign || 'Untagged', c.medium, c.entry].filter(Boolean).join(' · ')}</small></th><td>{number(c.counts.visitors)}</td><td>{number(c.counts.visits)}</td><td>{number(c.counts.session_created)}</td><td>{number(c.counts.remote_connected)}</td><td>{number(c.counts.playback_started)}</td><td><b>{rate(c.counts.playback_started, c.counts.visits)}</b></td></tr>)}
              {!report.campaigns.length && <tr><td colSpan={7}>Campaign activity will appear here after collection starts.</td></tr>}
            </tbody></table></div>
          </section>
          <section className="analytics-actions"><div><p className="product-kicker">02 / ACTIVATION</p><h2>What happened<br />after the visit?</h2><p>Each action counts once per visit. Actions can happen in any order; these are separate conversion goals.</p></div>
            <dl>{steps.map(([key, name]) => <div key={key}><dt>{name}</dt><dd>{number(counts[key])}<small>{rate(counts[key], counts.visits)} of visits</small></dd></div>)}</dl></section>
          <section className="analytics-payments"><div className="analytics-section-heading"><div><p className="product-kicker">03 / PURCHASES</p><h2>Verified payment states</h2></div></div>
            <p>Current states of production checkouts attributed to visits in this date window. Refunds can change these totals. Amounts are gross, grouped by currency.</p>
            {!report.payments.length ? <p>No attributed paid, refunded or disputed checkouts in this window.</p> : <div className="analytics-table-wrap"><table><thead><tr><th scope="col">Campaign / post</th><th scope="col">State</th><th scope="col">Checkouts</th><th scope="col">Amount</th></tr></thead><tbody>{report.payments.map((p, i) => <tr key={i}><th scope="row">{p.campaign.source} / {p.campaign.campaign || 'Untagged'} / {p.campaign.content || '—'}</th><td>{p.status}</td><td>{number(p.count)}</td><td>{new Intl.NumberFormat('en-GB', { style: 'currency', currency: p.currency }).format(p.amount_minor / 100)}</td></tr>)}</tbody></table></div>}
          </section>
        </>}
        <CampaignLinkBuilder />
        <footer className="analytics-footnote"><p>Daily visitor estimates use a rotating network/browser hash held only in server memory. Shared networks, browser changes and restarts affect accuracy. Visitor days are not unique people across the whole period.</p><p>Counts are best effort, update about once a minute, and may lose unflushed activity on a crash. Attribution lasts up to 30 minutes in the same browser tab. Existing takes can contribute actions until midnight UTC. Bots, opted-out browsers, Do Not Track and Global Privacy Control requests are excluded. This browser is excluded when you open the owner report.</p></footer>
      </>}
    </div>
  </main>
}

function CampaignLinkBuilder() {
  const [source, setSource] = useState('telegram')
  const [campaign, setCampaign] = useState('launch')
  const [post, setPost] = useState('demo_01')
  const [entry, setEntry] = useState('/')
  const [notice, setNotice] = useState('')
  const valid = [source, campaign, post].every(v => /^[a-z0-9][a-z0-9_-]{0,47}$/.test(v))
  const link = valid ? `https://izzyprompter.com${entry}?${new URLSearchParams({ utm_source: source, utm_medium: 'social', utm_campaign: campaign, utm_content: post })}` : ''
  const copy = async (event: FormEvent) => {
    event.preventDefault()
    try { await navigator.clipboard.writeText(link); setNotice('Link copied. Use a different post label for each post.') }
    catch { setNotice('Select and copy the link from the field below.') }
  }
  return <section className="analytics-builder"><div><p className="product-kicker">04 / YOUR NEXT POST</p><h2>Give every post<br />its own link.</h2><p>Keep the campaign the same. Change the post label to compare a demo, a story, or a follow-up.</p></div>
    <form onSubmit={event => void copy(event)}><div className="analytics-link-fields">{[['Source', source, setSource], ['Campaign', campaign, setCampaign], ['Post', post, setPost]].map(([name, value, setter]) => <label key={String(name)}>{String(name)}<input required pattern="[a-z0-9][a-z0-9_-]{0,47}" maxLength={48} value={String(value)} onChange={e => (setter as (v: string) => void)(e.target.value.toLowerCase())} /></label>)}
      <label>Landing page<select value={entry} onChange={e => setEntry(e.target.value)}><option value="/">Home</option><option value="/pro">Pro</option><option value="/skins">Skins</option></select></label></div>
      <label className="analytics-link-output">Post link<input readOnly aria-label="Post link" value={link} onFocus={e => e.target.select()} /></label>
      <button className="action-primary" disabled={!valid}><Copy size={15} />Copy post link</button><p role="status">{notice || 'Use lowercase letters, numbers, underscores or hyphens.'}</p>
    </form></section>
}
