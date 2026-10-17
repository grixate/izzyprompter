import { readFile } from 'node:fs/promises'

const details = JSON.parse(await readFile(new URL('../src/legal/siteDetails.json', import.meta.url), 'utf8'))
const missing = ['operatorName', 'operatorCountry', 'operatorAddress', 'supportEmail'].filter(key => typeof details[key] !== 'string' || !details[key].trim())
if (typeof details.supportEmail === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.supportEmail)) missing.push('valid receiving supportEmail')
if (details.policiesApproved !== true) missing.push('owner policy approval')
if (missing.length) {
  console.error(`Legal publication is not ready: ${missing.join(', ')}. See docs/LEGAL_PAGES.md.`)
  process.exitCode = 1
} else {
  console.log('Legal publication details are complete. Verify the receiving inbox and approved release before publication.')
}
