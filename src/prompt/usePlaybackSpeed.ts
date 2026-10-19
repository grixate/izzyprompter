import { useEffect, useState } from 'react'
import { loadWorkspaceStorage, rememberPlaybackSpeed, STORAGE_KEYS } from '../domain/storage'

/** One device preference shared by previews, reading screens and remotes. */
export function usePlaybackSpeed() {
  const [speed, setSpeed] = useState(() => loadWorkspaceStorage().settings.speed)
  useEffect(() => {
    const local = (event: Event) => setSpeed((event as CustomEvent<number>).detail)
    const stored = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.settings || event.key === null) setSpeed(loadWorkspaceStorage().settings.speed)
    }
    window.addEventListener('izzy:playback-speed', local)
    window.addEventListener('storage', stored)
    return () => { window.removeEventListener('izzy:playback-speed', local); window.removeEventListener('storage', stored) }
  }, [])
  return [speed, (next: number) => { setSpeed(next); rememberPlaybackSpeed(next) }] as const
}
