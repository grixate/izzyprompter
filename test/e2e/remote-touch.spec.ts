import {test,expect} from '@playwright/test'
import {skins,controlCraftSkins} from '../../src/product/catalog'
import {phoneOptions} from './helpers/phone'

test('selected remotes separate speed from phrase actions and keep readable touch controls',async({browser,browserName},info)=>{
 test.setTimeout(120_000)
 const context=await browser.newContext(phoneOptions(browserName)),page=await context.newPage()
 const sizes=[{width:320,height:480},{width:320,height:568},{width:360,height:640},{width:390,height:660},{width:390,height:844},{width:568,height:320},{width:844,height:390},{width:768,height:1024}]
 try{
  for(const skin of skins.filter(s=>controlCraftSkins.has(s.id))){
   await page.goto('/lab/jog?review=collection&device=1&skin='+skin.id)
   await expect(page.getByRole('slider',{name:'Playback speed'})).toHaveValue('0.56')
   for(const size of sizes){
    await page.setViewportSize(size)
    const geometry=await page.locator('main').evaluate(el=>{
     const box=(e:Element)=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height}}
     const speed=[...el.querySelectorAll('.speed-track>input,.speed-exact')].map(box)
     const actions=[...el.querySelectorAll('.phrase-nav button,.remote-tools button')].map(box)
     const marks=[...el.querySelectorAll('.speed-marks b')].filter(e=>e.getClientRects().length).map(e=>({...box(e),font:parseFloat(getComputedStyle(e).fontSize)}))
     return {speed,actions,marks,wheel:box(el.querySelector('.jog-wheel')!),summary:box(el.querySelector('.speed-summary')!),title:box(el.querySelector('.speed-title')!),value:box(el.querySelector('.speed-value')!),scroll:el.scrollHeight-el.clientHeight,wide:document.documentElement.scrollWidth-innerWidth}
    })
    const label=skin.id+' '+size.width+'×'+size.height
    expect.soft(geometry.scroll,label+' vertical fit').toBeLessThanOrEqual(1);expect.soft(geometry.wide,label+' horizontal fit').toBeLessThanOrEqual(1)
    expect.soft(geometry.wheel.width,label+' jog diameter').toBeGreaterThanOrEqual(128)
    for(const b of [...geometry.speed,...geometry.actions]){
     expect.soft(b.x,label+' left').toBeGreaterThanOrEqual(-1);expect.soft(b.y,label+' top').toBeGreaterThanOrEqual(-1)
     expect.soft(b.right,label+' right').toBeLessThanOrEqual(size.width+1);expect.soft(b.bottom,label+' bottom').toBeLessThanOrEqual(size.height+1)
     expect.soft(b.width,label+' touch width').toBeGreaterThanOrEqual(44);expect.soft(b.height,label+' touch height').toBeGreaterThanOrEqual(48)
    }
    for(const a of geometry.actions){
     expect.soft(a.width,label+' action width').toBeGreaterThanOrEqual(52);expect.soft(a.height,label+' action height').toBeGreaterThanOrEqual(52)
     for(const s of geometry.speed){const dx=Math.max(a.x-s.right,s.x-a.right,0),dy=Math.max(a.y-s.bottom,s.y-a.bottom,0);expect.soft(Math.hypot(dx,dy),label+' speed/action separation').toBeGreaterThanOrEqual(20)}
    }
    for(const b of geometry.marks){expect.soft(b.font,label+' legend size').toBeGreaterThanOrEqual(11);expect.soft(b.x,label+' legend left').toBeGreaterThanOrEqual(0);expect.soft(b.right,label+' legend right').toBeLessThanOrEqual(size.width);expect.soft(b.bottom,label+' legend bottom').toBeLessThanOrEqual(size.height)}
    for(let a=0;a<geometry.marks.length;a++)for(let b=a+1;b<geometry.marks.length;b++){const x=geometry.marks[a],y=geometry.marks[b];expect.soft(Math.hypot(Math.max(x.x-y.right,y.x-x.right,0),Math.max(x.y-y.bottom,y.y-x.bottom,0)),label+' space between legends').toBeGreaterThanOrEqual(8)}
    if(browserName==='chromium'&&[568,660].includes(size.height))await page.screenshot({path:info.outputPath(`${skin.id}-${size.width}.png`)})
   }
   await page.setViewportSize({width:390,height:660})
   const range=page.getByRole('slider',{name:'Playback speed'}),next=page.getByRole('button',{name:'Next phrase'}),before=(await page.locator('.phrase-count').textContent())!
   const s=(await range.boundingBox())!,n=(await next.boundingBox())!,x=Math.max(s.x,n.x)+8,y=(s.y+s.height+n.y)/2
   // The empty band is a real inert area, not another invisible hit target.
   expect(await page.evaluate(({x,y})=>!!document.elementFromPoint(x,y)?.closest('button,input'),{x,y})).toBe(false)
   await page.touchscreen.tap(x,y);await expect(range).toHaveValue('0.56');await expect(page.locator('.phrase-count')).toHaveText(before)
   await next.tap();await expect(page.locator('.phrase-count')).not.toHaveText(before);await expect(range).toHaveValue('0.56')
  }
 }finally{await context.close()}
})
