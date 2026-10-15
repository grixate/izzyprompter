import { ArrowUpRight, Monitor, ScanLine, SlidersHorizontal } from 'lucide-react'
import { RemoteInstrument } from './RemoteInstrument'
import { track } from '../product/events'

export function HomeStory() {
  return <>
    <section className="how-section page-width" id="how-it-works" aria-label="How it works">
      <div className="how-steps">
        <article><Monitor size={24} strokeWidth={1.3} /><h3>Paste your script.</h3><p>Write here or import a text file.</p></article>
        <article><ScanLine size={24} strokeWidth={1.3} /><h3>Pair your phone.</h3><p>Open the reading screen and scan its QR.</p></article>
        <article><SlidersHorizontal size={24} strokeWidth={1.3} /><h3>Control the take.</h3><p>Play, pause and find your pace.</p></article>
      </div>
    </section>
    <section className="home-offline"><div className="page-width"><h2>Online when it's easy.<br /><em>Offline when it matters.</em></h2><div className="offline-story-bottom"><p>Prepare your browser and script. Prompt offline for free.<br />Direct phone pairing is experimental.</p><a className="action-text" href="/local">Explore Offline <ArrowUpRight size={18} /></a></div></div></section>
    <section className="home-pro page-width"><div className="home-pro-copy"><h2>Make<br /><em>Izzy yours.</em></h2><p>Fifteen Pro finishes. One lifetime purchase.</p><a className="action-primary" href="/pro" onClick={() => track('homepage_pro_clicked', { source: 'home_teaser' })}>Explore Izzy Pro <ArrowUpRight size={18} /></a></div><div className="home-pro-objects"><RemoteInstrument skin="signal" phase={1.2} /><RemoteInstrument skin="ivory" phase={.2} /></div></section>
  </>
}
