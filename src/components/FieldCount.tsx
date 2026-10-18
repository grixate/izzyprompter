import { useMemo } from 'react'
import { MAX_SCRIPT_FILE_BYTES } from '../domain/fileImport'

export function FieldCount({ id, value, title = false }: { id: string; value: string; title?: boolean }) {
  const count = useMemo(() => {
    if (title) return `${value.length} / 200 characters · ${Math.max(0, 200 - value.length)} left`
    let characters = 0
    for (const _ of value) characters++
    const remaining = MAX_SCRIPT_FILE_BYTES - new TextEncoder().encode(value).length
    return `${characters.toLocaleString('en-US')} characters · ${Math.max(0, remaining).toLocaleString('en-US')} bytes left of 2 MB${remaining < 0 ? ' · over limit' : ''}`
  }, [value, title])
  return <p className="field-count" id={id}>{count}</p>
}
