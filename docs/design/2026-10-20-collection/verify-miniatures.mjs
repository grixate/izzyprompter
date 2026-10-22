import {chromium,expect} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
const instruments=JSON.parse(await readFile(new URL('./instruments.json',import.meta.url)))
const browser=await chromium.launch()
const results=[]
try {
 const page=await browser.newPage({viewport:{width:1280,height:1000}})
 await page.goto('http://127.0.0.1:4177/skins')
 for(const [id] of instruments) {
  const instrument=page.locator('.skin-card .remote-instrument.skin--'+id)
  await expect(instrument).toBeVisible()
  await expect(instrument.locator('.speed-craft')).toHaveCount(1)
  await expect(instrument.locator('input')).toHaveCount(0)
  for(const width of [390,768,1280]) {
   await page.setViewportSize({width,height:1000})
   await instrument.scrollIntoViewIfNeeded()
   const measure=await instrument.evaluate(el=>{const b=el.getBoundingClientRect();return [...el.querySelectorAll('.transport-readout,.speed-module')].map(e=>{const r=e.getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1})})
   expect(measure).toEqual([true,true])
   expect(await instrument.locator('.timecode').evaluate(el=>el.scrollWidth-el.clientWidth),id+' at '+width).toBeLessThanOrEqual(1)
   expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)
  }
  await instrument.screenshot({path:new URL('./references/'+id+'-mini.png',import.meta.url).pathname})
  results.push({skin:id,widths:[390,768,1280],contained:true,focusableInputs:0})
 }
 await writeFile(new URL('./miniature-checks.json',import.meta.url),JSON.stringify(results,null,2)+'\n')
} finally {await browser.close()}
