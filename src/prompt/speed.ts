/** The useful reading range. Legacy values remain readable when opening saved work. */
export const MIN_SPEED = .2
export const MAX_SPEED = 1
export const LEGACY_MAX_SPEED = 1.5
export const SPEED_STEP = .01
export const speedFraction = (speed:number) => Math.max(0,Math.min(1,(speed-MIN_SPEED)/(MAX_SPEED-MIN_SPEED)))
export const boundedSpeed = (speed:number) => Math.max(MIN_SPEED,Math.min(MAX_SPEED,Math.round(speed*100)/100))
