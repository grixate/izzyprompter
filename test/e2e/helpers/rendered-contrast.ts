import { expect, type Page, type TestInfo } from '@playwright/test'

/** Sample the actual material behind essential text/icons, with the ink hidden.
 * This is a targeted contrast check, not a full accessibility certification. */
export async function checkRenderedContrast(page: Page, testInfo: TestInfo) {
  const checks = [
    ['.remote-identity strong', 4.5], ['.network-state', 4.5], ['.remote-link-state small', 4.5],
    ['.display-kicker', 4.5], ['.timecode:not(:has(.counter-digits))', 3], ['.state-label', 4.5],
    ['.counter-drum', 3], ['.counter-colon', 3], ['.counter-fraction', 4.5],
    ['.speed-exact',4.5], ['.speed-help',4.5], ['.speed-title', 4.5], ['.speed-module strong', 4.5], ['.speed-module button', 4.5],
    ['.phrase-nav button small', 4.5], ['.phrase-count', 4.5], ['.phrase-count small', 4.5],
    ['.quick-edit-trigger', 4.5], ['.transport-button svg', 3], ['.remote-finish-button svg', 3],
  ] as const
  const targets = await page.evaluate(checks => checks.flatMap(([selector, minimum]) =>
    [...document.querySelectorAll<HTMLElement>(selector)].filter(el => el.getBoundingClientRect().width > 0).map(el => {
      const { x, y, width, height } = el.getBoundingClientRect()
      return { selector, minimum, color: getComputedStyle(el).color, x, y, width, height }
    })), checks)
  const hide = await page.addStyleTag({ content: checks.map(([selector]) => `${selector}, ${selector} *`).join(',') + '{color:transparent!important;text-shadow:none!important}' })
  let background: Buffer
  try { background = await page.screenshot({ scale: 'css', path: testInfo.outputPath('contrast-background.png') }) } finally { await hide.evaluate(el => el.remove()) }
  const results = await page.evaluate(async ({ targets, png }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode()
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height
    const context = canvas.getContext('2d')!; context.drawImage(img, 0, 0)
    const ink = document.createElement('canvas'); ink.width = ink.height = 1
    const inkContext = ink.getContext('2d')!
    const luminance = (rgb: ArrayLike<number>) => [rgb[0], rgb[1], rgb[2]].map(v => {
      const channel = v / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
    }).reduce((total, value, i) => total + value * [.2126, .7152, .0722][i], 0)
    return targets.map(target => {
      inkContext.clearRect(0, 0, 1, 1); inkContext.fillStyle = target.color; inkContext.fillRect(0, 0, 1, 1)
      const foreground = luminance(inkContext.getImageData(0, 0, 1, 1).data)
      const ratios = [.3, .5, .7].flatMap(dx => [.35, .5, .65].map(dy => {
        const x = Math.round(target.x + target.width * dx), y = Math.round(target.y + target.height * dy)
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) throw new Error(`Contrast target outside viewport: ${target.selector}`)
        const back = luminance(context.getImageData(x, y, 1, 1).data)
        return (Math.max(foreground, back) + .05) / (Math.min(foreground, back) + .05)
      }))
      return { selector: target.selector, color: target.color, minimum: target.minimum, ratio: Math.min(...ratios) }
    })
  }, { targets, png: background.toString('base64') })
  await testInfo.attach('rendered-contrast.json', { body: JSON.stringify(results, null, 2), contentType: 'application/json' })
  for (const result of results) expect.soft(result.ratio, `${result.selector}: rendered contrast`).toBeGreaterThanOrEqual(result.minimum)
}
