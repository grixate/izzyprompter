import {test,expect} from '@playwright/test'
import {phoneOptions} from './helpers/phone'

test('paragraph editor follows browser and keyboard viewport offsets with safe insets',async({browser,browserName},info)=>{
 const context=await browser.newContext(phoneOptions(browserName))
 // Explicit simulation: this does not open an OS keyboard or certify a device.
 await context.addInitScript(()=>{
  const viewport=Object.assign(new EventTarget(),{width:390,height:700,offsetTop:44,offsetLeft:0,scale:1})
  Object.defineProperty(window,'visualViewport',{configurable:true,value:viewport})
 })
 const page=await context.newPage()
 try{
  await page.goto('/lab/jog?review=collection&device=1&skin=groove')
  await page.getByRole('button',{name:'Quick edit current paragraph'}).click()
  const drawer=page.getByRole('dialog',{name:'Current paragraph'}),field=page.getByRole('textbox',{name:'Demo current paragraph'}),done=drawer.getByRole('button',{name:'Done',exact:true})
  await expect(field).toBeFocused()
  await drawer.evaluate(el=>{const s=(el as HTMLElement).style;s.setProperty('--editor-safe-top','47px');s.setProperty('--editor-safe-bottom','34px');s.setProperty('--editor-safe-left','44px');s.setProperty('--editor-safe-right','44px')})
  for(const view of [{width:390,height:700,offsetTop:44,offsetLeft:0},{width:390,height:320,offsetTop:76,offsetLeft:0},{width:350,height:250,offsetTop:96,offsetLeft:20},{width:390,height:700,offsetTop:44,offsetLeft:0}]){
   await page.evaluate(view=>{Object.assign(window.visualViewport!,view);window.visualViewport!.dispatchEvent(new Event('resize'));window.visualViewport!.dispatchEvent(new Event('scroll'))},view)
   await expect.poll(async()=>{const b=(await drawer.boundingBox())!;return Math.abs(b.y+b.height-view.offsetTop-view.height)}).toBeLessThan(1)
   const sheet=(await drawer.boundingBox())!,text=(await field.boundingBox())!,button=(await done.boundingBox())!
   expect(sheet.y).toBeGreaterThanOrEqual(view.offsetTop+46)
   expect(sheet.x).toBeGreaterThanOrEqual(view.offsetLeft-1);expect(sheet.x+sheet.width).toBeLessThanOrEqual(view.offsetLeft+view.width+1)
   expect(button.y).toBeGreaterThanOrEqual(sheet.y);expect(button.y+button.height).toBeLessThanOrEqual(text.y)
   expect(button.width).toBeGreaterThanOrEqual(44);expect(button.height).toBeGreaterThanOrEqual(44)
   expect(text.x).toBeGreaterThanOrEqual(sheet.x+43);expect(text.x+text.width).toBeLessThanOrEqual(sheet.x+sheet.width-43)
   expect(text.height).toBeGreaterThanOrEqual(70);expect(text.y+text.height).toBeLessThanOrEqual(sheet.y+sheet.height-33)
   expect(await drawer.locator('footer').count()).toBe(0)
   await field.fill('A quiet prompter paragraph. '.repeat(20))
   await field.press('Tab');await expect(done).toBeFocused();await done.press('Tab');await expect(field).toBeFocused()
   if(browserName==='chromium')await drawer.screenshot({path:info.outputPath(`editor-visible-${view.width}x${view.height}.png`)})
  }
  await done.click();await expect(drawer).not.toBeVisible();await expect(page.getByRole('button',{name:'Quick edit current paragraph'})).toBeFocused()
 }finally{await context.close()}
})
