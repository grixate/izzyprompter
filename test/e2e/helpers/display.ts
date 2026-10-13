import { expect, type Page } from '@playwright/test'

export async function openPromptSettings(display: Page) {
  // Long scripts and slower browsers can outlast the toolbar's auto-hide.
  // Focusing a control reveals and retains the toolbar, as keyboard users do.
  const settings = display.getByRole('button', { name: 'Prompt settings', exact: true })
  await settings.focus()
  await expect(display.locator('.display-header')).not.toHaveClass(/is-hidden/)
  await settings.press('Enter')
  await expect(display.getByRole('region', { name: 'Prompt settings panel' })).toBeVisible()
}
