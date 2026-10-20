import {chromium,firefox,webkit,expect} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
const root='http://127.0.0.1:8780/2026-10-20-fixed-remote/',instruments=JSON.parse(await readFile(new URL('./instruments.json',import.meta.url)))
const results=[]
for(const [browserName,engine] of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch(),page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],requests=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\/(api|socket|account)(\/|$)/.test(new URL(r.url()).pathname))requests.push(r.method())})
 try{
  for(const [skin] of instruments){
   await page.setViewportSize({width:390,height:844});await page.goto(root+'live/index.html?skin='+skin)
   const main=page.locator('.standalone-remote');await expect(main).toHaveClass(new RegExp('skin--'+skin))
   for(const size of [{width:390,height:844},{width:320,height:568},{width:320,height:480},{width:568,height:320},{width:844,height:390}]){
    await page.setViewportSize(size)
    const measure=await main.evaluate(el=>({scroll:el.scrollHeight-el.clientHeight,wide:document.documentElement.scrollWidth-innerWidth,parts:[...el.querySelectorAll('.remote-header,.transport-readout,.jog-wheel,.transport-button,.speed-track input,.speed-exact,.phrase-nav button,.quick-edit-trigger,.remote-finish-button')].map(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom}})}))
    expect(measure.scroll,skin+' '+size.width+' content fits').toBeLessThanOrEqual(1);expect(measure.wide).toBeLessThanOrEqual(1)
    for(const box of measure.parts){expect(box.x).toBeGreaterThanOrEqual(-1);expect(box.y).toBeGreaterThanOrEqual(-1);expect(box.right).toBeLessThanOrEqual(size.width+1);expect(box.bottom).toBeLessThanOrEqual(size.height+1)}
    if(skin==='cartridge')expect(await main.evaluate(el=>el.querySelector('.transport-readout').getBoundingClientRect().top+parseFloat(getComputedStyle(el.querySelector('.transport-readout'),'::before').top)-el.querySelector('.remote-header').getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(3)
    if(browserName==='chromium'&&[568,844].includes(size.height))await main.screenshot({path:new URL('./references/'+skin+(size.width===390?'':'-320')+'.png',import.meta.url).pathname})
   }
   await page.setViewportSize({width:390,height:844})
   await page.getByRole('button',{name:'Play',exact:true}).click();await expect(page.locator('.jog-wheel')).toHaveAttribute('data-running','true')
   const before=await main.boundingBox()
   await page.getByRole('button',{name:'Quick edit current paragraph'}).click()
   const drawer=page.getByRole('dialog',{name:'A small correction.'}),text=page.getByRole('textbox',{name:'Demo current paragraph'})
   await expect(drawer).toBeVisible();expect(await main.boundingBox()).toEqual(before)
   expect(await drawer.evaluate(el=>el.matches(':modal'))).toBe(true)
   if(browserName==='chromium'&&skin==='groove')await page.screenshot({path:new URL('./references/drawer-phone.png',import.meta.url).pathname})
   await text.fill('Synthetic correction inside a separate drawer.')
   await page.setViewportSize({width:390,height:250})
   await expect.poll(async()=>{const b=(await drawer.boundingBox());return b.y+b.height}).toBeLessThanOrEqual(251)
   const done=drawer.getByRole('button',{name:/^Done/});await expect(done).toBeInViewport()
   if(browserName==='chromium'&&skin==='groove')await drawer.screenshot({path:new URL('./references/drawer-keyboard-height.png',import.meta.url).pathname})
   await done.click();await expect(drawer).not.toBeVisible()
   await page.setViewportSize({width:390,height:844});expect(await main.boundingBox()).toEqual(before)
   await expect(page.getByRole('button',{name:'Quick edit current paragraph'})).toBeFocused()
   expect(await page.evaluate(()=>[scrollY,document.querySelector('main').scrollTop])).toEqual([0,0])
   await page.getByRole('button',{name:'Change remote skin'}).click();await expect(page.getByRole('dialog',{name:'Choose an instrument.'})).toBeVisible();await page.getByRole('button',{name:'Done',exact:true}).click()
   results.push({browser:browserName,skin,viewports:5,scroll:false,controlsVisible:true,drawer:true,keyboardSizedViewport:true})
  }
  await page.goto(root+'review.html');await expect(page.locator('article')).toHaveCount(14)
  for(const card of await page.locator('article').all()){await card.scrollIntoViewIfNeeded();await expect.poll(()=>card.locator('img').evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true)}
  expect(errors).toEqual([]);expect(requests).toEqual([])
 }finally{await browser.close()}
}
await writeFile(new URL('./preview-checks.json',import.meta.url),JSON.stringify({results,pageErrors:0,sessionOrAccountRequests:0},null,2)+'\n')
console.log(JSON.stringify({instruments:14,browsers:3,states:results.length*5,errors:0}))
