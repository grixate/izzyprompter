import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { cp, mkdir, rename, readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

// Run from the repository root. This entry imports the synthetic lab directly;
// it cannot create sessions or reach the account/remote application.
const root = resolve('docs/design/2026-10-19-skin-craft/v2')
const output = resolve('artifacts/skin-craft/hosted-review-v2')
const base = '/assets/skin-craft-review-ad92e3a/v2/'
await mkdir(output, { recursive:true })
for (const name of ['review.html','review.js','references','before']) await cp(resolve(root,name),resolve(output,name),{recursive:true})
await writeFile(resolve(output,'review.html'),(await readFile(resolve(output,'review.html'),'utf8')).replace('http://127.0.0.1:4177/lab/jog','live/index.html'))
await build({configFile:false,root,base:base+'live/',plugins:[react()],build:{outDir:resolve(output,'live'),emptyOutDir:true,rollupOptions:{input:resolve(root,'live.html')}}})
await rename(resolve(output,'live/live.html'),resolve(output,'live/index.html'))
async function files(dir) {
  const entries=await readdir(dir,{withFileTypes:true})
  return (await Promise.all(entries.map(e=>e.isDirectory()?files(resolve(dir,e.name)):[resolve(dir,e.name)]))).flat().sort()
}
const sourceFiles=[...await files(resolve('src')),resolve('package.json'),resolve('package-lock.json'),resolve(root,'live-entry.tsx')]
const sourceHash=createHash('sha256')
for(const file of sourceFiles) sourceHash.update(file.replace(resolve('.')+'/','')).update(await readFile(file))
const bundles=[]
for(const file of await files(output)) if(!file.endsWith('review-bundle.json')) bundles.push({file:file.slice(output.length+1),sha256:createHash('sha256').update(await readFile(file)).digest('hex')})
await writeFile(resolve(output,'review-bundle.json'),JSON.stringify({kind:'isolated synthetic design review',commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceSha256:sourceHash.digest('hex'),base,files:bundles},null,2)+'\n')
