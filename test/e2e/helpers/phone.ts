import type { PlaywrightWorkerOptions } from '@playwright/test'

// Firefox has no mobile emulation mode. It still exercises responsive sizing
// and touch capability, without claiming that this is a physical phone test.
export function phoneOptions(browserName: PlaywrightWorkerOptions['browserName']) {
  return { viewport: { width: 390, height: 844 }, isMobile: browserName !== 'firefox', hasTouch: true }
}
