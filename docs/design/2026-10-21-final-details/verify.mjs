import {chromium,firefox,webkit,expect} from '@playwright/test'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
const root=new URL('./',import.meta.url),items=JSON.parse(await readFile(new URL('../2026-10-20-touch-layout/instruments.json',root))),results=[],failures=[],pageErrors=[]
await mkdir(new URL('after/',root),{recursive:true})
const sizes=[[320,480],[320,568],[320,640],[360,640],[390,660],[428,746],[428,926],[568,320],[844,390],[768,1024]]
for(const [engine,launcher] of Object.entries(process.env.ONE_ENGINE?{chromium}:{chromium,firefox,webkit})){
 const browser=await launcher.launch(),page=await browser.newPage({viewport:{width:428,height:746},hasTouch:true})
 page.on('pageerror',e=>pageErrors.push({engine,message:e.message}))
 try{
  for(const [id] of items){
   await page.goto('http://127.0.0.1:8780/2026-10-21-final-details/live/index.html?skin='+id)
   const jog=page.getByRole('slider',{name:'Jog script position'}),speed=page.getByRole('slider',{name:'Playback speed',exact:true})
   await expect(speed).toHaveValue('0.56')
   for(let n=0;n<7;n++)await jog.press('ArrowRight')
   for(const [width,height] of sizes){
    await page.setViewportSize({width,height})
    const data=await page.locator('main').evaluate(el=>{
     const rect=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height}}
     return {scroll:el.scrollHeight-el.clientHeight,wide:document.documentElement.scrollWidth-innerWidth,wheel:rect(el.querySelector('.jog-wheel')),readout:rect(el.querySelector('.transport-readout')),time:rect(el.querySelector('.timecode')),input:[...el.querySelectorAll('.speed-track>input,.speed-exact')].map(rect),buttons:[...el.querySelectorAll('.phrase-nav button,.remote-tools button')].map(rect),play:rect(el.querySelector('.transport-button')),marks:[...el.querySelectorAll('.speed-marks b')].filter(e=>e.getClientRects().length).map(e=>({...rect(e),font:parseFloat(getComputedStyle(e).fontSize)})),slot:el.querySelector('.readout--cartridge')?rect(el.querySelector('.transport-readout')).y+parseFloat(getComputedStyle(el.querySelector('.transport-readout'),'::before').top):null,header:rect(el.querySelector('.remote-header'))}
    }),label=`${engine} ${id} ${width}×${height}`
    const check=(ok,message)=>{if(!ok)failures.push(label+' '+message)}
    check(data.scroll<=1&&data.wide<=1,'overflow')
    check(data.wheel.width>=128,'jog minimum')
    if(width===428&&height===746)check(data.wheel.width/width>=.8,'wheel must dominate width')
    for(const b of [...data.input,...data.buttons,data.play]){check(b.x>=-1&&b.y>=-1&&b.right<=width+1&&b.bottom<=height+1,'control outside viewport');check(b.width>=44&&b.height>=(b===data.play?44:48),'touch target')}
    for(const a of data.buttons)for(const s of data.input)check(Math.hypot(Math.max(a.x-s.right,s.x-a.right,0),Math.max(a.y-s.bottom,s.y-a.bottom,0))>=20,'speed/action separation')
    for(const m of data.marks)check(m.x>=0&&m.right<=width&&m.bottom<=height&&m.font>=11,'legend fit or size')
    for(let a=0;a<data.marks.length;a++)for(let b=a+1;b<data.marks.length;b++){const x=data.marks[a],y=data.marks[b];check(Math.hypot(Math.max(x.x-y.right,y.x-x.right,0),Math.max(x.y-y.bottom,y.y-x.bottom,0))>=8,'legend collision')}
    check(!(data.readout.x<data.wheel.right-1&&data.readout.right>data.wheel.x+1&&data.readout.y<data.wheel.bottom-1&&data.readout.bottom>data.wheel.y+1),'readout/wheel collision')
    check(data.time.y>=data.readout.y-1&&data.time.bottom<=data.readout.bottom+1,'time outside display')
    if(data.slot!==null)check(data.slot>=data.header.bottom+3,'cartridge slot/branding')
    if(['arcade','graphite','correspondent'].includes(id)){
     for(const s of data.input)check(Math.hypot(Math.max(data.play.x-s.right,s.x-data.play.right,0),Math.max(data.play.y-s.bottom,s.y-data.play.bottom,0))>=12,'Play/speed collision')
    }
    if(engine==='chromium'&&width===428&&height===746)await page.screenshot({path:new URL(`after/${id}.png`,root).pathname})
    results.push({engine,id,width,height,wheelDiameter:data.wheel.width,wheelShare:data.wheel.width/width})
   }
   await page.setViewportSize({width:428,height:746})
   await jog.press('Home')
   await page.getByRole('button',{name:'Play',exact:true}).click()
   await expect.poll(async()=>Number(await jog.getAttribute('aria-valuenow'))).toBeGreaterThan(0)
   await page.getByRole('button',{name:'Pause',exact:true}).click()
   await page.getByRole('button',{name:'Next phrase'}).click();await expect(jog).toHaveAttribute('aria-valuenow','300')
   await jog.press('ArrowRight');const beforeDrag=Number(await jog.getAttribute('aria-valuenow')),box=await jog.boundingBox()
   await page.mouse.move(box.x+box.width*.84,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.84,{steps:12});await page.mouse.up()
   await expect.poll(async()=>Number(await jog.getAttribute('aria-valuenow'))).toBeGreaterThan(beforeDrag)
   const exact=page.getByRole('textbox',{name:'Exact playback speed'});await exact.fill('0.62');await exact.press('Enter');await expect(speed).toHaveValue('0.62')
   await speed.press((await speed.getAttribute('aria-orientation'))==='vertical'?'ArrowUp':'ArrowRight');await expect(speed).toHaveValue('0.63')
   await page.getByRole('button',{name:'Quick edit current paragraph'}).click();await expect(page.getByRole('textbox',{name:'Demo current paragraph'})).toBeFocused();await page.getByRole('button',{name:'Done',exact:true}).click()
  }
 }finally{await browser.close()}
}
await writeFile(new URL('checks.json',root),JSON.stringify({results,failures,pageErrors,physicalDevices:false},null,2)+'\n')
console.log(JSON.stringify({states:results.length,failures:failures.length,pageErrors,examples:failures.slice(0,35)},null,2))
if(failures.length||pageErrors.length)process.exitCode=1
