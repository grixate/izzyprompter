import {chromium,firefox,webkit,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
const ids=['groove','clear','arcade','field','signal','vector','cartridge','switchboard','correspondent','foundry','observatory','ivory','graphite','original'],root=new URL('./',import.meta.url),results=[]
await mkdir(new URL('after/',root),{recursive:true})
for(const [name,engine] of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch(),page=await browser.newPage({viewport:{width:390,height:660}}),errors=[],requests=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\/(api|socket|account)(\/|$)/.test(new URL(r.url()).pathname))requests.push(r.method())})
 try{
  for(const [i,id] of ids.entries()){
   await page.setViewportSize({width:390,height:660});await page.goto('http://127.0.0.1:8780/2026-10-20-final-audit/live/index.html?skin='+id)
   const range=page.getByRole('slider',{name:'Playback speed'}),jog=page.getByRole('slider',{name:'Jog script position'}),exact=page.getByRole('textbox',{name:'Exact playback speed'})
   await expect(range).toHaveValue('0.56');await expect(range).toHaveAttribute('min','0.2');await expect(range).toHaveAttribute('max','1')
   await exact.fill('0.20');await exact.press('Enter');await expect(range).toHaveValue('0.2');await range.press('End');await expect(range).toHaveValue('1');await range.press('Home');await range.press('ArrowUp');await expect(range).toHaveValue('0.21');await exact.fill('0.56');await exact.press('Enter');await expect(range).toHaveValue('0.56')
   await jog.press('End');await expect(page.locator('.timecode')).toHaveAttribute('aria-label','Script position 01:22.4');await jog.press('Home');await jog.press('ArrowRight');await jog.press('ArrowRight');await expect(jog).toHaveAttribute('aria-valuenow','96');await jog.press('ArrowLeft');await expect(jog).toHaveAttribute('aria-valuenow','48')
   // Reset to the same synthetic position for the audit photographs.
   await jog.press('Home');for(let n=0;n<6;n++)await jog.press('ArrowRight')
   for(const size of [{width:390,height:660},{width:320,height:568},{width:320,height:480},{width:844,height:390},{width:768,height:1024}]){
    await page.setViewportSize(size)
    await expect.poll(()=>page.locator('main').evaluate(el=>el.scrollHeight-el.clientHeight),{message:id+' '+JSON.stringify(size)}).toBeLessThanOrEqual(1)
    const layout=await page.locator('main').evaluate(el=>{
     const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}}
     const readout=el.querySelector('.transport-readout'),time=el.querySelector('.timecode')
     const visible=e=>{const s=getComputedStyle(e);return e.getClientRects().length&&s.visibility!=='hidden'&&s.position!=='absolute'}
     return {scroll:el.scrollHeight-el.clientHeight,wide:document.documentElement.scrollWidth-innerWidth,readout:rect(readout),time:rect(time),state:rect(el.querySelector('.state-label')),digits:[...time.querySelectorAll('svg,.counter-digits,.counter-fraction,.printed-time,.clock-number')].filter(visible).map(rect),marks:[...el.querySelectorAll('.speed-marks b')].filter(visible).map(rect)}
    })
    const tag=id+' '+size.width+'x'+size.height
    expect(layout.scroll,tag).toBeLessThanOrEqual(1);expect(layout.wide,tag).toBeLessThanOrEqual(1)
    for(const box of layout.digits){expect(box.x,tag).toBeGreaterThanOrEqual(layout.readout.x-1);expect(box.right,tag).toBeLessThanOrEqual(layout.state.x-4);expect(box.y,tag).toBeGreaterThanOrEqual(layout.readout.y);expect(box.bottom,tag).toBeLessThanOrEqual(layout.readout.bottom)}
    for(let a=0;a<layout.marks.length;a++)for(let b=a+1;b<layout.marks.length;b++){
     const x=layout.marks[a],y=layout.marks[b];expect(x.x<y.right-1&&x.right>y.x+1&&x.y<y.bottom-1&&x.bottom>y.y+1,tag+' speed tick collision').toBe(false)
    }
    if(name==='chromium'&&[660,568].includes(size.height))await page.screenshot({path:new URL(`after/${String(i+1).padStart(2,'0')}-${id}-${size.width}.png`,root).pathname})
    results.push({browser:name,id,...size,readoutFits:true,ticksSeparate:true})
   }
   await page.setViewportSize({width:390,height:660});await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(async()=>Number(await jog.getAttribute('aria-valuenow'))).toBeGreaterThan(288)
   if(id==='observatory'&&name==='chromium')await page.screenshot({path:new URL('after/observatory-playing.png',root).pathname})
   await page.getByRole('button',{name:'Pause',exact:true}).click()
   await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Play',exact:true}).click();await expect.poll(()=>page.locator('.jog-wheel').evaluate(el=>el.getAnimations({subtree:true}).length),{message:id+' reduced motion'}).toBe(0);await page.getByRole('button',{name:'Pause',exact:true}).click();await page.emulateMedia({reducedMotion:'no-preference'})
  }
  expect(errors).toEqual([]);expect(requests).toEqual([])
 }finally{await browser.close()}
}
await writeFile(new URL('preview-checks.json',root),JSON.stringify({results,pageErrors:0,sessionOrAccountRequests:0,physicalDevice:false},null,2)+'\n')
console.log('Audited 14 remotes × 5 viewports × 3 engines: 210 states; exact speed, time, motion and keyboard passed.')
