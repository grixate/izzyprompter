import { test, expect } from '@playwright/test'
import { wheel, focus, angle } from './helpers/wheel-mechanism'

// Only synthetic lab footage: no editor, QR or pairing capabilities.
test.use({trace:'off',screenshot:'off',viewport:{width:390,height:844},video:{mode:'on',size:{width:390,height:844}}})

test('Groove tonearm parks, reverses an interrupted transition and leaves scrub available', async ({page}) => {
  await focus(page,'Groove')
  const arm='.lab-device [data-tonearm]'
  await expect.poll(()=>angle(page,arm)).toBeCloseTo(-Math.PI/18,2)
  await page.getByRole('button',{name:'Play',exact:true}).click()
  await expect.poll(()=>angle(page,arm)).toBeCloseTo(Math.PI/9,2)
  await page.getByRole('button',{name:'Pause',exact:true}).click()
  await page.getByRole('button',{name:'Play',exact:true}).click()
  await page.getByRole('button',{name:'Pause',exact:true}).click()
  await expect.poll(()=>angle(page,arm)).toBeCloseTo(-Math.PI/18,2)
  const box=(await wheel(page).boundingBox())!
  await page.mouse.move(box.x+box.width*.9,box.y+box.height*.5)
  await page.mouse.down()
  await expect(wheel(page)).toHaveAttribute('data-dragging','true')
  await page.mouse.move(box.x+box.width*.8,box.y+box.height*.75)
  await page.mouse.up()
  await expect(wheel(page)).toHaveAttribute('data-dragging','false')
  await expect(page.locator('[data-mechanism="tonearm"]')).toHaveAttribute('aria-hidden','true')
  await expect(page.locator('[data-mechanism] button, [data-mechanism] [tabindex]')).toHaveCount(0)
})
