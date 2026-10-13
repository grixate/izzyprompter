export function jogKeyDelta(key: string, pageSize: number) {
  if (key === 'ArrowRight' || key === 'ArrowDown') return 48
  if (key === 'ArrowLeft' || key === 'ArrowUp') return -48
  if (key === 'PageDown') return pageSize
  if (key === 'PageUp') return -pageSize
  return null
}

export function boundedSpeed(speed: number) {
  return Math.max(0.5, Math.min(1.5, Math.round(speed * 100) / 100))
}
