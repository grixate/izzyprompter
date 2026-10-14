import { ArrowUpRight, Monitor, ScanLine, SlidersHorizontal } from 'lucide-react'
import { RemoteInstrument } from './RemoteInstrument'
import { Discount } from '../product/ProductProvider'
import { track } from '../product/events'

export function HomeStory() {
  return <>
    <section className="how-section page-width" id="how-it-works"><div className="section-heading"><span className="product-kicker">A SMALL SETUP. A BETTER TAKE.</span><h2>Paste. Pair.<br /><em>Find your pace.</em></h2></div><div className="how-steps">
      <article><Monitor size={24} strokeWidth={1.3} /><span>01</span><h3>Open Izzy.</h3><p>Paste your words or import a script. Your browser is the prompter.</p></article>
      <article><ScanLine size={24} strokeWidth={1.3} /><span>02</span><h3>Scan with your phone.</h3><p>Open the reading screen. Scan its QR code to connect the remote.</p></article>
      <article><SlidersHorizontal size={24} strokeWidth={1.3} /><span>03</span><h3>Stay with the story.</h3><p>Play, pause, rewind and change the pace. All from the jog wheel.</p></article>
    </div></section>
    <section className="home-offline"><div className="page-width"><span className="product-kicker">YOUR TAKE. YOUR CONNECTION.</span><h2>Online when it's easy.<br /><em>Offline when it matters.</em></h2><div className="offline-story-bottom"><p>Pair online in a scan. Or prepare your browser and script to prompt offline on this device. The direct phone remote is an experimental preview.</p><a className="action-text" href="/local">Explore Offline <ArrowUpRight size={18} /></a></div></div></section>
    <section className="home-pro page-width"><div className="home-pro-copy"><span className="product-kicker">IZZY PRO / LIFETIME <Discount /></span><h2>Make<br /><em>Izzy yours.</em></h2><p>A little ceramic. A little vinyl.<br />A remote with your kind of character.</p><a className="action-primary" href="/pro" onClick={() => track('homepage_pro_clicked', { source: 'home_teaser' })}>Explore Izzy Pro <ArrowUpRight size={18} /></a><small>One payment. No subscription.</small></div><div className="home-pro-objects"><RemoteInstrument skin="signal" phase={1.2} /><RemoteInstrument skin="ivory" phase={.2} /></div></section>
  </>
}
