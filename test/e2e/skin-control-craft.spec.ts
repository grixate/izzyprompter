import { openRemoteSkins } from './helpers/open-remote-skins'
import { test, expect } from '@playwright/test'
import { skins, skinStorageKey } from '../../src/product/catalog'
import { createSyntheticSession } from './helpers/create-synthetic-session'
import { phoneOptions } from './helpers/phone'
import { checkRenderedContrast } from './helpers/rendered-contrast'

// Local object-only review uses the same paired flow; CI keeps the complete set.
const ids=process.env.IZZY_OBJECT_REVIEW ? ['clear','arcade'] : ['groove','field','signal','vector','foundry','ivory','original','graphite','cartridge','switchboard','correspondent','observatory','clear','arcade']
const collection=ids.map(id=>skins.find(skin=>skin.id===id)!)
test.use({trace:'off',screenshot:'off'})

test('curated control banks keep real phrase navigation, live editing and touch geometry',async({page:editor,browser,browserName},info)=>{
  test.setTimeout(30_000 + collection.length * 15_000)
  const phones=await browser.newContext(phoneOptions(browserName))
  const displays=await browser.newContext()
  await phones.addInitScript(key=>localStorage.setItem(key,'groove'),skinStorageKey)
  const remote=await phones.newPage(),display=await displays.newPage()
  const text='A synthetic control craft review. '.repeat(25).trim()
  try {
    await editor.goto('/')
    await editor.getByRole('textbox',{name:'Teleprompter script'}).fill(text+'\n\nSecond synthetic paragraph.\n\nThird synthetic paragraph.')
    await createSyntheticSession(editor)
    const displayHref=await editor.getByRole('link',{name:/OPEN DISPLAY/}).getAttribute('href')
    const remoteHref=await editor.getByRole('link',{name:/OPEN REMOTE/}).getAttribute('href')
    await remote.route('**/api/sessions/*/appearance',route=>route.fulfill({json:{pro:true}}))
    await Promise.all([display.goto(displayHref!),remote.goto(remoteHref!)])
    await expect(remote.getByRole('button',{name:'Next phrase'})).toBeEnabled()
    await editor.goto('about:blank')
    for(const skin of collection) {
      await openRemoteSkins(remote)
      await remote.getByRole('button',{name:`Use ${skin.name}`,exact:true}).click()
      await expect(remote.locator('main')).toHaveClass(new RegExp(`skin--${skin.id}`))
      await remote.getByRole('button',{name:'Next phrase'}).click()
      await expect(remote.locator('.phrase-count')).toContainText('02 / 03')
      await remote.getByRole('button',{name:'Previous phrase'}).click()
      await expect(remote.locator('.phrase-count')).toContainText('01 / 03')
      await remote.getByRole('button',{name:'Quick edit current paragraph'}).click()
      const corrected=`${skin.name}: ${text}`
      await remote.getByRole('textbox',{name:'CURRENT PARAGRAPH'}).fill(corrected)
      await expect(display.locator('.script-track p').first()).toHaveText(corrected)
      await remote.getByRole('button',{name:/^Done/i}).click()
      await expect(remote.getByRole('button',{name:'Quick edit current paragraph'})).toBeFocused()
      await remote.getByRole('button',{name:'Play',exact:true}).click()
      await expect(display.locator('.display-footer')).toContainText('ROLLING')
      await remote.getByRole('button',{name:'Pause',exact:true}).click()
      await expect(display.locator('.display-footer')).toContainText('STANDBY')
      await remote.getByRole('slider',{name:'Jog script position'}).press('Home')
      for(const viewport of [{width:320,height:568},{width:844,height:390},{width:390,height:844}]) {
        await remote.setViewportSize(viewport)
        expect(await remote.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1)
        for(const name of ['Previous phrase','Next phrase','Quick edit current paragraph']) {
          const key=remote.getByRole('button',{name}),box=(await key.boundingBox())!
          expect(box.width,`${skin.name}: ${name} width`).toBeGreaterThanOrEqual(44)
          expect(box.height,`${skin.name}: ${name} height`).toBeGreaterThanOrEqual(44)
          await key.scrollIntoViewIfNeeded()
          await expect(key).toBeInViewport()
        }
      }
      await remote.locator('.remote-header').click()
      await checkRenderedContrast(remote,info)
      const play=remote.getByRole('button',{name:'Play',exact:true})
      if(skin.id==='field') {
        const key=(await play.boundingBox())!,wheel=(await remote.locator('.jog-wheel').boundingBox())!
        expect(Math.abs(key.x+key.width/2-wheel.x-wheel.width/2)).toBeLessThan(1)
        expect(Math.abs(key.y+key.height/2-wheel.y-wheel.height/2)).toBeLessThan(1)
        expect(key.y+key.height).toBeLessThan(wheel.y+wheel.height)
      }
      if(browserName==='chromium') await remote.locator('main').screenshot({path:info.outputPath(`${skin.id}-controls.png`)})
    }
  } finally {await phones.close();await displays.close()}
})
