import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { FolderOpen, Plus, Pencil, Trash2, X } from 'lucide-react'
import { accountApi, accountMessage, type ProjectFolder } from './api'

export function useProjectFolders(accountId: string) {
  const sequence = useRef(0)
  const [folders, setFolders] = useState<ProjectFolder[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    const request = ++sequence.current
    const result = await accountApi<{ folders: ProjectFolder[] }>('/folders')
    if (request !== sequence.current) return
    setFolders(result.folders); setLoaded(true); setError('')
  }, [accountId])
  useEffect(() => {
    let active = true
    setFolders([]); setLoaded(false); setError('')
    const load = () => { if (active) void refresh().catch(error => { if (active) setError(accountMessage(error)) }) }
    load()
    window.addEventListener('izzy:account-update', load)
    window.addEventListener('online', load)
    return () => { active = false; sequence.current++; window.removeEventListener('izzy:account-update', load); window.removeEventListener('online', load) }
  }, [refresh])
  return { folders, loaded, error, refresh }
}

export function ProjectFolders({ pro, folders, value, onChange, refresh, loaded, error }: {
  pro: boolean; folders: ProjectFolder[]; value: string; onChange: (id: string) => void
  refresh: () => Promise<void>; loaded: boolean; error: string
}) {
  const [editing, setEditing] = useState<'create' | 'rename' | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [removeArmed, setRemoveArmed] = useState(false)
  const selected = folders.find(folder => folder.id === value)
  useEffect(() => { setEditing(null); setRemoveArmed(false); setNotice('') }, [value])
  useEffect(() => {
    if (loaded && value && value !== 'unfiled' && !folders.some(folder => folder.id === value)) onChange('')
  }, [folders, loaded])
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice('')
    try {
      const folder = await accountApi<ProjectFolder>(editing === 'rename' && selected ? `/folders/${selected.id}` : '/folders', editing === 'rename' ? 'PATCH' : 'POST', { name })
      await refresh(); onChange(folder.id); setEditing(null)
      window.dispatchEvent(new Event('izzy:account-update'))
    } catch (error) { setNotice(accountMessage(error)) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!selected) return
    if (!removeArmed) { setRemoveArmed(true); return }
    setBusy(true); setNotice('')
    try {
      await accountApi(`/folders/${selected.id}`, 'DELETE', {})
      onChange(''); await refresh(); setRemoveArmed(false)
      window.dispatchEvent(new Event('izzy:account-update'))
    } catch (error) { setNotice(accountMessage(error)) }
    finally { setBusy(false) }
  }
  if (!pro && !folders.length && !error) return null
  return <section className="project-folders" aria-label="Project folders">
    <div className="project-toolbar">
      <label><FolderOpen size={16} /><span className="sr-only">Project</span><select aria-label="Project" value={value} disabled={busy || !loaded} onChange={event => onChange(event.target.value)}>
        <option value="">All scripts</option><option value="unfiled">No project</option>
        {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name} ({folder.script_count})</option>)}
      </select></label>
      {pro && <button disabled={busy || !loaded} onClick={() => { setEditing('create'); setName(''); setRemoveArmed(false) }}><Plus size={15} />New project</button>}
      {selected && <>
        {pro && <button disabled={busy} aria-label="Rename project" onClick={() => { setEditing('rename'); setName(selected.name); setRemoveArmed(false) }}><Pencil size={15} /></button>}
        <button disabled={busy} aria-label={removeArmed ? 'Confirm remove project' : 'Remove project'} onClick={() => void remove()}><Trash2 size={15} />{removeArmed && 'Confirm'}</button>
      </>}
    </div>
    {editing && <form className="project-form" onSubmit={event => void save(event)}>
      <label>{editing === 'create' ? 'New project name' : 'Project name'}<input autoFocus required maxLength={200} value={name} onChange={event => setName(event.target.value)} disabled={busy} /></label>
      <button className="account-primary" disabled={busy || !name.trim()}>{editing === 'create' ? 'Create project' : 'Save project name'}</button>
      <button type="button" aria-label="Cancel project editing" disabled={busy} onClick={() => setEditing(null)}><X size={16} /></button>
    </form>}
    {removeArmed && <p className="project-note">Remove this folder? Its scripts will stay in All scripts and No project.</p>}
    {!pro && folders.length > 0 && <p className="project-note">Your projects remain accessible. Pro lets you add projects and organize scripts.</p>}
    {(notice || error) && <p className="account-notice" role="status">{notice || error}</p>}
  </section>
}
