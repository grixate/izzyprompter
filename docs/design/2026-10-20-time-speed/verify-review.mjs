import assert from 'node:assert/strict'
import { chromium, firefox, webkit, expect } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const root='http://127.0.0.1:8780/2026-10-20-time-speed/'
const results=[]
for(const [name,engine] of Object.entries({chromium,firefox,webkit})) {
 const browser=await engine.launch()
 try {
  const context=await browser.newContext({viewport:{width:1280,height:1000}})
  const page=await context.newPage(),errors=[],requests=[]
  page.on('pageerror',e=>errors.push(e.message))
  page.on('request',r=>{if(/\/(api|socket|account)(\/|$)/.test(new URL(r.url()).pathname)) requests.push(r.method())})
  await page.goto(root+'review.html')
  await expect(page.locator('article')).toHaveCount(3)
  for(const card of await page.locator('article').all()) {
   await expect.poll(()=>card.locator('img').evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true)
   await card.getByRole('button').click()
   await expect.poll(()=>card.locator('img').evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true)
   await card.getByRole('button').click()
  }
  if(name==='chromium') await page.screenshot({path:new URL('./references/gallery.png',import.meta.url).pathname,fullPage:true})
  for(const skin of ['groove','clear','arcade']) {
   await page.goto(root+'live/index.html?skin='+skin)
   await expect(page.locator('.lab-device')).toHaveClass(new RegExp('skin--'+skin))
   const wheel=page.locator('.jog-wheel'),slider=page.getByRole('slider',{name:'Jog script position'})
   await wheel.scrollIntoViewIfNeeded()
   const speed=page.getByRole('slider',{name:'Playback speed'})
   await speed.press('Home');await expect(speed).toHaveValue('0.5')
   await speed.press('End');await expect(speed).toHaveValue('1.5')
   await expect(page.locator('.timecode')).toHaveText(/^\d+:\d{2}\.\d$/)
   const before=Number(await slider.getAttribute('aria-valuenow'))
   await slider.press('ArrowRight')
   expect(Number(await slider.getAttribute('aria-valuenow'))).toBeGreaterThan(before)
   if(skin==='clear') expect(await page.locator('.mechanism--clear-glass').evaluate(e=>getComputedStyle(e).transform)).toBe('none')
   await page.getByRole('button',{name:'Play',exact:true}).click()
   await expect(wheel).toHaveAttribute('data-running','true')
   await expect.poll(()=>page.locator('.wheel-rotor').evaluate(e=>e.getAnimations().length)).toBeGreaterThan(0)
   if(skin==='clear') {
    await expect.poll(()=>page.locator('.clear-light').evaluateAll(es=>es.map(e=>getComputedStyle(e).stroke))).toEqual(['rgb(250, 251, 255)','rgb(250, 251, 255)'])
    expect(await page.locator('.mechanism--clear-glass').evaluate(e=>getComputedStyle(e).transform)).toBe('none')
   }
   await page.getByRole('button',{name:'Pause',exact:true}).click()
   await expect.poll(()=>wheel.evaluate(e=>e.getAnimations({subtree:true}).length)).toBe(0)
   if(skin==='clear') await expect.poll(()=>page.locator('.clear-light').evaluateAll(es=>es.map(e=>getComputedStyle(e).stroke))).toEqual(['rgb(146, 150, 156)','rgb(146, 150, 156)'])
   await page.getByRole('button',{name:'Quick edit current paragraph'}).click()
   await page.getByRole('textbox',{name:'Demo current paragraph'}).fill('Local object review.')
   await page.getByRole('button',{name:'Done',exact:true}).click()
   await expect(page.locator('.lab-script-monitor p')).toHaveText('Local object review.')
   await page.emulateMedia({reducedMotion:'reduce'})
   await page.getByRole('button',{name:'Play',exact:true}).click()
   await expect.poll(()=>wheel.evaluate(e=>e.getAnimations({subtree:true}).length)).toBe(0)
   await page.getByRole('button',{name:'Pause',exact:true}).click()
   await page.emulateMedia({reducedMotion:'no-preference'})
   if(name==='chromium') {
    await page.locator('.lab-device').screenshot({path:new URL('./references/'+skin+'-demo.png',import.meta.url).pathname})
   }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[])
  results.push({browser:name,galleryImages:6,syntheticControls:3,fixedClearChassis:true,reducedMotion:true,pageErrors:0,sessionOrAccountRequests:0})
  await context.close()
 } finally {await browser.close()}
}
await writeFile(new URL('./preview-checks.json',import.meta.url),JSON.stringify(results,null,2)+'\n')
console.log(JSON.stringify(results))
