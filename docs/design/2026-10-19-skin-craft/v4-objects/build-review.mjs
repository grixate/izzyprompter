import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { rename } from 'node:fs/promises'
// Isolated, synthetic lab: no account, pairing or saved-script application.
const root=resolve('docs/design/2026-10-19-skin-craft/v4-objects')
await build({configFile:false,root,base:'./',plugins:[react()],build:{outDir:resolve(root,'live'),emptyOutDir:true,rollupOptions:{input:resolve(root,'live.html')}}})
await rename(resolve(root,'live/live.html'),resolve(root,'live/index.html'))
