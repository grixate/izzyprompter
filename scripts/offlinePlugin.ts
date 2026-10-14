import type { Plugin } from 'vite'

/** Cache only public app assets and the explicit local entry point. */
export function offlinePlugin(): Plugin {
  return {
    name: 'izzy-offline-shell', apply: 'build', enforce: 'post',
    generateBundle(_options, bundle) {
      const index = bundle['index.html']
      if (!index || index.type !== 'asset') throw new Error('Missing offline app shell')
      const assets = Object.keys(bundle).filter(name => name.startsWith('assets/')).sort().map(name => `/${name}`)
      // Vite's asset filenames are already content-hashed. This is a cache identity, not a secret.
      let hash = 2166136261
      for (const character of String(index.source) + assets.join('|')) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
      const build = (hash >>> 0).toString(16)
      index.source = String(index.source).replace('</head>', `<meta name="izzy-offline-build" content="${build}" /></head>`)
      const paths = ['/local', '/manifest.webmanifest', '/offline-icon.svg',
        '/favicon.svg', '/favicon-16.png', '/favicon-32.png', '/apple-touch-icon.png',
        '/icon-192.png', '/icon-512.png', ...assets]
      this.emitFile({ type: 'asset', fileName: 'local-sw.js', source: `
const BUILD = ${JSON.stringify(build)};
const CACHE = 'izzy-local-' + BUILD;
const PATHS = ${JSON.stringify(paths)};
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  try { await cache.addAll(PATHS.map(path => new Request(path, { cache: 'reload', credentials: 'omit' }))); }
  catch (error) { await caches.delete(CACHE); throw error; }
})()));
// No skipWaiting: never replace the worker/build underneath a running take.
self.addEventListener('activate', event => event.waitUntil((async () => {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  // Waiting updates normally activate after clients close. Never delete the
  // previous build while a local page may still be taking or editing.
  if (!windows.some(client => new URL(client.url).pathname.startsWith('/local'))) {
    await Promise.all((await caches.keys()).filter(key => key.startsWith('izzy-local-') && key !== CACHE).map(key => caches.delete(key)));
  }
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  if (event.data !== 'izzy-offline-check' || !event.ports[0]) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const present = await Promise.all(PATHS.map(path => cache.match(path)));
    event.ports[0].postMessage({ build: BUILD, ready: present.every(Boolean) });
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const local = request.mode === 'navigate' && (url.pathname === '/local' || url.pathname === '/local/remote');
  const asset = PATHS.includes(url.pathname) && url.pathname !== '/local';
  if (!local && !asset) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE)).match(local ? '/local' : url.pathname);
    return cached || fetch(request);
  })());
});
` })
    },
  }
}
