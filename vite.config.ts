import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { offlinePlugin } from './scripts/offlinePlugin.ts'

export default defineConfig(({ mode }) => ({
  plugins: [react(), offlinePlugin()],
  server: { proxy: {
    '/api': loadEnv(mode, '.', 'IZZY_').IZZY_API_PROXY ?? 'http://127.0.0.1:4000',
    '/auth': loadEnv(mode, '.', 'IZZY_').IZZY_API_PROXY ?? 'http://127.0.0.1:4000',
    '/account/socket': { target: loadEnv(mode, '.', 'IZZY_').IZZY_API_PROXY ?? 'http://127.0.0.1:4000', ws: true },
    '/socket': { target: loadEnv(mode, '.', 'IZZY_').IZZY_API_PROXY ?? 'http://127.0.0.1:4000', ws: true },
  } },
  // A bundled release must never inherit a developer's split-origin override.
  define: mode === 'bundled' ? { 'import.meta.env.VITE_SOCKET_URL': JSON.stringify('') } : undefined,
}))
