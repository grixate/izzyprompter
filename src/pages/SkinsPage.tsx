import { useEffect, useState } from 'react'
import { ArrowUpRight, Check, ChevronDown } from 'lucide-react'
import { PublicNav, PublicFooter } from '../components/PublicNav'
import { RemoteInstrument } from '../components/RemoteInstrument'
import { useAccount } from '../account/AccountProvider'
import { accountApi, type AccountStatus } from '../account/api'
import { skins, preferredSkin, saveSkin } from '../product/catalog'
import { FinishNavigation } from '../product/FinishNavigation'
import { Offer } from '../product/ProductProvider'
import { ProAction } from '../product/ProAction'
import { track } from '../product/events'

export function SkinsPage() {
  const { status, verified } = useAccount()
  const pro = verified && !!status?.user?.pro
  const [selected, setSelected] = useState(preferredSkin)
  const [index, setIndex] = useState(() => {
    const id = new URLSearchParams(location.search).get('skin')
    return Math.max(0, skins.findIndex(skin => skin.id === id))
  })
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const skin = skins[index]
  const isSelected = selected === skin.id && (!skin.pro || pro)

  useEffect(() => { document.title = 'Remote finishes — IZZY'; track('skins_opened') }, [])
  useEffect(() => { track('skin_previewed', { skin: skin.id, source: 'library' }) }, [skin.id])

  const browse = (next: number) => {
    setIndex(next)
    setNotice('')
    const url = new URL(location.href)
    url.searchParams.set('skin', skins[next].id)
    history.replaceState(history.state, '', url)
  }
  const apply = async () => {
    setBusy(true)
    try {
      const entitled = !skin.pro || !!(await accountApi<AccountStatus>()).user?.pro
      if (entitled && saveSkin(skin.id)) {
        setSelected(skin.id)
        setNotice(`${skin.name} selected for this browser's remote.`)
      } else {
        setNotice('Could not save this finish. Try again.')
      }
    } catch {
      setNotice('Could not save this finish. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="product-page skins-page"><PublicNav />
    <section className="collection-intro page-width">
      <h1>One remote.<br /><em>Many personalities.</em></h1>
      <p>Play, jog, and adjust speed on every finish.</p>
    </section>
    <section className="skin-showroom page-width" aria-label="Remote skin library">
      <FinishNavigation label="Browse all finishes" disabled={busy} onStep={direction => browse((index + direction + skins.length) % skins.length)}>
        <div className="skin-showroom-choice">
          <div className="skin-showroom-count" role="status">
            <span className="sr-only">{skin.name}, finish </span>{index + 1} / {skins.length}
          </div>
          <div className="skin-showroom-picker">
            <select aria-label="Choose a finish" value={index} disabled={busy} onChange={event => browse(Number(event.target.value))}>
              {skins.map((finish, position) => <option key={finish.id} value={position}>{finish.name} · {finish.pro ? 'Pro' : 'Free'}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
        </div>
      </FinishNavigation>
      <div className="skin-showroom-instrument">
        <RemoteInstrument key={skin.id} skin={skin.id} />
      </div>
      <div className="skin-showroom-details">
        <p className="skin-showroom-material">{skin.material}</p>
        <h2>{skin.name}</h2>
        <p>{skin.note}</p>
        {isSelected && <p className="skin-showroom-selected"><Check size={14} aria-hidden="true" /> Selected for your remote</p>}
        {!skin.pro || pro
          ? <button className="action-primary" disabled={busy} onClick={() => void apply()}>{busy ? 'Applying…' : isSelected ? 'Apply this finish' : 'Apply to my remote'}<Check size={17} aria-hidden="true" /></button>
          : <div onClick={() => track('locked_skin_upgrade_clicked', { skin: skin.id, source: 'skin_preview' })}>
              <Offer compact />
              <ProAction source="skin_library" label="Unlock with Pro" returnTo={`/skins?skin=${skin.id}`} />
            </div>}
        <p role="status">{notice}</p>
      </div>
    </section>
    <section className="collection-outro page-width"><p>The look changes.<br /><em>The feeling stays familiar.</em></p><a className="action-text" href="/pro">Meet Lifetime Pro <ArrowUpRight size={17} /></a></section>
    <PublicFooter />
  </main>
}
