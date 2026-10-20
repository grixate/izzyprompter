import {chromium,firefox,webkit,expect} from '@playwright/test'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
const root=new URL('./',import.meta.url),items=JSON.parse(await readFile(new URL('instruments.json',root))),results=[]
await mkdir(new URL('after/',root),{recursive:true})
for(const [name,engine] of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch(),page=await browser.newPage({viewport:{width:320,height:568},hasTouch:true}),errors=[]
 page.on('pageerror',e=>errors.push(e.message))
 try{
  for(const [id] of items){
   await page.goto('http://127.0.0.1:8780/2026-10-20-touch-layout/live/index.html?skin='+id)
   await expect(page.getByRole('slider',{name:'Playback speed'})).toHaveValue('0.56')
   for(const size of [{width:320,height:480},{width:320,height:568},{width:390,height:660},{width:390,height:844},{width:568,height:320},{width:844,height:390}]){
    await page.setViewportSize(size)
    const data=await page.locator('main').evaluate(el=>{
     const rect=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height}}
     const input=[...el.querySelectorAll('.speed-track>input,.speed-exact')].map(rect),buttons=[...el.querySelectorAll('.phrase-nav button,.remote-tools button')].map(rect)
     return {scroll:el.scrollHeight-el.clientHeight,wide:document.documentElement.scrollWidth-innerWidth,wheel:rect(el.querySelector('.jog-wheel')),input,buttons,marks:[...el.querySelectorAll('.speed-marks b')].filter(e=>e.getClientRects().length).map(e=>({...rect(e),font:parseFloat(getComputedStyle(e).fontSize)}))}
    }),label=id+' '+size.width+'x'+size.height
    expect(data.scroll,label).toBeLessThanOrEqual(1);expect(data.wide,label).toBeLessThanOrEqual(1);expect(data.wheel.width,label).toBeGreaterThanOrEqual(128)
    for(const a of data.buttons){expect(a.width,label).toBeGreaterThanOrEqual(52);expect(a.height,label).toBeGreaterThanOrEqual(52);for(const s of data.input)expect(Math.hypot(Math.max(a.x-s.right,s.x-a.right,0),Math.max(a.y-s.bottom,s.y-a.bottom,0)),label+' separation').toBeGreaterThanOrEqual(20)}
    for(const b of [...data.input,...data.buttons,...data.marks]){expect(b.x,label).toBeGreaterThanOrEqual(0);expect(b.right,label).toBeLessThanOrEqual(size.width);expect(b.bottom,label).toBeLessThanOrEqual(size.height)}
    for(const m of data.marks)expect(m.font,label).toBeGreaterThanOrEqual(11)
    if(name==='chromium'&&[568,660].includes(size.height))await page.screenshot({path:new URL(`after/${id}-${size.width}.png`,root).pathname})
    if(name==='chromium'&&id==='ivory'&&size.height===320)await page.screenshot({path:new URL('after/orbit-landscape.png',root).pathname})
    results.push({browser:name,id,...size,minimumSeparation:Math.min(...data.buttons.flatMap(a=>data.input.map(s=>Math.hypot(Math.max(a.x-s.right,s.x-a.right,0),Math.max(a.y-s.bottom,s.y-a.bottom,0))))),jogDiameter:data.wheel.width})
   }
  }
  expect(errors).toEqual([])
 }finally{await browser.close()}
}
await writeFile(new URL('preview-checks.json',root),JSON.stringify({results,pageErrors:0,physicalDevices:false},null,2)+'\n')
console.log('Built preview passed: 14 skins × 6 sizes × 3 engines; touch separation, legibility and viewport fit.')
