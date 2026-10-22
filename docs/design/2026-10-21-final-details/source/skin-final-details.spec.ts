import {test,expect,type Page} from '@playwright/test'
import {phoneOptions} from './helpers/phone'

const open=(page:Page,skin:string)=>page.goto(`/lab/jog?review=collection&device=1&skin=${skin}`)
async function dialGeometry(page:Page,skin:string){
 const r=(await page.locator('.speed-rail').boundingBox())!
 return {cx:r.x+r.width/2,cy:r.y+r.height*(skin==='signal'?.7:.5)}
}
async function arc(page:Page,c:{cx:number;cy:number},from:number,to:number,fine=false){
 const point=(angle:number)=>({x:c.cx+30*Math.cos(angle*Math.PI/180),y:c.cy+30*Math.sin(angle*Math.PI/180)})
 const start=point(from);await page.mouse.move(start.x,start.y);if(fine)await page.keyboard.down('Shift');await page.mouse.down()
 for(let n=1;n<=12;n++){const p=point(from+(to-from)*n/12);await page.mouse.move(p.x,p.y)}
 await page.mouse.up();if(fine)await page.keyboard.up('Shift')
}
// Native input coordinates are rounded to CSS pixels in Firefox/WebKit.
const nearSpeed=(page:Page,value:number)=>expect.poll(async()=>Math.abs(Number(await page.getByRole('slider',{name:'Playback speed',exact:true}).inputValue())-value)).toBeLessThanOrEqual(.02001)

test('only changed counter drums roll, including after pause and resume',async({browser,browserName})=>{
 test.setTimeout(60_000)
 const context=await browser.newContext(phoneOptions(browserName)),page=await context.newPage()
 try{
  for(const skin of ['groove','foundry','correspondent']){
   await open(page,skin)
   const counter=page.locator('.counter-digits')
   await counter.evaluate(el=>{el.setAttribute('data-events','');el.addEventListener('animationstart',event=>{const e=event as AnimationEvent,target=e.target as HTMLElement;if(e.animationName==='counter-step'){const index=[...el.querySelectorAll('.counter-drum')].indexOf(target.parentElement!);el.setAttribute('data-events',el.getAttribute('data-events')+index+':'+target.textContent+';')}})})
   await page.getByRole('button',{name:'Play',exact:true}).click()
   await expect.poll(async()=>((await counter.getAttribute('data-events'))||'').split(';').filter(Boolean).length).toBeGreaterThanOrEqual(2)
   await page.getByRole('button',{name:'Pause',exact:true}).click()
   const before=(await counter.getAttribute('data-events'))!
   await page.getByRole('button',{name:'Play',exact:true}).click()
   await expect.poll(()=>counter.getAttribute('data-events')).not.toBe(before)
   await page.getByRole('button',{name:'Pause',exact:true}).click()
   const events=(await counter.getAttribute('data-events'))!.split(';').filter(Boolean)
   expect(events.length).toBeGreaterThanOrEqual(3)
   expect(events.every(event=>event.startsWith('3:')),skin+' unchanged minutes/tens must never roll').toBe(true)
   await page.emulateMedia({reducedMotion:'reduce'})
   await page.getByRole('button',{name:'Play',exact:true}).click()
   expect(await counter.evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0)
   await page.emulateMedia({reducedMotion:'no-preference'})
  }
 }finally{await context.close()}
})

