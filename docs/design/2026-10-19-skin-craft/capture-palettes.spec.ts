// Review-only colour trials. Copy into test/e2e temporarily, run Chromium,
// preserve the object screenshots, then remove the temporary test copy.
import { test, expect } from '@playwright/test'
test.use({trace:'off',screenshot:'off',viewport:{width:1280,height:1000},deviceScaleFactor:2})
const trials:Record<string,string>={
 clear:`.skin-face.skin--clear{--instrument-type:#293e35;--craft-accent:#447261;background:url('/src/assets/skin-clear-frame.svg') center/100% 100%,linear-gradient(135deg,#f2e1c4ee,#dbc9a8bd 55%,#bda77cde)}.skin--clear .wheel-rotor{background:#b7c8bd66}.skin--clear .wheel-disc{background:repeating-conic-gradient(from 15deg,#efe8d870 0deg 36deg,#c7c5ac33 37deg 118deg,#596f5733 119deg 120deg),radial-gradient(circle,#f3ecd38f 0 35%,#798a6940 36% 38%,transparent 39% 66%,#e9edc9aa 67% 71%,transparent 72%)}.skin--clear .transport-button{background:linear-gradient(135deg,#61917b,#447261);border-color:#355847;color:#f1e9cd}.skin--clear .speed-module .speed-step{background:#e7d5b3}`,
 spool:`.skin-face.skin--spool{--instrument-type:#201f1b;--craft-accent:#443d29;background:url('/src/assets/skin-spool-frame.svg') center/100% 100%,linear-gradient(125deg,#b8a17df5,#826b4fed 65%,#a58a63ee)}.skin--spool .wheel-rotor{background:radial-gradient(circle,#4b422e 0 20%,transparent 21%),conic-gradient(from -30deg,#d9c39175 0 39deg,#493e2940 40deg 118deg,#d9c39175 120deg 159deg,#493e2940 160deg 238deg,#d9c39175 240deg 279deg,#493e2940 280deg)}.skin--spool .wheel-disc{background:radial-gradient(circle,transparent 0 33%,#4b422d 34% 62%,#dfc59a25 63% 67%,transparent 68%),conic-gradient(from -30deg,#e9d5a366 0 39deg,transparent 40deg 118deg,#e9d5a366 120deg 159deg,transparent 160deg 238deg,#e9d5a366 240deg 279deg,transparent 280deg)}.skin--spool .transport-button{background:linear-gradient(135deg,#f5e7c8,#ceb180);border-color:#86704b;color:#201f1b}.skin--spool .speed-module .speed-step{background:#bda37b;color:#201f1b}`,
 glaze:`.skin-face.skin--glaze{--instrument-type:#233c42;--craft-accent:#406f73;background:linear-gradient(125deg,#d7e2da,#b6cad0 60%,#8aabb4);border-color:#7e9da7}.skin--glaze .wheel-rotor{background:linear-gradient(135deg,#e5ebe1,#779ba9)}.skin--glaze .wheel-disc{background:radial-gradient(ellipse at 30% 20%,#d7e2da,#b6cad0 60%,#7fabb3)}.skin--glaze .transport-button{background:linear-gradient(135deg,#406f73,#31545e);border-color:#31545e;color:#eef0d8}.skin--glaze .speed-module .speed-step{background:#b8cdd0;border-color:#7c9da6}`,
 pop:`.skin-face.skin--pop{--instrument-type:#303531;--craft-accent:#566f55;background:#c0b6dc;border-color:#908ba8;box-shadow:inset 0 -5px #908ba8,0 10px 15px -8px #44485c55}.skin--pop .wheel-disc{background:conic-gradient(from 15deg,#df8a63 0deg 126deg,#566f55 126deg 245deg,#cfc071 245deg 360deg)}.skin--pop .transport-button{background:#ede1c8;color:#303531}.skin--pop .speed-module .speed-step{background:#d0c7e7;color:#303531}`,
 moss:`.skin-face.skin--moss{--instrument-type:#243d30;--craft-accent:#3d6858;background:linear-gradient(140deg,#e2d6b9,#c5b89b 80%);border-color:#9a947a}.skin--moss .wheel-disc{background:radial-gradient(ellipse at 32% 22%,#547f68,#274e40)}.skin--moss .transport-button{background:#e9d2a0;color:#243d30;border-color:#9b865b}.skin--moss .speed-module .speed-step{background:#d2c5ab;color:#243d30;border-color:#8d9275}`,
 mono:`.skin-face.skin--mono{--instrument-type:#26362e;--craft-accent:#38453b;background:#e2e2d5;border-color:#b5b9a5}.skin--mono .wheel-rotor{background:conic-gradient(from -16deg,#38453b 0deg 318deg,#e2e2d5 318deg 360deg)}.skin--mono .wheel-disc{background:#e2e2d5}.skin--mono .transport-button{background:#38453b;color:#e2e2d5}.skin--mono .speed-module .speed-step{background:#e2e2d5;color:#26362e;border-color:#38453b}`,
}
for(const [id,css] of Object.entries(trials)) test(`${id}: equal-geometry palette pair`,async({page},info)=>{
  await page.goto(`/skins?skin=${id}`)
  const dialog=page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const object=dialog.locator('.remote-instrument')
  await expect(object.locator('.jog-wheel')).toHaveAttribute('data-running','false')
  await object.screenshot({path:info.outputPath(`${id}-palette-a.png`)})
  await page.addStyleTag({content:css.replace(/(^|\})\.skin--/g,'$1.skin-face.skin--')})
  await object.screenshot({path:info.outputPath(`${id}-palette-b.png`)})
})
