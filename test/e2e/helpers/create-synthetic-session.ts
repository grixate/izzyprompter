import { expect, type Page } from '@playwright/test'

/** Fail on admission refusal before looking for capability-bearing links. */
export async function createSyntheticSession(page: Page) {
  const creation = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/sessions')
  await page.getByRole('button', { name: 'SET UP PROMPTER', exact: true }).click()
  expect((await creation).status(), 'Synthetic session creation status').toBe(201)
}
