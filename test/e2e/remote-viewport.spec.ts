import {test,expect,type Page} from '@playwright/test'
import {skins,controlCraftSkins,skinStorageKey} from '../../src/product/catalog'
import {createSyntheticSession} from './helpers/create-synthetic-session'
import {phoneOptions} from './helpers/phone'

test.use({trace:'off',screenshot:'off'})
async function pair(editor:Page,display:Page,remote:Page){
 await editor.goto('/')
 await editor.getByRole('textbox',{name:'Teleprompter script'}).fill('Synthetic opening. '.repeat(25)+'\n\nCurrent camera paragraph. '.repeat(30)+'\n\nSynthetic closing.')
 await createSyntheticSession(editor)
 const d=await editor.getByRole('link',{name:/OPEN DISPLAY/}).getAttribute('href'),r=await editor.getByRole('link',{name:/OPEN REMOTE/}).getAttribute('href')
 await remote.route('**/api/sessions/*/appearance',route=>route.fulfill({json:{pro:true}}))
 await Promise.all([display.goto(d!),remote.goto(r!)])
 await expect(remote.getByRole('button',{name:'Quick edit current paragraph'})).toBeEnabled()
 await editor.goto('about:blank')
}
const sizes=[{width:320,height:480},{width:320,height:568},{width:360,height:640},{width:390,height:660},{width:390,height:844},{width:568,height:320},{width:844,height:390},{width:768,height:1024}]

test('every catalog remote is a stationary phone instrument, with all controls visible',async({page:editor,browser,browserName},info)=>{
 test.setTimeout(240_000)
 const phones=await browser.newContext(phoneOptions(browserName)),displays=await browser.newContext()
 await phones.addInitScript(key=>localStorage.setItem(key,'groove'),skinStorageKey)
 const remote=await phones.newPage(),display=await displays.newPage()
 try {
  await pair(editor,display,remote)
  for(const skin of skins){
   await remote.getByRole('button',{name:'Change remote skin'}).click()
   await remote.getByRole('button',{name:'Use '+skin.name,exact:true}).click()
   await expect(remote.locator('#remote-skin-library')).toHaveCount(0)
   for(const size of sizes){
    await remote.setViewportSize(size)
    const geometry=await remote.evaluate(()=>{
     const main=document.querySelector<HTMLElement>('.standalone-remote')!
     const selectors=['.remote-header','.transport-readout','.jog-wheel','.transport-button','.speed-module','.speed-track input','.speed-exact','.phrase-nav button','.quick-edit-trigger','.remote-finish-button']
     const boxes=selectors.flatMap(selector=>[...main.querySelectorAll<HTMLElement>(selector)].map(el=>{const r=el.getBoundingClientRect();return {selector,x:r.x,y:r.y,width:r.width,height:r.height}}))
     const rect=(selector:string)=>{const b=main.querySelector(selector)!.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom}}
     return {scroll:main.scrollHeight-main.clientHeight,wide:document.documentElement.scrollWidth-innerWidth,boxes,header:rect('.remote-header'),cartridgeSlotTop:main.querySelector('.readout--cartridge')?rect('.transport-readout').y+parseFloat(getComputedStyle(main.querySelector('.readout--cartridge')!,'::before').top):null,readout:rect('.transport-readout'),wheel:rect('.jog-wheel'),speed:rect('.speed-module')}
    })
    const label=skin.id+' '+size.width+'×'+size.height
    if(geometry.cartridgeSlotTop!==null)expect.soft(geometry.cartridgeSlotTop,label+' cartridge slot clears branding').toBeGreaterThanOrEqual(geometry.header.bottom+3)
    expect.soft(geometry.scroll,label+' hidden vertical content').toBeLessThanOrEqual(1)
    expect.soft(geometry.wide,label+' horizontal overflow').toBeLessThanOrEqual(1)
    for(const box of geometry.boxes){
     expect.soft(box.x,label+box.selector+' left').toBeGreaterThanOrEqual(-1)
     expect.soft(box.y,label+box.selector+' top').toBeGreaterThanOrEqual(-1)
     expect.soft(box.x+box.width,label+box.selector+' right').toBeLessThanOrEqual(size.width+1)
     expect.soft(box.y+box.height,label+box.selector+' bottom').toBeLessThanOrEqual(size.height+1)
     if(/input|button|trigger|exact/.test(box.selector)){
      expect.soft(box.width,label+box.selector+' touch width').toBeGreaterThanOrEqual(44)
      expect.soft(box.height,label+box.selector+' touch height').toBeGreaterThanOrEqual(44)
     }
    }
    const overlaps=(a:typeof geometry.wheel,b:typeof geometry.wheel)=>a.x<b.right-1&&a.right>b.x+1&&a.y<b.bottom-1&&a.bottom>b.y+1
    expect.soft(geometry.wheel.right-geometry.wheel.x,label+' usable jog diameter').toBeGreaterThanOrEqual(128)
    expect.soft(overlaps(geometry.readout,geometry.wheel),label+' readout/wheel collision').toBe(false)
    expect.soft(overlaps(geometry.readout,geometry.speed),label+' readout/speed collision').toBe(false)
    expect.soft(overlaps(geometry.wheel,geometry.speed),label+' wheel/speed collision').toBe(false)
    if(browserName==='chromium'&&controlCraftSkins.has(skin.id)&&[568,844].includes(size.height))await remote.locator('main').screenshot({path:info.outputPath(`${skin.id}-${size.width}x${size.height}.png`)})
   }
   await remote.setViewportSize({width:390,height:844})
   if(browserName!=='webkit'){await remote.mouse.move(8,400);await remote.mouse.wheel(0,500)}else await remote.evaluate(()=>{window.scrollTo(0,500);document.querySelector('.standalone-remote')!.scrollTop=500})
   expect(await remote.evaluate(()=>[scrollY,document.querySelector('.standalone-remote')!.scrollTop])).toEqual([0,0])
  }
 }finally{await phones.close();await displays.close()}
})

