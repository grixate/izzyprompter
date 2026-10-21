import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { rename } from 'node:fs/promises'
const root=resolve('docs/design/2026-10-21-wheel-first')
await build({configFile:false,root,base:'./',plugins:[react()],build:{outDir:resolve(root,'live'),emptyOutDir:true,rollupOptions:{input:resolve(root,'live.html')}}})
await rename(resolve(root,'live/live.html'),resolve(root,'live/index.html'))
