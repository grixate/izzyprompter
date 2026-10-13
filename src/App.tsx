import { lazy, Suspense } from 'react'
import { DisplayPage } from './pages/DisplayPage'
import { RemotePage } from './pages/RemotePage'
import { StartPage } from './pages/StartPage'
import { AccountProvider } from './account/AccountProvider'
import { AccountPage } from './pages/AccountPage'

// An isolated design workbench, excluded from the hosted production build.
const JogLabPage = import.meta.env.DEV ? lazy(() => import('./pages/JogLabPage')) : null
const LocalPage = lazy(() => import('./local/LocalPage').then(module => ({ default: module.LocalPage })))
const LocalRemotePage = lazy(() => import('./local/LocalRemotePage').then(module => ({ default: module.LocalRemotePage })))

function App() {
  const parts = window.location.pathname.split('/').filter(Boolean)
  const [surface, rawSessionId] = parts
  const sessionId = rawSessionId?.toUpperCase() ?? null

  if (surface === 'local') return <Suspense fallback={<main>Opening local workspace…</main>}>
    {rawSessionId === 'remote' ? <LocalRemotePage /> : <LocalPage />}
  </Suspense>

  if (surface === 'lab' && rawSessionId === 'jog' && JogLabPage) {
    return <Suspense fallback={<main style={{ minHeight: '100dvh', padding: 40, background: '#e9e9e2', color: '#24251f' }}>Opening the wheel studio…</main>}><JogLabPage /></Suspense>
  }

  if (surface === 'display' && sessionId) return <DisplayPage sessionId={sessionId} />
  if (surface === 'remote' && sessionId) return <RemotePage sessionId={sessionId} />
  return <AccountProvider>{surface === 'account' ? <AccountPage /> : <StartPage />}</AccountProvider>
}

export default App
