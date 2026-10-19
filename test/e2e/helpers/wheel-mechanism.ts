import { expect, type Page } from '@playwright/test'

export const wheel = (page: Page) => page.locator('.lab-device .jog-wheel')
export async function focus(page: Page, name: string) {
  await page.goto('/lab/jog')
  await page.getByRole('button', { name:`Focus ${name}`, exact:true }).click()
  await expect(wheel(page)).toBeVisible()
}
export const angle = (page: Page, selector: string) => page.locator(selector).evaluate(el => {
  const m = new DOMMatrixReadOnly(getComputedStyle(el).transform)
  return Math.atan2(m.b,m.a)
})
