import { useEffect, useState } from 'react'
import { ArrowUpRight, Check } from 'lucide-react'
import { PublicNav, PublicFooter } from '../components/PublicNav'
import { RemoteInstrument } from '../components/RemoteInstrument'
import { Offer } from '../product/ProductProvider'
import { ProAction } from '../product/ProAction'
import { skins, skinById, proSkinCount, type SkinId } from '../product/catalog'
import { track } from '../product/events'

const heroFinishes: SkinId[] = ['groove', 'clear', 'spool', 'glaze', 'vector']
export function ProPage() {
  const [finish, setFinish] = useState<SkinId>('groove')
  const [demoPlaying, setDemoPlaying] = useState(false)
  useEffect(() => { document.title = 'Izzy Pro — Yours for good'; track('pro_page_viewed') }, [])
  return <main className="product-page pro-page"><PublicNav light />
    <section className="pro-hero page-width">
      <div className="pro-hero-copy"><h1>Make it<br /><em>yours.</em></h1><p>Unlimited scripts. Project folders. Reading profiles. {proSkinCount} finishes.</p><div className="pro-hero-offer"><Offer /><ProAction source="pro_hero" /><p className="lifetime-note">Lifetime access while IZZY operates. No subscription. <a href="/terms">Read the terms</a>.</p></div></div>
      <div className="pro-hero-object"><div className="hero-orbit" aria-hidden="true" /><RemoteInstrument skin={finish} playing={demoPlaying} motion={demoPlaying} />
        <div className="hero-finish-picker"><span>{skinById(finish).name}</span><div role="group" aria-label="Preview a remote finish">{heroFinishes.map(id => <button key={id} className={`finish-dot finish-dot--${id}`} aria-label={`Preview ${skinById(id).name}`} aria-pressed={finish === id} onClick={() => { setFinish(id); track('skin_previewed', { skin: id, source: 'pro_hero' }) }} />)}</div></div>
        <button className="mechanism-demo" aria-pressed={demoPlaying} onClick={() => setDemoPlaying(value => !value)}>{demoPlaying ? 'Pause preview' : 'Play preview'}</button>
      </div>
    </section>
    <section className="pro-material-section" id="pro-finishes">
      <div className="page-width material-heading"><h2>Find your<br /><em>finish.</em></h2></div>
      <div className="material-parade">{(['groove', 'clear', 'spool'] as SkinId[]).map((id, index) => <figure key={id}><RemoteInstrument skin={id} phase={index * .8} /><figcaption>{skinById(id).name}</figcaption></figure>)}</div>
    </section>
    <section className="pro-collection page-width">
      <div className="section-heading"><h2>{proSkinCount} finishes.<br /><em>One familiar gesture.</em></h2></div>
      <div className="pro-skin-strip">{(['glaze', 'pop', 'moss', 'mono'] as SkinId[]).map((id, index) => <a href={`/skins?skin=${id}`} key={id} aria-label={`Explore ${skinById(id).name}`}><RemoteInstrument skin={id} phase={index * .7} /><span>{skinById(id).name}<ArrowUpRight size={16} /></span></a>)}</div>
      <a className="action-text" href="/skins">Explore all {skins.length} finishes <ArrowUpRight size={18} /></a>
    </section>
    <section className="pro-workflow"><div className="page-width workflow-grid">
      <div><h2>More room<br /><em>for your words.</em></h2><ul><li><Check size={16} />Unlimited saved scripts</li><li><Check size={16} />Project folders</li><li><Check size={16} />Reading profiles: speed, text size, spacing and mirroring</li></ul><p className="pro-profile-copy">Save setups for interviews, presentations or a faster read. Choose a default profile or switch before each take.</p>
        <details className="pro-limits"><summary>Script limits</summary><p>Pro removes the three-script count limit. Individual script size and storage limits still apply.</p></details>
      </div>
      <div className="workflow-proof" aria-label="Example account script library"><div><span>Example library</span></div>{['A better first take', 'Notes from the studio', 'The next big idea'].map(title => <article key={title}><h3>{title}</h3><ArrowUpRight size={18} /></article>)}</div>
    </div></section>
    <section className="pro-reassurance page-width"><h2>Offline<br /><em>comes free.</em></h2><div><p>Prepare your browser and script, then prompt offline. Direct phone pairing is experimental.</p><a className="action-text" href="/local">Prepare for Offline <ArrowUpRight size={17} /></a></div></section>
    <section className="pro-finale"><div className="page-width"><div><h2>Yours.<br /><em>For good.</em></h2><Offer /><ProAction source="pro_final" /></div><RemoteInstrument skin="signal" phase={1.8} /></div></section>
    <PublicFooter light />
  </main>
}
