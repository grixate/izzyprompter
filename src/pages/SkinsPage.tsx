import { useEffect, useState } from 'react'
import { ArrowUpRight, Check } from 'lucide-react'
import { PublicNav, PublicFooter } from '../components/PublicNav'
import { RemoteInstrument } from '../components/RemoteInstrument'
import { useAccount } from '../account/AccountProvider'
import { accountApi, type AccountStatus } from '../account/api'
import { skins, preferredSkin, saveSkin, skinById, type SkinId } from '../product/catalog'
import { SkinDialog } from '../product/SkinDialog'
import { track } from '../product/events'

export function SkinsPage() {
  const { status, verified } = useAccount()
  const [selected, setSelected] = useState(preferredSkin)
  const [preview, setPreview] = useState<SkinId | null>(() => {
    const id = new URLSearchParams(location.search).get('skin'); return id && skinById(id).id === id ? skinById(id).id : null
  })
  useEffect(() => { document.title = 'Remote finishes — IZZY'; track('skins_opened') }, [])
  const apply = async (id: SkinId) => {
    if (skinById(id).pro) {
      try { const fresh = await accountApi<AccountStatus>(); if (!fresh.user?.pro) return false } catch { return false }
    }
    const ok = saveSkin(id); if (ok) setSelected(id); return ok
  }
  return <main className="product-page skins-page"><PublicNav />
    <section className="collection-intro page-width"><div><h1>One remote.<br /><em>Many personalities.</em></h1></div></section>
    <section className="skin-grid page-width" aria-label="Remote skin library">{skins.map((skin, index) => <article className="skin-card" key={skin.id}>
      <button className="skin-card-stage" onClick={event => { event.currentTarget.focus(); setPreview(skin.id) }} aria-label={`Preview ${skin.name}${skin.pro ? ' · Pro finish' : ' · Free finish'}`}><RemoteInstrument skin={skin.id} phase={index * .39} /><span className="skin-inspect"><ArrowUpRight size={14} /></span></button>
      <div className="skin-card-meta"><div><h2>{skin.name}</h2></div><span className="skin-state">{selected === skin.id && (!skin.pro || (verified && status?.user?.pro)) ? <><Check size={13} /> Selected</> : skin.pro ? 'PRO' : 'FREE'}</span></div>
    </article>)}</section>
    <section className="collection-outro page-width"><p>The look changes.<br /><em>The feeling stays familiar.</em></p><a className="action-text" href="/pro">Meet Lifetime Pro <ArrowUpRight size={17} /></a></section>
    <PublicFooter />{preview && <SkinDialog initial={preview} selected={selected} pro={verified && !!status?.user?.pro} onApply={apply} onClose={() => setPreview(null)} />}
  </main>
}