test('current paragraph opens above the stationary remote and stays usable with a keyboard-sized viewport',async({page:editor,browser,browserName},info)=>{
 test.setTimeout(90_000)
 const phones=await browser.newContext(phoneOptions(browserName)),displays=await browser.newContext()
 await phones.addInitScript(key=>localStorage.setItem(key,'groove'),skinStorageKey)
 const remote=await phones.newPage(),display=await displays.newPage()
 try{
  await pair(editor,display,remote)
  await remote.getByRole('button',{name:'Next phrase'}).click()
  await remote.getByRole('button',{name:'Play',exact:true}).click()
  const root=remote.locator('main'),before=await root.boundingBox()
  await remote.getByRole('button',{name:'Quick edit current paragraph'}).click()
  const drawer=remote.locator('.remote-drawer'),field=remote.getByRole('textbox',{name:'CURRENT PARAGRAPH'})
  await expect(drawer).toBeVisible();expect(await drawer.evaluate(el=>el.matches(':modal'))).toBe(true)
  await expect(field).toBeFocused();await expect(field).toHaveValue(/Current camera paragraph/)
  expect(await root.boundingBox()).toEqual(before)
  const edited='A current paragraph corrected inside the drawer. '.repeat(20)
  await field.fill(edited);await expect(display.locator('.script-track p').nth(1)).toHaveText(edited)
  await expect(display.locator('.display-footer')).toContainText('STANDBY')
  for(const size of [{width:390,height:250},{width:390,height:400},{width:844,height:390},{width:320,height:480}]){
   await remote.setViewportSize(size)
   const done=remote.getByRole('button',{name:/^Done/})
   await expect.poll(async()=>{const box=(await drawer.boundingBox())!;return box.y+box.height}).toBeLessThanOrEqual(size.height+1)
   const button=(await done.boundingBox())!,text=(await field.boundingBox())!
   expect(button.y).toBeGreaterThanOrEqual(0);expect(button.y+button.height).toBeLessThanOrEqual(size.height+1)
   expect(text.y).toBeGreaterThanOrEqual(button.y+button.height);expect(text.height).toBeGreaterThanOrEqual(70)
   const sheet=(await drawer.boundingBox())!
   expect(text.y+text.height).toBeLessThanOrEqual(sheet.y+sheet.height-10)
   await field.focus();await field.press('Tab');expect(await remote.evaluate(()=>Boolean(document.activeElement?.closest('.remote-drawer')))).toBe(true)
   expect(await remote.evaluate(()=>[scrollY,document.querySelector('main')!.scrollTop])).toEqual([0,0])
   if(browserName==='chromium')await drawer.screenshot({path:info.outputPath(`drawer-${size.width}x${size.height}.png`)})
  }
  await remote.setViewportSize({width:390,height:844})
  await remote.getByRole('button',{name:/^Done/}).click()
  await expect(drawer).not.toBeVisible();await expect(remote.getByRole('button',{name:'Quick edit current paragraph'})).toBeFocused()
  expect(await root.boundingBox()).toEqual(before)
  await remote.getByRole('button',{name:'Quick edit current paragraph'}).click();await expect(remote.getByRole('status').filter({hasText:/^Updated$/})).toBeVisible();await field.press('Escape');await expect(drawer).not.toBeVisible()
  await remote.getByRole('button',{name:'Play',exact:true}).click();await expect(display.locator('.display-footer')).toContainText('ROLLING')
  await remote.getByRole('button',{name:'Pause',exact:true}).click()
 }finally{await phones.close();await displays.close()}
})

test('a speed acknowledgement survives delayed broadcasts and newer reading checkpoints',async({page:editor,browser,browserName})=>{
 const phones=await browser.newContext(phoneOptions(browserName)),displays=await browser.newContext()
 const remote=await phones.newPage(),display=await displays.newPage()
 let hold=false,readings=0,release=()=>{}
 await remote.routeWebSocket('**/socket/websocket**',ws=>{
  const server=ws.connectToServer(),held:(string|Buffer)[]=[]
  release=()=>{hold=false;for(const message of held)ws.send(message);held.length=0}
  server.onMessage(message=>{
   const payload=JSON.parse(message.toString())
   if(payload[3]==='reading:update')readings++
   if(hold&&payload[3]==='transport:update')held.push(message)
   else ws.send(message)
  })
 })
 try{
  await pair(editor,display,remote)
  const speed=remote.getByRole('slider',{name:'Playback speed'})
  hold=true
  await speed.fill('1');await expect(display.locator('.display-footer')).toContainText('1.00×')
  const previous=readings
  await speed.press('Home');await expect(speed).toHaveValue('0.5');await expect(display.locator('.display-footer')).toContainText('0.50×')
  await expect.poll(()=>readings).toBeGreaterThan(previous)
  await expect(speed).toHaveValue('0.5')
  await speed.press('ArrowUp');await expect(speed).toHaveValue('0.51');await expect(display.locator('.display-footer')).toContainText('0.51×')
  release();await expect(speed).toHaveValue('0.51')
 }finally{await phones.close();await displays.close()}
})
