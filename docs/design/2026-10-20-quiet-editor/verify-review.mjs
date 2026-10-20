import {chromium,firefox,webkit,expect} from '@playwright/test'
import {mkdir,writeFile} from 'node:fs/promises'
const root=new URL('./',import.meta.url),results=[]
await mkdir(new URL('references/',root),{recursive:true})
for(const [name,engine] of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch(),page=await browser.newPage({viewport:{width:390,height:660}}),errors=[],requests=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\/(api|socket|account)(\/|$)/.test(new URL(r.url()).pathname))requests.push(r.method())})
 try{
  await page.goto('http://127.0.0.1:8780/2026-10-20-quiet-editor/live/index.html?skin=groove&edit=1')
  const drawer=page.getByRole('dialog',{name:'Current paragraph'}),field=page.getByRole('textbox',{name:'Demo current paragraph'}),done=drawer.getByRole('button',{name:'Done',exact:true})
  await expect(field).toBeFocused();await expect(drawer.getByRole('status')).toHaveText('Preview')
  for(const size of [{width:390,height:660},{width:320,height:250},{width:700,height:260}]){
   await page.setViewportSize(size)
   await expect.poll(async()=>{const b=(await drawer.boundingBox());return Math.abs(b.y+b.height-size.height)}).toBeLessThan(1)
   const sheet=(await drawer.boundingBox()),text=(await field.boundingBox()),button=(await done.boundingBox())
   expect(sheet.y).toBeGreaterThanOrEqual(7);expect(sheet.width).toBe(Math.min(620,size.width))
   expect(text.y).toBeGreaterThanOrEqual(button.y+button.height);expect(text.height).toBeGreaterThanOrEqual(100)
   expect(text.y+text.height).toBeLessThanOrEqual(size.height-10)
   expect(button.width).toBeGreaterThanOrEqual(44);expect(button.height).toBeGreaterThanOrEqual(44)
   expect(await field.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)')
   expect(await drawer.locator('footer').count()).toBe(0)
   if(name==='chromium')await page.screenshot({path:new URL(`references/editor-${size.width}x${size.height}.png`,root).pathname})
   results.push({browser:name,...size,doneAndTextVisible:true,noFooter:true})
  }
  await field.fill('A correction in the quiet editor.');await done.click();await expect(drawer).not.toBeVisible()
  await page.setViewportSize({width:390,height:660});await page.getByRole('button',{name:'Quick edit current paragraph'}).click();await expect(field).toHaveValue('A correction in the quiet editor.')
  await done.click();await page.getByRole('button',{name:'Change remote skin'}).click();await expect(page.getByRole('dialog',{name:'Choose an instrument.'})).toBeVisible();await page.getByRole('button',{name:'Use Clear',exact:true}).click();await expect(page.locator('.standalone-remote')).toHaveClass(/skin--clear/)
  expect(errors).toEqual([]);expect(requests).toEqual([])
 }finally{await browser.close()}
}
await writeFile(new URL('preview-checks.json',root),JSON.stringify({results,pageErrors:0,sessionOrAccountRequests:0,physicalKeyboard:false},null,2)+'\n')
console.log('Quiet editor: 9 viewport states, 3 engines; edit/close/reopen/picker passed.')
