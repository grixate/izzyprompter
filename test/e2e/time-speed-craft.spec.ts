import { openRemoteSkins } from './helpers/open-remote-skins'
import {test,expect} from '@playwright/test'
import {createSyntheticSession} from './helpers/create-synthetic-session'
import {phoneOptions} from './helpers/phone'
import {skinStorageKey,skins,controlCraftSkins} from '../../src/product/catalog'
import {checkRenderedContrast} from './helpers/rendered-contrast'

test.use({trace:'off',screenshot:'off'})
test('fourteen self-contained instruments keep paired precision',async({page:editor,browser,browserName},info)=>{
 test.setTimeout(360_000)
 const phones=await browser.newContext(phoneOptions(browserName)),displays=await browser.newContext()
 await phones.addInitScript(key=>localStorage.setItem(key,'groove'),skinStorageKey)
 const remote=await phones.newPage(),display=await displays.newPage()
 try {
  await editor.goto('/')
  await editor.getByRole('textbox',{name:'Teleprompter script'}).fill('Synthetic precision and instrument review. '.repeat(350))
  await createSyntheticSession(editor)
  const dh=await editor.getByRole('link',{name:/OPEN DISPLAY/}).getAttribute('href'),rh=await editor.getByRole('link',{name:/OPEN REMOTE/}).getAttribute('href')
  await remote.route('**/api/sessions/*/appearance',r=>r.fulfill({json:{pro:true}}))
  await Promise.all([display.goto(dh!),remote.goto(rh!)])
  await expect(remote.getByRole('button',{name:'Play',exact:true})).toBeEnabled()
  await editor.goto('about:blank')
  for(const {id:skin,name} of skins.filter(s=>controlCraftSkins.has(s.id))) {
   info.annotations.push({type:'instrument',description:skin})
   await openRemoteSkins(remote)
   await remote.getByRole('button',{name:'Use '+name,exact:true}).click()
   await expect(remote.locator('#remote-skin-library')).toHaveCount(0)
   const speed=remote.getByRole('slider',{name:'Playback speed'}),jog=remote.getByRole('slider',{name:'Jog script position'})
   await expect(remote.locator('.readout--'+skin)).toBeVisible()
   await speed.scrollIntoViewIfNeeded()
   await expect(remote.getByRole('button',{name:'Increase speed'})).toHaveCount(0)
   await expect(remote.getByRole('button',{name:'Decrease speed'})).toHaveCount(0)
   const mode=await remote.locator('.speed-craft').getAttribute('data-speed-mode'),box=(await speed.boundingBox())!
   if(mode==='dial'||mode==='roller') {
    const rollerWidth=mode==='roller'?(await remote.locator('.speed-rail').boundingBox())!.width:200
    const distance=mode==='roller'?Math.max(44,rollerWidth)/4:50
    await speed.fill('0.56')
    await remote.mouse.move(box.x+box.width/2,box.y+box.height/2);await remote.mouse.down()
    await expect(speed).toHaveValue('0.56')
    await remote.mouse.move(box.x+box.width/2+(mode==='roller'?distance:0),box.y+box.height/2-(mode==='dial'?distance:0),{steps:8})
    await remote.mouse.up();await expect(speed).toHaveValue('0.76')
    await remote.mouse.move(box.x+box.width/2,box.y+box.height/2);await remote.mouse.down()
    await remote.mouse.move(box.x+box.width/2+(mode==='roller'?-distance:0),box.y+box.height/2+(mode==='dial'?distance:0),{steps:8})
    await remote.mouse.up();await expect(speed).toHaveValue('0.56')
   } else for(const [target,value] of [[0,'0.2'],[1,'1']] as const) {
    await remote.mouse.click(mode==='vertical'?box.x+box.width/2:box.x+(target?box.width-1:1),mode==='vertical'?box.y+(target?1:box.height-1):box.y+box.height/2)
    await expect(speed).toHaveValue(value)
    await expect(display.locator('.display-footer')).toContainText(Number(value).toFixed(2)+'×')
   }
   await speed.press('Home');await expect(speed).toHaveValue('0.2')
   await speed.press('ArrowUp');await expect(speed).toHaveValue('0.21')
   await speed.press('End');await expect(speed).toHaveValue('1')
   const exact=remote.getByRole('textbox',{name:'Exact playback speed'})
   await exact.fill('0.56');await exact.press('Enter');await expect(speed).toHaveValue('0.56')
   await expect(display.locator('.display-footer')).toContainText('0.56×')
   await exact.fill('0.77');await exact.press('Escape');await expect(speed).toHaveValue('0.56')
   await exact.fill('2.5');await exact.press('Enter');await expect(speed).toHaveValue('0.56');await expect(exact).toHaveAttribute('aria-invalid','true')
   await exact.fill('1.00');await exact.press('Enter');await expect(speed).toHaveValue('1')
   await jog.press('End')
   await expect.poll(async()=>Number(await jog.getAttribute('aria-valuenow'))).toBeGreaterThan(52*60*1.5)
   await expect(remote.locator('.timecode')).toHaveText(/^\d+:\d{2}\.\d$/)
   const clock=await remote.evaluate(()=>({text:document.querySelector('.timecode')!.textContent!,pixels:Number(document.querySelector('[aria-label="Jog script position"]')!.getAttribute('aria-valuenow')),speed:Number((document.querySelector('[aria-label="Playback speed"]') as HTMLInputElement).value)}))
   const match=/^(\d+):(\d{2})\.(\d)$/.exec(clock.text)!
   expect(match).not.toBeNull();expect(Number(match[1])).toBeGreaterThan(0)
   expect(Math.abs(Number(match[1])*60+Number(match[2])+Number(match[3])/10-clock.pixels/(52*clock.speed))).toBeLessThan(.12)
   await jog.press('Home')
   // The display aligns its first text line; its authoritative checkpoint can
   // be a few pixels after zero. The readout must follow that real position.
   await expect.poll(async()=>Number(await jog.getAttribute('aria-valuenow'))).toBeLessThan(100)
   await remote.getByRole('button',{name:'Play',exact:true}).click();await expect(display.locator('.display-footer')).toContainText('ROLLING')
   await remote.getByRole('button',{name:'Pause',exact:true}).click()
   for(const viewport of [{width:320,height:568},{width:844,height:390},{width:390,height:844}]) {
    await remote.setViewportSize(viewport)
    await speed.scrollIntoViewIfNeeded()
    const sb=(await speed.boundingBox())!;expect(sb.width).toBeGreaterThanOrEqual(44);expect(sb.height).toBeGreaterThanOrEqual(44)
    expect(await remote.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)
    const rb=(await remote.locator('.transport-readout').boundingBox())!,wb=(await remote.locator('.jog-wheel').boundingBox())!
    expect(rb.x<wb.x+wb.width-1&&rb.x+rb.width>wb.x+1&&rb.y<wb.y+wb.height-1&&rb.y+rb.height>wb.y+1).toBe(false)
   }
   await remote.locator('.remote-header').click()
   await checkRenderedContrast(remote,info)
   if(browserName==='chromium') await remote.locator('main').screenshot({path:info.outputPath(skin+'-time-speed.png')})
   await remote.emulateMedia({reducedMotion:'reduce'})
   await remote.getByRole('button',{name:'Play',exact:true}).click()
   await expect.poll(()=>remote.locator('.jog-wheel').evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0)
   expect(await remote.locator('.counter-drum i').evaluateAll(es=>es.flatMap(e=>e.getAnimations()).length)).toBe(0)
   await remote.getByRole('button',{name:'Pause',exact:true}).click()
   await remote.emulateMedia({reducedMotion:'no-preference'})
  }
 }finally{await phones.close();await displays.close()}
})
