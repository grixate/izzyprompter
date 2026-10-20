export function jogKeyDelta(key: string, pageSize: number) {
  if (key === 'ArrowRight' || key === 'ArrowDown') return 48
  if (key === 'ArrowLeft' || key === 'ArrowUp') return -48
  if (key === 'PageDown') return pageSize
  if (key === 'PageUp') return -pageSize
  return null
}

export {boundedSpeed} from '../prompt/speed.ts'
