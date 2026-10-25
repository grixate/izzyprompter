import type { Page } from '@playwright/test'

export async function openRemoteSkins(page: Page) {
  await page.getByRole('button', { name: 'Remote settings', exact: true }).click()
  await page.getByRole('button', { name: 'Change remote skin', exact: true }).click()
}
