import type { PlaywrightWorkerOptions } from '@playwright/test'

// macOS WebKit defaults to a restricted Tab cycle. Option+Tab includes native
// buttons/links without changing the user's global keyboard preferences.
export const tabKey = (browserName: PlaywrightWorkerOptions['browserName']) =>
  browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab'
