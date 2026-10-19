import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { chromium, expect } from '@playwright/test'
const origin='https://staging.izzyprompter.com'
const base=origin+'/assets/skin-craft-review-ad92e3a/v2/'
const credentials=JSON.parse(await readFile(join(homedir(),'.ssh/izzy_staging_access.json'),'utf8'))
const browser=await chromium.launch()
try {
  const anonymous=await browser.newContext()
  assert.equal((await anonymous.request.get(base+'review.html')).status(),401)
  assert.equal((await anonymous.request.get(base+'live/index.html')).status(),401)
  await anonymous.close()
  const context=await browser.newContext({httpCredentials:{username:credentials.username,password:credentials.password},viewport:{width:1280,height:900}})
  const page=await context.newPage(), errors=[], requests=[], sockets=[]
  page.on('pageerror',e=>errors.push(e.message))
  page.on('request',r=>{if(/\/(api|socket|account)(\/|$)/.test(new URL(r.url()).pathname)) requests.push(r.method())})
  page.on('websocket',()=>sockets.push(true))
  assert.equal((await page.goto(base+'review.html')).status(),200)
  await expect(page).toHaveTitle(/правки 02/)
  await expect(page.locator('article')).toHaveCount(26)
  // Force each image into view before checking lazy-loaded content.
  for(const card of await page.locator('article').all()) {
    await card.scrollIntoViewIfNeeded()
    await expect.poll(()=>card.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true)
  }
  const groove=page.locator('#groove')
  await groove.getByRole('button',{name:'Сравнить с предыдущей'}).click()
  await expect(groove.locator('figcaption')).toContainText('Предыдущая')
  await groove.getByRole('button',{name:'Вернуться к версии 2'}).click()
  await groove.getByRole('button',{name:'Показать RUN'}).click()
  await expect.poll(()=>groove.locator('img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true)
  await expect(groove.locator('figcaption')).toContainText('RUN')
  await groove.getByRole('button',{name:'Показать HOLD'}).click()
  await page.locator('h1').scrollIntoViewIfNeeded()
  await mkdir('artifacts/skin-craft',{recursive:true})
  await page.screenshot({path:'artifacts/skin-craft/v2-hosted-gallery.png'})
  await page.goto(base+'live/index.html')
  await expect(page.getByRole('button',{name:'Focus Clear',exact:true})).toBeVisible()
  // Accessible labels carry the names; the compact arrow buttons have no text.
  const labels=await page.getByRole('button',{name:/^Focus /}).evaluateAll(els=>els.map(el=>el.getAttribute('aria-label').slice(6)))
  assert.equal(labels.length,26)
  for(const name of labels) {
    if(name!==labels[0]) await page.getByRole('button',{name:/^Compare all/}).click()
    await page.getByRole('button',{name:`Focus ${name}`,exact:true}).click()
    const wheel=page.locator('.lab-device .jog-wheel')
    await wheel.scrollIntoViewIfNeeded()
    await page.getByRole('button',{name:'Play',exact:true}).click()
    await expect(wheel).toHaveAttribute('data-running','true')
    await expect.poll(()=>wheel.evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length)).toBeGreaterThan(0)
    await page.getByRole('button',{name:'Pause',exact:true}).click()
    await expect.poll(()=>wheel.evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0)
    const slider=page.getByRole('slider',{name:'Jog script position'})
    const before=Number(await slider.getAttribute('aria-valuenow'))
    await slider.press('ArrowRight')
    expect(Number(await slider.getAttribute('aria-valuenow'))).toBeGreaterThan(before)
  }
  assert.deepEqual(errors,[])
  assert.deepEqual(requests,[])
  assert.deepEqual(sockets,[])
  console.log(JSON.stringify({result:'passed',authenticated:true,anonymousStatus:401,catalog:26,livePlayPauseAndKeyboard:26,browserErrors:0,sessionOrAccountRequests:0,webSockets:0},null,2))
} catch(error) {
  console.error(String(error.stack||error).replaceAll(credentials.password,'[redacted]').replace(/https?:\/\/[^\s)]+/g,'[review URL]'))
  process.exitCode=1
} finally {await browser.close()}
