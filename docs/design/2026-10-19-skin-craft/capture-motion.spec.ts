// Review capture, not part of CI discovery. Copy into test/e2e temporarily and
// run with the existing Chromium config; remove that temporary copy afterwards.
import { test, expect } from '@playwright/test'
test.use({trace:'off',screenshot:'off',video:{mode:'on',size:{width:390,height:844}},viewport:{width:390,height:844}})
test('paced synthetic Groove motion capture',async({page})=>{
  await page.goto('/lab/jog')
  await page.getByRole('button',{name:'Focus Groove',exact:true}).click()
  const wheel=page.locator('.lab-device .jog-wheel')
  await wheel.scrollIntoViewIfNeeded()
  await expect(wheel).toBeInViewport({ratio:1})
  // Deliberate holds make the review recording legible at normal playback speed.
  await page.waitForTimeout(1000)
  await page.getByRole('button',{name:'Play',exact:true}).click()
  await expect(wheel).toHaveAttribute('data-running','true')
  await page.waitForTimeout(1800)
  await page.getByRole('button',{name:'Pause',exact:true}).click()
  await expect(wheel).toHaveAttribute('data-running','false')
  await page.waitForTimeout(1000)
  await page.getByRole('button',{name:'Play',exact:true}).click()
  await page.getByRole('button',{name:'Pause',exact:true}).click()
  const box=(await wheel.boundingBox())!
  await page.mouse.move(box.x+box.width*.9,box.y+box.height*.5)
  await page.mouse.down()
  await page.mouse.move(box.x+box.width*.8,box.y+box.height*.75,{steps:12})
  await page.mouse.up()
  await expect(wheel).toHaveAttribute('data-dragging','false')
  await page.waitForTimeout(1200)
})
