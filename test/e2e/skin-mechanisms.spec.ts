import { skins } from '../../src/product/catalog'
import { test, expect } from '@playwright/test'
import { wheel, focus, angle } from './helpers/wheel-mechanism'

test.use({trace:'off',screenshot:'off'})

for (const name of ['Clear','Spool','Field reel','Cartridge','Foundry','Observatory'].filter(name => skins.some(skin => skin.name === name))) {
  test(`${name}: rotor and linked parts stop together and follow a reversed jog`,async({page})=>{
    await focus(page,name)
    await page.getByRole('button',{name:'Play',exact:true}).click()
    const count=await wheel(page).locator('[data-wheel-ratio], [data-wheel-distance]').count()
    expect(count).toBe(['Foundry','Observatory'].includes(name) ? 1 : 0)
    await expect.poll(()=>wheel(page).evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running' && a.effect?.getTiming().iterations===Infinity).length)).toBe(count+1)
    const times=await wheel(page).evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.effect?.getTiming().iterations===Infinity).map(a=>Number(a.startTime)))
    expect(Math.max(...times)-Math.min(...times)).toBeLessThan(1)
    await page.getByRole('button',{name:'Pause',exact:true}).click()
    await expect.poll(()=>wheel(page).evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0)
    const readParts=()=>wheel(page).locator('[data-wheel-ratio]').evaluateAll(els=>els.map(el=>{
      const m=new DOMMatrixReadOnly(getComputedStyle(el).transform)
      return {angle:Math.atan2(m.b,m.a),ratio:Number((el as SVGElement).dataset.wheelRatio)}
    }))
    const chassis=wheel(page).locator('[data-mechanism=coaxial]')
    const fixedPose=['Clear','Spool'].includes(name)?await chassis.evaluate(el=>getComputedStyle(el).transform):null
    const before=await readParts(), beforeDriver=await angle(page,'.lab-device .wheel-rotor'), box=(await wheel(page).boundingBox())!
    const cx=box.x+box.width/2,cy=box.y+box.height/2,r=box.width*.43
    await page.mouse.move(cx+r,cy);await page.mouse.down()
    await page.mouse.move(cx+r*Math.cos(-.1),cy+r*Math.sin(-.1));await page.mouse.up()
    const after=await readParts()
    if(fixedPose!==null) expect(await chassis.evaluate(el=>getComputedStyle(el).transform)).toBe(fixedPose)
    const afterDriver=await angle(page,'.lab-device .wheel-rotor')
    const driverDelta=Math.atan2(Math.sin(afterDriver-beforeDriver),Math.cos(afterDriver-beforeDriver))
    expect(Math.abs(driverDelta)).toBeGreaterThan(.05)
    for(let i=0;i<before.length;i++) {
      const delta=Math.atan2(Math.sin(after[i].angle-before[i].angle),Math.cos(after[i].angle-before[i].angle))
      expect(Math.abs(delta-before[i].ratio*driverDelta)).toBeLessThan(.005)
    }
  })
}

test('reduced motion keeps state changes and freezes every linked part',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'})
  await focus(page,'Clear')
  await page.getByRole('button',{name:'Play',exact:true}).click()
  await expect(wheel(page)).toHaveAttribute('data-running','true')
  expect(await wheel(page).evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0)
  await page.getByRole('slider',{name:'Jog script position'}).press('ArrowRight')
  await page.getByRole('button',{name:'Pause',exact:true}).click()
  await expect(wheel(page)).toHaveAttribute('data-running','false')
})

test('showroom previews deliberately play and pause the same mechanism',async({page})=>{
  await page.goto('/pro')
  const hero=page.locator('.pro-hero')
  await expect(hero.locator('.jog-wheel')).toHaveAttribute('data-running','false')
  await hero.getByRole('button',{name:'Play preview',exact:true}).click()
  await expect(hero.locator('.jog-wheel')).toHaveAttribute('data-running','true')
  await hero.getByRole('button',{name:'Preview Clear',exact:true}).click()
  await expect(hero.locator('[data-mechanism="coaxial"]')).toBeVisible()
  await hero.getByRole('button',{name:'Pause preview',exact:true}).click()
  await expect.poll(()=>hero.locator('.jog-wheel').evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0)
})