test('dials turn naturally, rollers track the hand, pointer focus has no box',async({browser,browserName})=>{
 test.setTimeout(90_000)
 const context=await browser.newContext(phoneOptions(browserName)),page=await context.newPage()
 try{
  for(const skin of ['signal','vector','ivory','correspondent']){
   await open(page,skin);const speed=page.getByRole('slider',{name:'Playback speed',exact:true}),exact=page.getByRole('textbox',{name:'Exact playback speed'})
   await expect(speed).toHaveValue('0.56');const centre=await dialGeometry(page,skin)
   await page.mouse.click(centre.cx,centre.cy-30);await expect(speed).toHaveValue('0.56')
   await arc(page,centre,-90,-70);await nearSpeed(page,skin==='signal'?.72:.62)
   await arc(page,centre,-70,-90);await expect(speed).toHaveValue('0.56')
   await expect(page.locator('.speed-track')).toHaveCSS('outline-style','none')
   await expect(page.locator('.speed-track')).toHaveAttribute('data-keyboard-focus','false')
   await arc(page,centre,170,190);await nearSpeed(page,skin==='signal'?.72:.62)
   await exact.fill('0.56');await exact.press('Enter')
   await arc(page,centre,-90,-70,true);await nearSpeed(page,skin==='signal'?.6:.57)
   await speed.press('ArrowUp');await expect(page.locator('.speed-track')).toHaveAttribute('data-keyboard-focus','true')
   await expect(page.locator('.speed-handle')).toHaveCSS('outline-style','solid')
   // A long captured gesture may leave the control without sticking its drag.
   await page.mouse.move(centre.cx,centre.cy);await page.mouse.down();await page.mouse.move(centre.cx,centre.cy-400,{steps:8});await page.mouse.up();await expect(speed).toHaveValue('1')
  }
  for(const skin of ['field','switchboard']){
   await open(page,skin);const speed=page.getByRole('slider',{name:'Playback speed',exact:true}),box=(await speed.boundingBox())!,rail=(await page.locator('.speed-rail').boundingBox())!,before=(await page.locator('.speed-handle').boundingBox())!
   await page.mouse.move(before.x+before.width/2,box.y+box.height/2);await page.mouse.down();await expect(speed).toHaveValue('0.56')
   await page.mouse.move(before.x+before.width/2+rail.width/4,box.y+box.height/2,{steps:12});await page.mouse.up();await expect(speed).toHaveValue('0.76')
   const after=(await page.locator('.speed-handle').boundingBox())!
   expect(after.x-before.x).toBeCloseTo(rail.width/4,0)
   await expect(page.locator('.speed-track')).toHaveCSS('outline-style','none')
  }
 }finally{await context.close()}
})

test('Original retains its black monitor without reducing the wheel',async({page})=>{
 await page.setViewportSize({width:428,height:746});await open(page,'original')
 await expect(page.locator('.readout--original')).toHaveCSS('background-color','rgb(10, 12, 10)')
 await expect(page.locator('.readout--original')).toHaveCSS('border-top-style','solid')
 expect((await page.locator('.jog-wheel').boundingBox())!.width).toBeGreaterThan(370)
 const whole=await page.locator('.printed-time').evaluate(el=>getComputedStyle(el,'::before').content)
 expect(whole).toContain('00:10')
})

test('touch arcs and roller drags use the same direction and release capture',async({browser,browserName})=>{
 test.skip(browserName!=='chromium','Trusted touch move emulation uses the Chromium input protocol.')
 const context=await browser.newContext({...phoneOptions(browserName),baseURL:'http://127.0.0.1:4173'}),page=await context.newPage(),cdp=await context.newCDPSession(page)
 const touch=(type:string,x?:number,y?:number)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,id:1,radiusX:5,radiusY:5}]})
 try{
  for(const skin of ['signal','vector','ivory','correspondent','field','switchboard']){
   await open(page,skin);const speed=page.getByRole('slider',{name:'Playback speed',exact:true})
   await expect(speed).toHaveValue('0.56')
   await speed.evaluate(el=>el.addEventListener('pointerdown',event=>el.setAttribute('data-pointer-id',String((event as PointerEvent).pointerId))))
   if(skin==='field'||skin==='switchboard'){
    const r=(await page.locator('.speed-rail').boundingBox())!,h=(await page.locator('.speed-handle').boundingBox())!,x=h.x+h.width/2,y=h.y+h.height/2
    await touch('touchStart',x,y);await expect(speed).toHaveValue('0.56')
    for(let n=1;n<=8;n++)await touch('touchMove',x+r.width*n/32,y)
    await touch('touchEnd');await expect(speed).toHaveValue('0.76')
   }else{
    const c=await dialGeometry(page,skin);await touch('touchStart',c.cx,c.cy-30)
    for(let n=1;n<=8;n++){const a=(-90+20*n/8)*Math.PI/180;await touch('touchMove',c.cx+30*Math.cos(a),c.cy+30*Math.sin(a))}
    await touch('touchEnd');await expect(speed).toHaveValue(skin==='signal'?'0.72':'0.62')
   }
   await expect(page.locator('.speed-track')).toHaveAttribute('data-keyboard-focus','false')
   expect(await speed.evaluate(el=>el.hasPointerCapture(Number(el.getAttribute('data-pointer-id'))))).toBe(false)
  }
 }finally{await context.close()}
})
