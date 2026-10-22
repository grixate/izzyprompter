import { test, expect, type Locator } from '@playwright/test'
import { skins, proSkinCount } from '../../src/product/catalog'

test.use({actionTimeout:10_000})

async function operate(preview: Locator) {
  await preview.scrollIntoViewIfNeeded()
  const jog = preview.getByRole('slider', {name:'Jog script position'})
  await jog.press('Home'); await jog.press('ArrowRight')
  await expect(jog).toHaveAttribute('aria-valuenow','48')
  const exact = preview.getByRole('textbox', {name:'Exact playback speed'})
  await exact.click();
  const geometry=await preview.evaluate(root=>{
    const rect=(selector:string)=>{const el=root.querySelector<HTMLElement>(selector)!;let x=0,y=0,node:HTMLElement|null=el;while(node&&node!==root){x+=node.offsetLeft;y+=node.offsetTop;node=node.offsetParent as HTMLElement|null}return {x,y,width:el.offsetWidth,height:el.offsetHeight}}
    return {name:root.getAttribute('aria-label'),value:rect('.speed-exact'),track:rect('.speed-track')}
  })
  const {value:v,track:t}=geometry
  expect(Math.min(v.x+v.width,t.x+t.width)-Math.max(v.x,t.x)<1 || Math.min(v.y+v.height,t.y+t.height)-Math.max(v.y,t.y)<1,JSON.stringify(geometry)).toBe(true)
  await exact.fill('0.64'); await exact.press('Enter')
  await expect(preview.getByRole('slider', {name:'Playback speed'})).toHaveValue('0.64')
  await preview.getByRole('button', {name:'Play',exact:true}).click()
  await expect.poll(async()=>Number(await jog.getAttribute('aria-valuenow'))).toBeGreaterThan(48)
  await preview.getByRole('button', {name:'Pause',exact:true}).click()
  const stopped = await jog.getAttribute('aria-valuenow')
  await expect(preview.locator('.state-label')).toContainText('HOLD')
  await expect.poll(async()=>preview.locator('.wheel-rotor').evaluate(el=>el.getAnimations().length)).toBe(0)
  await preview.page().waitForTimeout(180)
  await expect(jog).toHaveAttribute('aria-valuenow',stopped!)
}

test('every PRO instrument operates in place without creating takes or changing reading preferences', async ({page},testInfo)=>{
  test.setTimeout(150_000)
  await page.setViewportSize({width:390,height:844})
  const writes:string[]=[]
  page.on('request',r=>{if(r.method()==='POST')writes.push(new URL(r.url()).pathname)})
  await page.goto('/pro')
  await expect(page.locator('.pro-collection h2')).toContainText(`${skins.length} finishes`)
  await expect(page.getByRole('link',{name:`Explore all ${skins.length} finishes`})).toBeVisible()
  await expect(page.locator('.pro-collection .section-heading')).toContainText(`Original is free. Pro adds ${proSkinCount} more.`)
  const storage = await page.evaluate(()=>JSON.stringify({...localStorage}))
  const previews = page.locator('.remote-instrument[data-interactive=true]')
  await expect(previews).toHaveCount(9)
  for(let i=0;i<9;i++) await operate(previews.nth(i))
  if(testInfo.project.name==='chromium') await page.locator('.pro-skin-strip').screenshot({path:testInfo.outputPath('pro-working-previews-phone.png')})
  expect(writes).toEqual([])
  expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).toBe(storage)
})

test('all fourteen catalog previews expose working controls, including locked Pro finishes', async ({page})=>{
  test.setTimeout(180_000)
  await page.goto('/skins?skin=original')
  const dialog=page.getByRole('dialog')
  for(const skin of skins) {
    await expect(dialog.getByRole('heading',{level:2})).toHaveText(skin.name)
    await test.step(skin.name,()=>operate(dialog.locator('.remote-instrument')))
    await dialog.getByRole('button',{name:'Next skin',exact:true}).click()
  }
  await expect(dialog.getByRole('heading',{level:2})).toHaveText('Original')
})

test('both home-page finish previews have reachable controls on a phone', async ({page})=>{
  await page.setViewportSize({width:390,height:844})
  await page.goto('/')
  const previews=page.locator('.home-pro-objects .remote-instrument')
  await expect(previews).toHaveCount(2)
  for(let i=0;i<2;i++) await operate(previews.nth(i))
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390)
})

test('pointer gestures turn the preview wheel and its rotary speed control', async ({page})=>{
  await page.setViewportSize({width:390,height:844})
  await page.goto('/pro')
  const hero=page.locator('.pro-hero-object')
  await hero.getByRole('button',{name:'Preview Vector',exact:true}).click()
  const wheel=hero.locator('.jog-wheel'),jog=hero.getByRole('slider',{name:'Jog script position'})
  await wheel.scrollIntoViewIfNeeded()
  const w=(await wheel.boundingBox())!,x=w.x+w.width/2,y=w.y+w.height/2,r=w.width*.36
  await page.mouse.move(x+r,y);await page.mouse.down()
  await page.mouse.move(x+r*.7,y+r*.7);await page.mouse.move(x,y+r);await page.mouse.up()
  await expect.poll(async()=>Number(await jog.getAttribute('aria-valuenow'))).toBeGreaterThan(80)
  const speed=hero.getByRole('slider',{name:'Playback speed'})
  await speed.scrollIntoViewIfNeeded()
  const b=(await speed.boundingBox())!,cx=b.x+b.width/2,cy=b.y+b.height/2,radius=b.width*.3
  await page.mouse.move(cx+radius,cy);await page.mouse.down()
  await page.mouse.move(cx,cy+radius)
  await expect.poll(async()=>Number(await speed.inputValue())).toBeGreaterThan(.7)
  await page.mouse.move(cx+radius,cy);await page.mouse.up()
  await expect(speed).toHaveValue('0.56')
})
